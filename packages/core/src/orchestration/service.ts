import { prisma, Prisma, type ExecutionSession, type Task } from "@agentopia/db";
import { CreateTaskInput, type CreateTaskInputT, type TaskStatus } from "@agentopia/shared";
import { DomainError } from "../errors";
import { emitEvent, withEvents } from "../events/emit";
import { enqueueExecution, enqueueManagerPlan } from "../queue/queues";
import type { HandoffRecord } from "../prompt/assemble";
import { ensureWorkspace } from "../workspace/paths";
import { getCompanySettings, moveTask, providerSettingsOf, resolveExecutionTarget } from "./common";
import { finalizeReview } from "./review";
import { blockForRunnerOffline, gateExecution } from "./gate";
import { classifiedFromState, getProviderLimit, isProviderAvailable, parkTaskForProviderLimit, providerOfTask, releaseWaitingTask } from "../providers/limits";
import { canTransition, isTerminalTaskStatus } from "./state-machine";

export interface Actor {
  userId?: string;
  employeeId?: string;
}

/** Plan metadata stored on Task.plan (manager decisions, waiting state). */
export type TaskPlanRecord = Record<string, unknown> & { requestedAssigneeId?: string };

/** True if adding edges task → dependsOnIds would create a cycle in the dependency DAG. */
export async function wouldCreateCycle(taskId: string, dependsOnIds: string[], db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  const seen = new Set<string>();
  let frontier = [...dependsOnIds];
  while (frontier.length) {
    if (frontier.includes(taskId)) return true;
    frontier = frontier.filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
    if (!frontier.length) break;
    const edges = await db.taskDependency.findMany({ where: { taskId: { in: frontier } }, select: { dependsOnId: true } });
    frontier = edges.map((e) => e.dependsOnId);
  }
  return false;
}

/**
 * Creates a task (validated against CreateTaskInput), its dependency edges and
 * a `task.created` event. Routing: `submitToManager` (default) → manager plan
 * job; otherwise the given assignee gets it directly (immediately when its
 * dependencies are complete, else when they complete).
 */
export async function createTask(companyId: string, actor: Actor, input: CreateTaskInputT): Promise<Task> {
  const data = CreateTaskInput.parse(input);
  const company = await prisma.company.findFirst({ where: { id: companyId, archivedAt: null } });
  if (!company) throw new DomainError("NOT_FOUND", "Company not found");
  if (data.projectId && !(await prisma.project.findFirst({ where: { id: data.projectId, companyId } }))) throw new DomainError("VALIDATION", "Project not found in this company");
  const direct = !data.submitToManager && !!data.assigneeId;
  if (data.assigneeId) {
    const a = await prisma.employee.findFirst({ where: { id: data.assigneeId, companyId } });
    if (!a) throw new DomainError("VALIDATION", "Assignee not found in this company");
    if (a.status !== "ACTIVE") throw new DomainError("CONFLICT", "Assignee is not active");
  }
  const deps = [...new Set(data.dependsOn ?? [])];
  if (deps.length) {
    const found = await prisma.task.count({ where: { id: { in: deps }, companyId } });
    if (found !== deps.length) throw new DomainError("VALIDATION", "Every dependency must be a task in this company");
  }
  const settings = await getCompanySettings(companyId);

  const task = await withEvents(async (tx, emit) => {
    const t = await tx.task.create({
      data: {
        companyId,
        projectId: data.projectId ?? null,
        createdByUserId: actor.userId ?? null,
        createdByEmployeeId: actor.employeeId ?? null,
        title: data.title,
        description: data.description,
        priority: data.priority,
        requiredSpecialty: data.requiredSpecialty ?? null,
        maxCostUsd: data.maxCostUsd ?? null,
        timeoutSec: data.timeoutSec ?? settings.defaultTimeoutSec,
        status: "BACKLOG",
        plan: data.assigneeId ? ({ requestedAssigneeId: data.assigneeId } as Prisma.InputJsonValue) : undefined,
      },
    });
    if (deps.length) {
      if (await wouldCreateCycle(t.id, deps, tx)) throw new DomainError("VALIDATION", "Dependencies would create a cycle");
      await tx.taskDependency.createMany({ data: deps.map((d) => ({ taskId: t.id, dependsOnId: d })) });
    }
    await emit({
      companyId,
      taskId: t.id,
      type: "task.created",
      payload: { status: "BACKLOG", title: t.title, priority: t.priority, submitToManager: data.submitToManager, dependsOn: deps, createdByUserId: actor.userId ?? null },
    });
    return t;
  });

  if (direct) {
    const pending = deps.length ? await prisma.task.count({ where: { id: { in: deps }, status: { not: "COMPLETED" } } }) : 0;
    if (pending === 0) {
      await assignTask(companyId, task.id, data.assigneeId!, { reason: "Assigned directly by the owner", assignedById: null });
      await startExecution(companyId, task.id);
    }
  } else {
    await enqueueManagerPlan(task.id);
  }
  return prisma.task.findUniqueOrThrow({ where: { id: task.id } });
}

