import { prisma, Prisma, type Specialty } from "@agentopia/db";
import type { TaskStatus } from "@agentopia/shared";
import { isDomainError } from "../errors";
import { emitEvent, withEvents } from "../events/emit";
import { logger } from "../logging";
import { enqueueManagerPlan } from "../queue/queues";
import { findManager, moveTask, verifiedLlmConfig } from "./common";
import { mergeTaskPlan } from "./lifecycle";
import { planWithProvider, type LlmPlanner } from "./llm";
import { deterministicDecomposition, inferSpecialty, scoreCandidates, type CandidateInput, type Plan } from "./planner";
import { recordUsage } from "./usage";
import { assignTask, startExecution } from "./service";

export interface ManagerPlanOptions {
  /** LLM decomposition (default: planWithProvider). Only used with a VERIFIED manager connection. */
  llmPlanner?: LlmPlanner;
  /** Disable LLM planning entirely. */
  disableLlm?: boolean;
}

export type PlanOutcome = { outcome: "skipped" | "waiting" | "assigned" | "decomposed" | "blocked"; reason?: string; assigneeId?: string; childIds?: string[] };

const LLM_PLAN_MIN_CHARS = 1200;

/** Loads scoring inputs for a company's employees. */
async function loadCandidates(companyId: string, specialty: Specialty | null): Promise<CandidateInput[]> {
  const emps = await prisma.employee.findMany({
    where: { companyId, status: { not: "ARCHIVED" } },
    include: {
      _count: { select: { assignments: { where: { status: "ACTIVE" } }, careerEvidence: { where: { kind: { in: ["REVIEW_APPROVED", "TASK_COMPLETED"] } } } } },
      skills: { where: { enabled: true }, include: { skill: { select: { enabled: true, applicableRoles: true } } } },
    },
  });
  return emps.map((e) => ({
    id: e.id,
    name: e.name,
    specialty: e.specialty,
    role: e.role,
    rank: e.rank,
    status: e.status,
    activeAssignments: e._count.assignments,
    evidenceCount: e._count.careerEvidence,
    hasEnabledSkill: e.skills.some((s) => s.skill.enabled && (!specialty || s.skill.applicableRoles.includes(specialty))),
  }));
}

async function block(taskId: string, companyId: string, from: TaskStatus, message: string, plan: Record<string, unknown>): Promise<PlanOutcome> {
  await withEvents(async (tx, emit) => {
    if (!(await moveTask(tx, taskId, from, "BLOCKED", { errorMessage: message }))) return;
    await tx.assignment.updateMany({ where: { taskId, status: "ACTIVE" }, data: { status: "RETURNED", endedAt: new Date() } });
    await mergeTaskPlan(tx, taskId, { ...plan, mode: "blocked", reason: message });
    await emit({ companyId, taskId, type: "task.blocked", payload: { status: "BLOCKED", from, message } });
  });
  return { outcome: "blocked", reason: message };
}

/**
 * Manager planning job. Waits for dependencies, then either decomposes the
 * request into child tasks (explicit multi-specialty deliverables, or an LLM
 * plan for long requests when the manager has a VERIFIED connection) or makes
 * a single scored assignment and starts execution. Blocks with a reason when
 * no qualified employee exists.
 */
