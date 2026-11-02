import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@agentopia/db";
import { TASK_STATUSES, type CreateProjectInput, type CreateTaskInput, type DecideApprovalInput, type TaskActionInput } from "@agentopia/shared";
import { z } from "zod";
import type { TaskDetailRaw, TaskProviderLimit } from "../../lib/api-types";
import { audit } from "../audit";
import { createTask as coreCreateTask, decideApproval as coreDecideApproval, ensureWorkspace, taskAction as coreTaskAction } from "../core";
import { badRequest, notFound } from "../errors";
import { pageArgs, toPage } from "../http";
import { getProviderLimitView, isLimitActive, PROVIDER_DISPLAY_NAME, providerFromString } from "./provider-status";
import { taskListSelect, toEventView, toTaskListItem } from "./views";

// --- Projects ---------------------------------------------------------------------------
const projectSelect = { id: true, name: true, description: true, status: true, workspacePath: true, createdAt: true, updatedAt: true } as const;

export async function listProjects(companyId: string) {
  return prisma.project.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, select: projectSelect });
}

export async function createProject(companyId: string, userId: string, input: z.infer<typeof CreateProjectInput>) {
  const p = await prisma.project.create({ data: { companyId, name: input.name, description: input.description }, select: projectSelect });
  const ws = await ensureWorkspace(companyId, p.id);
  const project = ws ? await prisma.project.update({ where: { id: p.id }, data: { workspacePath: ws }, select: projectSelect }) : p;
  await audit(companyId, userId, "project.create", "Project", p.id, { name: input.name });
  return project;
}

// --- Tasks ------------------------------------------------------------------------------------
export const TaskListQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  parentTaskId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function listTasks(companyId: string, q: z.infer<typeof TaskListQuery>) {
  const rows = await prisma.task.findMany({
    where: {
      companyId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.assigneeId ? { assigneeId: q.assigneeId } : {}),
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.parentTaskId ? { parentTaskId: q.parentTaskId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: taskListSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q.limit);
  return { items: page.items.map(toTaskListItem), nextCursor: page.nextCursor };
}

export async function createTask(companyId: string, userId: string, input: z.infer<typeof CreateTaskInput>) {
  if (input.projectId && !(await prisma.project.findFirst({ where: { id: input.projectId, companyId }, select: { id: true } }))) {
    throw badRequest("projectId does not belong to this company");
  }
  if (input.assigneeId && !(await prisma.employee.findFirst({ where: { id: input.assigneeId, companyId, status: "ACTIVE" }, select: { id: true } }))) {
    throw badRequest("assigneeId is not an active employee of this company");
  }
  if (!input.submitToManager && !input.assigneeId) throw badRequest("assigneeId is required when submitToManager is false");
  if (input.dependsOn?.length) {
    const n = await prisma.task.count({ where: { id: { in: input.dependsOn }, companyId } });
    if (n !== new Set(input.dependsOn).size) throw badRequest("dependsOn contains tasks outside this company");
  }
  const t = await coreCreateTask(companyId, { userId }, input);
  await audit(companyId, userId, "task.create", "Task", t.id, { title: input.title, submitToManager: input.submitToManager });
  return getTaskDetail(companyId, t.id);
}

const depSelect = { id: true, title: true, status: true } as const;

export async function getTaskDetail(companyId: string, taskId: string, where: { isDemo?: boolean } = {}): Promise<TaskDetailRaw> {
  const t = await prisma.task.findFirst({
    where: { id: taskId, companyId, ...where },
    select: {
      ...taskListSelect,
      maxAttempts: true, maxCostUsd: true, timeoutSec: true, requiresApproval: true, resultSummary: true, errorMessage: true, plan: true,
      startedAt: true, createdByUserId: true, createdByEmployeeId: true, limitRetries: true,
      parent: { select: depSelect },
      children: { select: taskListSelect, orderBy: { createdAt: "asc" } },
      dependencies: { select: { dependsOn: { select: depSelect } } },
      dependents: { select: { task: { select: depSelect } } },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, employeeId: true, employee: { select: { id: true, name: true } }, assignedById: true, reason: true, handoff: true, status: true, createdAt: true, endedAt: true },
      },
      executions: {
        orderBy: { attempt: "asc" },
        select: {
          id: true, attempt: true, employeeId: true, provider: true, mode: true, model: true, status: true, runnerId: true, usage: true, costUsd: true,
          costSource: true, error: true, errorKind: true, cancelRequested: true, startedAt: true, endedAt: true, createdAt: true,
        },
      },
      artifacts: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, kind: true, mimeType: true, sizeBytes: true, executionSessionId: true, createdAt: true, content: true, storagePath: true },
      },
      approvals: { orderBy: { requestedAt: "desc" } },
    },
  });
  if (!t) throw notFound("Task");
  const latest = t.executions[t.executions.length - 1] ?? null;
  return {
    ...toTaskListItem(t),
    maxAttempts: t.maxAttempts, maxCostUsd: t.maxCostUsd, timeoutSec: t.timeoutSec, requiresApproval: t.requiresApproval,
    resultSummary: t.resultSummary, errorMessage: t.errorMessage, plan: t.plan, startedAt: t.startedAt,
    createdByUserId: t.createdByUserId, createdByEmployeeId: t.createdByEmployeeId,
    parent: t.parent,
    children: t.children.map(toTaskListItem),
    dependencies: t.dependencies.map((d) => d.dependsOn),
    dependents: t.dependents.map((d) => d.task),
    assignments: t.assignments,
    executions: t.executions,
    artifacts: t.artifacts.map(({ content, storagePath, ...a }) => ({ ...a, hasContent: content != null || storagePath != null })),
    approvals: t.approvals,
    limitRetries: t.limitRetries,
    maxLimitRetries: MAX_LIMIT_RETRIES,
    latestErrorKind: (latest?.errorKind as TaskDetailRaw["latestErrorKind"]) ?? null,
    providerLimit: await taskProviderLimit(companyId, latest?.provider ?? null, t.assigneeId),
  };
}