/**
 * Assigns a task to an employee: ends any other ACTIVE assignment, writes an
 * Assignment with a HandoffRecord, moves the task to ASSIGNED and emits
 * `task.assigned` + `employee.state`.
 */
export async function assignTask(companyId: string, taskId: string, employeeId: string, opts: { reason: string; assignedById?: string | null; handoff?: Partial<HandoffRecord> }) {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId } });
  if (!task) throw new DomainError("NOT_FOUND", "Task not found");
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, include: { providerConnection: true } });
  if (!emp) throw new DomainError("NOT_FOUND", "Employee not found");
  if (emp.status !== "ACTIVE") throw new DomainError("CONFLICT", "Employee is not active");
  const from = task.status as TaskStatus;
  if (from !== "ASSIGNED" && !canTransition(from, "ASSIGNED")) throw new DomainError("CONFLICT", `Task cannot be assigned from ${from}`);
  const retryLimit = providerSettingsOf(emp.providerConnection).retryLimit;
  const handoff: HandoffRecord = {
    inputs: task.description.slice(0, 4000),
    deliverables: opts.handoff?.deliverables ?? [task.title],
    constraints: opts.handoff?.constraints ?? [],
    artifacts: opts.handoff?.artifacts ?? [],
    reviewStatus: "pending",
    reviewNotes: null,
    fromEmployeeId: opts.assignedById ?? null,
  };
  return withEvents(async (tx, emit) => {
    await tx.assignment.updateMany({ where: { taskId, status: "ACTIVE" }, data: { status: "RETURNED", endedAt: new Date() } });
    const assignment = await tx.assignment.create({
      data: { taskId, employeeId, assignedById: opts.assignedById ?? null, reason: opts.reason.slice(0, 1000), handoff: handoff as unknown as Prisma.InputJsonValue },
    });
    const data = { assigneeId: employeeId, maxAttempts: task.attempt + 1 + retryLimit, errorMessage: null };
    if (from === "ASSIGNED") await tx.task.update({ where: { id: taskId }, data });
    else if (!(await moveTask(tx, taskId, from, "ASSIGNED", data))) throw new DomainError("CONFLICT", "Task changed concurrently");
    await emit({ companyId, taskId, employeeId, type: "task.assigned", payload: { status: "ASSIGNED", from, assigneeId: employeeId, reason: opts.reason, assignedById: opts.assignedById ?? null, assignmentId: assignment.id } });
    await emit({ companyId, taskId, employeeId, type: "employee.state", payload: { state: "THINKING", taskId, reason: "assigned" } });
    return assignment;
  });
}

const ACTIVE_SESSION = ["QUEUED", "RUNNING", "WAITING_APPROVAL"] as const;

/**
 * Starts the next execution attempt for the task's assignee: creates an
 * ExecutionSession (provider/mode from the employee's connection, SIMULATED
 * when none), moves the task to IN_PROGRESS, emits `task.started` and
 * `execution.started`, and enqueues it (LOCAL_RUNNER sessions wait for a
 * runner claim instead). Idempotent while an attempt is active.
 *
 * Gate (no paid fallback): when the provider is limited the task is parked in
 * WAITING_FOR_PROVIDER_LIMIT; when a LOCAL_RUNNER/subscription task has no
 * ONLINE runner able to run its CLI it is BLOCKED (RUNNER_OFFLINE). Both
 * return null and consume no attempt.
 */