export async function runManagerPlan(taskId: string, opts: ManagerPlanOptions = {}): Promise<PlanOutcome> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { dependencies: { include: { dependsOn: { select: { id: true, status: true } } } }, children: { select: { id: true, status: true } } },
  });
  if (!task) return { outcome: "skipped", reason: "missing" };
  let status = task.status as TaskStatus;
  if (status !== "BACKLOG" && status !== "PLANNING") return { outcome: "skipped", reason: `status ${status}` };
  const companyId = task.companyId;

  // 1. Dependencies
  const unmet = task.dependencies.filter((d) => d.dependsOn.status !== "COMPLETED");
  if (unmet.length) {
    if (unmet.some((d) => d.dependsOn.status === "FAILED" || d.dependsOn.status === "CANCELLED")) {
      return block(taskId, companyId, status, "A dependency failed or was cancelled", { waitingOn: unmet.map((d) => d.dependsOn.id) });
    }
    await withEvents(async (tx, emit) => {
      if (status === "PLANNING") await moveTask(tx, taskId, "PLANNING", "BACKLOG");
      await mergeTaskPlan(tx, taskId, { waitingOn: unmet.map((d) => d.dependsOn.id) });
      await emit({ companyId, taskId, type: "task.progress", payload: { status: "BACKLOG", message: `Waiting on ${unmet.length} dependenc${unmet.length === 1 ? "y" : "ies"}`, waitingOn: unmet.map((d) => d.dependsOn.id) } });
    });
    return { outcome: "waiting" };
  }

  // 2. Enter PLANNING
  const manager = await findManager(companyId);
  if (status === "BACKLOG") {
    if (!(await moveTask(prisma, taskId, "BACKLOG", "PLANNING"))) return { outcome: "skipped", reason: "race" };
    status = "PLANNING";
  }
  if (manager) await emitEvent(prisma, { companyId, taskId, employeeId: manager.id, type: "employee.state", payload: { state: "THINKING", taskId, reason: "planning" } });
  const managerIdle = async () => {
    if (manager) await emitEvent(prisma, { companyId, taskId, employeeId: manager.id, type: "employee.state", payload: { state: "IDLE", taskId, reason: "planned" } });
  };

  try {
    const prevPlan = (task.plan as Record<string, unknown> | null) ?? {};

    // 3a. Parent re-plan: re-run unfinished children instead of decomposing again.
    if (task.children.length) {
      const again = task.children.filter((c) => ["FAILED", "BLOCKED", "CANCELLED"].includes(c.status));
      await withEvents(async (tx, emit) => {
        await moveTask(tx, taskId, "PLANNING", "ASSIGNED", { assigneeId: manager?.id ?? null });
        await moveTask(tx, taskId, "ASSIGNED", "IN_PROGRESS", { startedAt: task.startedAt ?? new Date() });
        for (const c of again) await tx.task.update({ where: { id: c.id }, data: { status: "PLANNING", errorMessage: null } });
        await emit({ companyId, taskId, employeeId: manager?.id ?? null, type: "task.planned", payload: { mode: "replan_children", childIds: again.map((c) => c.id) } });
      });
      for (const c of again) await enqueueManagerPlan(c.id);
      return { outcome: "decomposed", childIds: again.map((c) => c.id) };
    }

    const specialty = (task.requiredSpecialty ?? inferSpecialty(task.title, task.description)) as Specialty | null;

    // 3b. Decomposition (top-level requests only)
    let decomposition: { plan: Plan; source: "deterministic" | "llm" } | null = null;
    if (!task.parentTaskId && !prevPlan.requestedAssigneeId) {
      const det = deterministicDecomposition(task.title, task.description, specialty);
      if (det) decomposition = { plan: det, source: "deterministic" };
      else if (task.description.length > LLM_PLAN_MIN_CHARS && !opts.disableLlm && manager) {
        const cfg = await verifiedLlmConfig(manager.id).catch(() => null);
        if (cfg) {
          try {
            const { plan, usage } = await (opts.llmPlanner ?? planWithProvider)(cfg, { title: task.title, description: task.description });
            await recordUsage({ companyId, employeeId: manager.id, taskId, provider: cfg.provider, usage });
            if (plan.subtasks.length > 1) decomposition = { plan, source: "llm" };
          } catch (err) {
            logger.warn({ taskId, err: (err as Error).message }, "LLM planning failed; falling back to a single assignment");
          }
        }
      }
    }

    if (decomposition) {
      const subs = decomposition.plan.subtasks;
      const childIds = await withEvents(async (tx, emit) => {
        const ids: string[] = [];
        for (const s of subs) {
          const c = await tx.task.create({
            data: {
              companyId,
              projectId: task.projectId,
              parentTaskId: taskId,
              createdByEmployeeId: manager?.id ?? null,
              kind: "SUBTASK",
              title: s.title,
              description: s.description,
              priority: task.priority,
              requiredSpecialty: s.specialty,
              maxCostUsd: task.maxCostUsd,
              timeoutSec: task.timeoutSec,
              status: "BACKLOG",
            },
          });
          ids.push(c.id);
        }
        const edges = subs.flatMap((s, i) => s.dependsOn.map((d) => ({ taskId: ids[i]!, dependsOnId: ids[d]! })));
        if (edges.length) await tx.taskDependency.createMany({ data: edges });
        const planRecord = { mode: "decomposed", source: decomposition!.source, subtasks: subs.map((s, i) => ({ taskId: ids[i], title: s.title, specialty: s.specialty, dependsOn: s.dependsOn.map((d) => ids[d]) })) };
        await moveTask(tx, taskId, "PLANNING", "ASSIGNED", { assigneeId: manager?.id ?? null, plan: { ...prevPlan, ...planRecord } as Prisma.InputJsonValue });
        await moveTask(tx, taskId, "ASSIGNED", "IN_PROGRESS", { startedAt: new Date() });
        await emit({ companyId, taskId, employeeId: manager?.id ?? null, type: "task.planned", payload: planRecord });
        for (let i = 0; i < ids.length; i++) {
          await emit({ companyId, taskId: ids[i]!, employeeId: manager?.id ?? null, type: "task.created", payload: { status: "BACKLOG", title: subs[i]!.title, parentTaskId: taskId, specialty: subs[i]!.specialty } });
        }
        return ids;
      });
      for (const id of childIds) await enqueueManagerPlan(id);
      return { outcome: "decomposed", childIds };
    }

    // 3c. Single assignment
    const candidates = await loadCandidates(companyId, specialty);
    const requested = typeof prevPlan.requestedAssigneeId === "string" ? candidates.find((c) => c.id === prevPlan.requestedAssigneeId && c.status === "ACTIVE") : undefined;
    const scored = scoreCandidates({ requiredSpecialty: specialty, title: task.title, description: task.description }, candidates);
    const best = requested ? { employeeId: requested.id, reasons: ["requested by the owner"], score: 0, eligible: true, name: requested.name } : scored.find((s) => s.eligible);
    const planRecord = {
      mode: "single",
      specialty,
      candidates: scored.slice(0, 5).map((s) => ({ employeeId: s.employeeId, name: s.name, eligible: s.eligible, score: s.score, reasons: s.reasons })),
      chosen: best?.employeeId ?? null,
    };
    if (!best) {
      const msg = specialty ? `No qualified ${specialty} employee is available. Hire one or set a different required specialty.` : "No qualified employee is available for this task.";
      return await block(taskId, companyId, "PLANNING", msg, planRecord);
    }
    await mergeTaskPlan(prisma, taskId, planRecord);
    await emitEvent(prisma, { companyId, taskId, employeeId: manager?.id ?? null, type: "task.planned", payload: { mode: "single", specialty, assigneeId: best.employeeId, reasons: best.reasons } });
    await assignTask(companyId, taskId, best.employeeId, { reason: best.reasons.join("; "), assignedById: manager?.id ?? null });
    try {
      await startExecution(companyId, taskId);
    } catch (err) {
      if (isDomainError(err)) return await block(taskId, companyId, "ASSIGNED", err.message, {});
      throw err;
    }
    return { outcome: "assigned", assigneeId: best.employeeId };
  } finally {
    await managerIdle();
  }
}