/** Bounded re-queues after provider usage limits (mirrors core's Usage Limit Manager). */
export const MAX_LIMIT_RETRIES = 5;

/** The limit for the provider this task runs on: latest execution's provider, else the assignee's connection. */
async function taskProviderLimit(companyId: string, executionProvider: string | null, assigneeId: string | null): Promise<TaskProviderLimit | null> {
  let provider = providerFromString(executionProvider);
  if (!provider && assigneeId) {
    const e = await prisma.employee.findFirst({ where: { id: assigneeId, companyId }, select: { providerConnection: { select: { provider: true } } } });
    provider = providerFromString(e?.providerConnection?.provider);
  }
  if (!provider) return null;
  const limit = await getProviderLimitView(companyId, provider);
  return { provider, displayName: PROVIDER_DISPLAY_NAME[provider], limit, limited: isLimitActive(limit) };
}

export async function taskAction(companyId: string, userId: string, taskId: string, input: z.infer<typeof TaskActionInput>) {
  const t = await prisma.task.findFirst({ where: { id: taskId, companyId }, select: { id: true } });
  if (!t) throw notFound("Task");
  await coreTaskAction(companyId, taskId, input.action, { userId }, input.note);
  await audit(companyId, userId, `task.action.${input.action}`, "Task", taskId, { note: input.note ?? null });
  return getTaskDetail(companyId, taskId);
}

// --- Events -----------------------------------------------------------------------------------
export const EventsQuery = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function listEvents(companyId: string, q: z.infer<typeof EventsQuery>, taskId?: string) {
  if (taskId && !(await prisma.task.findFirst({ where: { id: taskId, companyId }, select: { id: true } }))) throw notFound("Task");
  const rows = await prisma.taskEvent.findMany({
    where: { companyId, ...(taskId ? { taskId } : {}), seq: { gt: BigInt(q.after) } },
    orderBy: { seq: "asc" },
    take: q.limit,
  });
  const items = rows.map(toEventView);
  return { items, nextCursor: items.length ? items[items.length - 1]!.seq : q.after };
}

// --- Artifacts ---------------------------------------------------------------------------------
export async function getArtifact(companyId: string, artifactId: string, download: boolean): Promise<Response | Record<string, unknown>> {
  const a = await prisma.artifact.findFirst({ where: { id: artifactId, companyId } });
  if (!a) throw notFound("Artifact");
  if (a.storagePath && (download || a.content == null)) {
    const root = path.resolve(process.env.AGENTOPIA_ARTIFACT_ROOT ?? "./.data/artifacts");
    const full = path.resolve(root, a.storagePath);
    if (!full.startsWith(root + path.sep)) throw notFound("Artifact");
    const buf = await readFile(full).catch(() => null);
    if (!buf) throw notFound("Artifact file");
    const safeName = a.name.replace(/[^\w.\- ]+/g, "_");
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": a.mimeType || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  }
  if (download && a.content != null) {
    const safeName = a.name.replace(/[^\w.\- ]+/g, "_");
    return new Response(a.content, {
      headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${safeName}"`, "x-content-type-options": "nosniff" },
    });
  }
  const { storagePath: _s, ...rest } = a;
  return rest;
}

// --- Approvals ------------------------------------------------------------------------------------
export const ApprovalListQuery = z.object({ status: z.enum(["PENDING", "APPROVED", "DENIED", "EXPIRED"]).optional() });

export async function listApprovals(companyId: string, q: z.infer<typeof ApprovalListQuery>) {
  return prisma.approvalRequest.findMany({
    where: { companyId, ...(q.status ? { status: q.status } : {}) },
    orderBy: { requestedAt: "desc" },
    take: 200,
    include: { task: { select: { id: true, title: true } } },
  });
}

export async function decideApproval(companyId: string, userId: string, approvalId: string, input: z.infer<typeof DecideApprovalInput>) {
  const a = await prisma.approvalRequest.findFirst({ where: { id: approvalId, companyId }, select: { id: true } });
  if (!a) throw notFound("Approval request");
  await coreDecideApproval(companyId, approvalId, input.decision, { userId }, input.note);
  await audit(companyId, userId, "approval.decide", "ApprovalRequest", approvalId, input);
  return prisma.approvalRequest.findUniqueOrThrow({ where: { id: approvalId }, include: { task: { select: { id: true, title: true } } } });
}