export async function startExecution(companyId: string, taskId: string, opts: { reviewNotes?: string | null } = {}): Promise<ExecutionSession | null> {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId }, include: { assignee: { include: { providerConnection: true } } } });
  if (!task) throw new DomainError("NOT_FOUND", "Task not found");
  if (!task.assignee) throw new DomainError("CONFLICT", "Task has no assignee");
  const active = await prisma.executionSession.findFirst({ where: { taskId, status: { in: [...ACTIVE_SESSION] } } });
  if (active) return active;
  const from = task.status as TaskStatus;
  if (from !== "IN_PROGRESS" && !canTransition(from, "IN_PROGRESS")) throw new DomainError("CONFLICT", `Task cannot start from ${from}`);
  const target = resolveExecutionTarget(task.assignee.providerConnection);
  if (opts.reviewNotes) {
    const a = await prisma.assignment.findFirst({ where: { taskId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
    if (a) {
      const h = { ...((a.handoff ?? {}) as object), reviewNotes: opts.reviewNotes, reviewStatus: "rejected" };
      await prisma.assignment.update({ where: { id: a.id }, data: { handoff: h as Prisma.InputJsonValue } });
    }
  }
  const gate = await gateExecution(companyId, target);
  if (!gate.ok && target.provider !== "SIMULATED") {
    if (gate.reason === "limit") {
      const st = await getProviderLimit(companyId, target.provider);
      if (st) await parkTaskForProviderLimit(taskId, classifiedFromState(st), { provider: target.provider });
    } else {
      await blockForRunnerOffline(taskId, from, target.provider);
    }
    return null;
  }
  const workspacePath = await ensureWorkspace(companyId, task.projectId);
  const attempt = task.attempt + 1;
  const session = await withEvents(async (tx, emit) => {
    const s = await tx.executionSession.create({
      data: {
        companyId,
        taskId,
        employeeId: task.assignee!.id,
        attempt,
        provider: target.providerLabel,
        mode: target.mode,
        model: task.assignee!.model ?? target.connection?.defaultModel ?? null,
        status: "QUEUED",
        workspacePath,
      },
    });
    const data = { attempt, startedAt: task.startedAt ?? new Date(), errorMessage: null };
    if (from === "IN_PROGRESS") await tx.task.update({ where: { id: taskId }, data });
    else if (!(await moveTask(tx, taskId, from, "IN_PROGRESS", data))) throw new DomainError("CONFLICT", "Task changed concurrently");
    const employeeId = task.assignee!.id;
    await emit({ companyId, taskId, employeeId, type: "task.started", payload: { status: "IN_PROGRESS", from, attempt, assigneeId: employeeId } });
    await emit({
      companyId,
      taskId,
      employeeId,
      type: "execution.started",
      payload: { executionSessionId: s.id, attempt, provider: target.provider, mode: target.mode, authMode: target.authMode, model: s.model, simulatedProvider: target.mode === "SIMULATED" },
    });
    return s;
  });
  if (session.mode !== "LOCAL_RUNNER") await enqueueExecution(session.id);
  return session;
}

/** Records an audit log row (best effort). */
async function audit(companyId: string, actor: Actor, action: string, entityType: string, entityId: string, metadata: object = {}) {
  await prisma.auditLog.create({ data: { companyId, userId: actor.userId ?? null, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue } }).catch(() => undefined);
}

/** Cancels a task (and its non-terminal children); running sessions get `cancelRequested`. */
async function cancelTask(companyId: string, task: Task, actor: Actor, note?: string): Promise<void> {
  const from = task.status as TaskStatus;
  if (isTerminalTaskStatus(from)) throw new DomainError("CONFLICT", `Task is already ${from}`);
  await withEvents(async (tx, emit) => {
    if (!(await moveTask(tx, task.id, from, "CANCELLED", { completedAt: new Date(), errorMessage: note ?? "Cancelled by the owner" }))) throw new DomainError("CONFLICT", "Task changed concurrently");
    await tx.executionSession.updateMany({ where: { taskId: task.id, status: "QUEUED" }, data: { status: "CANCELLED", endedAt: new Date(), error: "cancelled before start" } });
    await tx.executionSession.updateMany({ where: { taskId: task.id, status: { in: ["RUNNING", "WAITING_APPROVAL"] } }, data: { cancelRequested: true } });
    await tx.approvalRequest.updateMany({ where: { taskId: task.id, status: "PENDING" }, data: { status: "DENIED", decidedAt: new Date(), note: "Task cancelled" } });
    await tx.assignment.updateMany({ where: { taskId: task.id, status: "ACTIVE" }, data: { status: "CANCELLED", endedAt: new Date() } });
    await emit({ companyId, taskId: task.id, employeeId: task.assigneeId, type: "task.cancelled", payload: { status: "CANCELLED", from, note: note ?? null, by: actor.userId ?? actor.employeeId ?? null } });
  });
  const children = await prisma.task.findMany({ where: { parentTaskId: task.id, status: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] } } });
  for (const c of children) await cancelTask(companyId, c, actor, "Parent task cancelled").catch(() => undefined);
}

