import { prisma, Prisma } from "@agentopia/db";
import type { TaskStatus } from "@agentopia/shared";
import { emitEvent, withEvents } from "../events/emit";
import { enqueueManagerPlan } from "../queue/queues";
import { findManager, moveTask } from "./common";

/**
 * Runs after a task reaches a terminal status: releases dependents whose
 * dependencies are now all COMPLETED (enqueue plan), blocks dependents of a
 * failed/cancelled task, and rolls a parent up when its children finish.
 */
export async function onTaskTerminal(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;
  const dependents = await prisma.taskDependency.findMany({ where: { dependsOnId: taskId }, include: { task: { include: { dependencies: { include: { dependsOn: { select: { status: true } } } } } } } });
  for (const d of dependents) {
    const t = d.task;
    if (t.status !== "BACKLOG") continue;
    const statuses = t.dependencies.map((x) => x.dependsOn.status);
    if (statuses.some((s) => s === "FAILED" || s === "CANCELLED")) {
      if (await moveTask(prisma, t.id, "BACKLOG", "BLOCKED", { errorMessage: "A dependency failed or was cancelled" })) {
        await emitEvent(prisma, { companyId: t.companyId, taskId: t.id, type: "task.blocked", payload: { status: "BLOCKED", from: "BACKLOG", message: "A dependency failed or was cancelled", dependencyId: taskId } });
      }
    } else if (statuses.every((s) => s === "COMPLETED")) {
      await enqueueManagerPlan(t.id);
    }
  }
  if (task.parentTaskId) await rollupParent(task.parentTaskId);
}

/** Completes a decomposed parent when all children completed; blocks it when a child failed. */
export async function rollupParent(parentId: string): Promise<void> {
  const parent = await prisma.task.findUnique({ where: { id: parentId }, include: { children: { select: { id: true, title: true, status: true, resultSummary: true } } } });
  if (!parent || !parent.children.length) return;
  const from = parent.status as TaskStatus;
  if (from !== "IN_PROGRESS") return;
  const kids = parent.children;
  const manager = await findManager(parent.companyId);
  if (kids.every((k) => k.status === "COMPLETED")) {
    const summary = `All ${kids.length} subtasks completed:\n${kids.map((k) => `- ${k.title}`).join("\n")}`;
    await withEvents(async (tx, emit) => {
      if (!(await moveTask(tx, parentId, "IN_PROGRESS", "REVIEW"))) return;
      await moveTask(tx, parentId, "REVIEW", "COMPLETED", { completedAt: new Date(), resultSummary: summary });
      await emit({ companyId: parent.companyId, taskId: parentId, employeeId: manager?.id ?? null, type: "task.completed", payload: { status: "COMPLETED", from: "IN_PROGRESS", summary, subtaskIds: kids.map((k) => k.id) } });
      if (manager) await emit({ companyId: parent.companyId, taskId: parentId, employeeId: manager.id, type: "employee.state", payload: { state: "IDLE", taskId: parentId, reason: "subtasks complete" } });
    });
    await onTaskTerminal(parentId);
  } else if (kids.some((k) => k.status === "FAILED") && kids.every((k) => ["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"].includes(k.status))) {
    const message = "One or more subtasks failed; retry them or the parent";
    if (await moveTask(prisma, parentId, "IN_PROGRESS", "BLOCKED", { errorMessage: message })) {
      await emitEvent(prisma, { companyId: parent.companyId, taskId: parentId, type: "task.blocked", payload: { status: "BLOCKED", from, message } });
    }
  }
}

/** Shallow-merges keys into Task.plan. */
export async function mergeTaskPlan(db: Prisma.TransactionClient | typeof prisma, taskId: string, patch: Record<string, unknown>): Promise<void> {
  const t = await db.task.findUnique({ where: { id: taskId }, select: { plan: true } });
  const next = { ...((t?.plan as object | null) ?? {}), ...patch };
  await db.task.update({ where: { id: taskId }, data: { plan: next as Prisma.InputJsonValue } });
}