/**
 * Owner actions on a task: cancel, retry (FAILED/BLOCKED/CANCELLED → new
 * attempt or re-plan), approve/reject (pending approval request, else the
 * task's review), unblock (BLOCKED → re-plan), resume (WAITING_FOR_PROVIDER_LIMIT
 * → new attempt, only when the provider is available again; `retry` on a waiting
 * task behaves the same).
 */
export async function taskAction(companyId: string, taskId: string, action: "cancel" | "retry" | "approve" | "reject" | "unblock" | "resume", actor: Actor, note?: string): Promise<Task> {
  const task = await prisma.task.findFirst({ where: { id: taskId, companyId } });
  if (!task) throw new DomainError("NOT_FOUND", "Task not found");
  const status = task.status as TaskStatus;
  switch (action) {
    case "cancel":
      await cancelTask(companyId, task, actor, note);
      break;
    case "resume":
      await resumeWaitingTask(companyId, task.id, status);
      break;
    case "retry": {
      if (status === "WAITING_FOR_PROVIDER_LIMIT") {
        await resumeWaitingTask(companyId, task.id, status);
        break;
      }
      if (!["FAILED", "BLOCKED", "CANCELLED"].includes(status)) throw new DomainError("CONFLICT", `Only failed, blocked or cancelled tasks can be retried (task is ${status})`);
      // A manual retry starts a fresh provider-limit budget.
      if (task.limitRetries) await prisma.task.update({ where: { id: taskId }, data: { limitRetries: 0 } });
      const hasChildren = (await prisma.task.count({ where: { parentTaskId: taskId } })) > 0;
      if (task.assigneeId && !hasChildren) {
        await assignTask(companyId, taskId, task.assigneeId, { reason: `Owner retry${note ? `: ${note}` : ""}`, assignedById: null });
        await startExecution(companyId, taskId, { reviewNotes: note ?? null });
      } else {
        await replan(companyId, task, actor, note);
      }
      break;
    }
    case "unblock":
      if (status !== "BLOCKED") throw new DomainError("CONFLICT", `Task is not blocked (it is ${status})`);
      if (task.limitRetries) await prisma.task.update({ where: { id: taskId }, data: { limitRetries: 0 } });
      await replan(companyId, task, actor, note);
      break;
    case "approve":
    case "reject": {
      const pending = await prisma.approvalRequest.findFirst({ where: { taskId, companyId, status: "PENDING" }, orderBy: { requestedAt: "desc" } });
      if (pending) {
        await decideApproval(companyId, pending.id, action === "approve" ? "APPROVED" : "DENIED", actor, note);
      } else if (status === "REVIEW") {
        await finalizeReview(taskId, { approved: action === "approve", notes: note ?? (action === "approve" ? "Approved by the owner" : "Rejected by the owner"), score: action === "approve" ? 1 : 0, reviewerId: null, method: "owner" });
      } else {
        throw new DomainError("CONFLICT", "Nothing to approve or reject for this task");
      }
      break;
    }
  }
  await audit(companyId, actor, `task.${action}`, "Task", taskId, { note: note ?? null });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

/**
 * Manual release of one WAITING_FOR_PROVIDER_LIMIT task. Refused (CONFLICT, with
 * the reason) while the provider is still limited: there is no override and no
 * paid fallback.
 */
async function resumeWaitingTask(companyId: string, taskId: string, status: TaskStatus): Promise<void> {
  if (status !== "WAITING_FOR_PROVIDER_LIMIT") throw new DomainError("CONFLICT", `Task is not waiting for a provider limit (it is ${status})`);
  const provider = await providerOfTask(taskId);
  if (provider) {
    const a = await isProviderAvailable(companyId, provider);
    if (!a.available) {
      const when = a.resetAt ?? a.retryAfterAt;
      throw new DomainError("CONFLICT", `${a.reason ?? "Provider is limited"}${when ? ` (try again after ${when.toISOString()})` : ""}`, {
        reason: a.reason ?? null,
        resetAt: a.resetAt?.toISOString() ?? null,
        retryAfterAt: a.retryAfterAt?.toISOString() ?? null,
      });
    }
  }
  const r = await releaseWaitingTask(taskId, (c, t) => startExecution(c, t), "resumed by the owner");
  if (r === "skipped") throw new DomainError("CONFLICT", "Task changed concurrently");
}

async function replan(companyId: string, task: Task, actor: Actor, note?: string) {
  const from = task.status as TaskStatus;
  await withEvents(async (tx, emit) => {
    if (!(await moveTask(tx, task.id, from, "PLANNING", { errorMessage: null, maxAttempts: task.attempt + 1 }))) throw new DomainError("CONFLICT", "Task changed concurrently");
    await emit({ companyId, taskId: task.id, type: "task.progress", payload: { status: "PLANNING", from, message: note ? `Re-planning: ${note}` : "Re-planning", by: actor.userId ?? null } });
  });
  await enqueueManagerPlan(task.id);
}

/**
 * Decides a pending ApprovalRequest. The waiting execution (worker or local
 * runner) polls the row and resumes or denies accordingly.
 */
export async function decideApproval(companyId: string, approvalId: string, decision: "APPROVED" | "DENIED", actor: Actor, note?: string) {
  const a = await prisma.approvalRequest.findFirst({ where: { id: approvalId, companyId }, include: { executionSession: { select: { employeeId: true } } } });
  if (!a) throw new DomainError("NOT_FOUND", "Approval request not found");
  if (a.status !== "PENDING") throw new DomainError("CONFLICT", `Approval is already ${a.status}`);
  if (a.expiresAt && a.expiresAt.getTime() < Date.now()) {
    await prisma.approvalRequest.update({ where: { id: a.id }, data: { status: "EXPIRED", decidedAt: new Date() } });
    throw new DomainError("CONFLICT", "Approval request has expired");
  }
  const updated = await prisma.approvalRequest.updateMany({ where: { id: a.id, status: "PENDING" }, data: { status: decision, decidedAt: new Date(), decidedById: actor.userId ?? null, note: note ?? null } });
  if (updated.count !== 1) throw new DomainError("CONFLICT", "Approval was decided concurrently");
  await emitEvent(prisma, {
    companyId,
    taskId: a.taskId,
    employeeId: a.executionSession?.employeeId ?? null,
    type: "task.approval_decided",
    payload: { approvalId: a.id, kind: a.kind, decision, note: note ?? null, decidedById: actor.userId ?? null },
  });
  await audit(companyId, actor, "approval.decide", "ApprovalRequest", a.id, { decision, note: note ?? null });
  return prisma.approvalRequest.findUniqueOrThrow({ where: { id: a.id } });
}
