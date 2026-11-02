import { prisma, Prisma } from "@agentopia/db";
import { withEvents } from "../events/emit";
import { logger } from "../logging";
import { enqueueEmployeeIdle } from "../queue/queues";
import { truncate } from "../providers/util";
import { evaluateProgression, recordEvidence } from "./career";
import { moveTask, pickReviewer, verifiedLlmConfig } from "./common";
import { onTaskTerminal } from "./lifecycle";
import { reviewWithProvider, type LlmReviewer } from "./llm";
import { optionalImport } from "./optional";
import { startExecution } from "./service";
import { recordUsage } from "./usage";

export interface ReviewOptions {
  /** Bounded LLM reviewer (default reviewWithProvider). Only used for non-simulated work with a VERIFIED reviewer connection. */
  llmReviewer?: LlmReviewer;
  /** Delay before the assignee's COMPLETED → IDLE settle event (ms). Default 4000. */
  idleDelayMs?: number;
  /** Skip the optional postmortem hook. */
  skipPostmortem?: boolean;
}

export interface ReviewDecision {
  approved: boolean;
  notes: string;
  score: number;
  reviewerId: string | null;
  method: "checklist" | "llm" | "owner";
  checklist?: Record<string, boolean>;
}

export type ReviewOutcome = { outcome: "skipped"; reason: string } | { outcome: "decided"; decision: ReviewDecision; result: "completed" | "rework" | "failed" };

const XP = { approved: 10, completed: 5 };

/** Deterministic review checklist used for simulated work (and as an LLM fallback). */
export function reviewChecklist(input: { summary: string | null; artifacts: Array<{ content: string | null }> }): { approved: boolean; checks: Record<string, boolean>; notes: string } {
  const summary = (input.summary ?? "").trim();
  const checks = {
    artifactExists: input.artifacts.length > 0,
    summaryNonEmpty: summary.length > 0,
    noFailureMarker: !summary.includes("[simulate:fail]") && !input.artifacts.some((a) => (a.content ?? "").includes("[simulate:fail]")),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { approved: failed.length === 0, checks, notes: failed.length ? `Checklist failed: ${failed.join(", ")}` : "Checklist passed: artifact present, summary present, no failure markers" };
}

/**
 * Manager review job: picks a reviewer (available QA, else manager), emits
 * review events, decides via checklist (SIMULATED / no connection) or a
 * bounded LLM review (VERIFIED connection), then finalizes.
 */
export async function runManagerReview(taskId: string, opts: ReviewOptions = {}): Promise<ReviewOutcome> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { outcome: "skipped", reason: "missing" };
  if (task.status !== "REVIEW") return { outcome: "skipped", reason: `status ${task.status}` };
  const reviewer = await pickReviewer(task.companyId, task.assigneeId);
  const session = await prisma.executionSession.findFirst({ where: { taskId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, include: { artifacts: true } });

  await withEvents(async (_tx, emit) => {
    await emit({ companyId: task.companyId, taskId, employeeId: reviewer?.id ?? null, type: "task.review_started", payload: { reviewerId: reviewer?.id ?? null, status: "REVIEW", executionSessionId: session?.id ?? null } });
    if (reviewer) await emit({ companyId: task.companyId, taskId, employeeId: reviewer.id, type: "employee.state", payload: { state: "REVIEWING", taskId } });
  });

  const artifacts = session?.artifacts ?? [];
  const list = reviewChecklist({ summary: task.resultSummary, artifacts });
  let decision: ReviewDecision = { approved: list.approved, notes: list.notes, score: list.approved ? 1 : 0, reviewerId: reviewer?.id ?? null, method: "checklist", checklist: list.checks };

  if (session && session.mode !== "SIMULATED" && list.checks.summaryNonEmpty && reviewer) {
    const cfg = await verifiedLlmConfig(reviewer.id).catch(() => null);
    if (cfg) {
      try {
        const { verdict, usage } = await (opts.llmReviewer ?? reviewWithProvider)(cfg, {
          title: task.title,
          description: task.description,
          summary: task.resultSummary ?? "",
          artifacts: artifacts.map((a) => ({ name: a.name, kind: a.kind, content: a.content })),
        });
        await recordUsage({ companyId: task.companyId, employeeId: reviewer.id, taskId, provider: cfg.provider, usage });
        decision = { ...decision, approved: verdict.approved, notes: verdict.notes, score: verdict.score, method: "llm" };
      } catch (err) {
        logger.warn({ taskId, err: (err as Error).message }, "LLM review failed; using checklist");
        decision.notes = `${decision.notes} (LLM review unavailable: ${truncate((err as Error).message, 200)})`;
      }
    }
  }
  const result = await finalizeReview(taskId, decision, opts);
  return { outcome: "decided", decision, result };
}

/**
 * Applies a review decision: evidence + XP, `task.review_decided`, then
 * COMPLETED (with delayed IDLE settle, progression, dependents, postmortem)
 * or re-execution with notes when attempts remain, else FAILED.
 */
export async function finalizeReview(taskId: string, d: ReviewDecision, opts: ReviewOptions = {}): Promise<"completed" | "rework" | "failed"> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.status !== "REVIEW") throw new Error(`Task is ${task.status}, not REVIEW`);
  const companyId = task.companyId;
  const assigneeId = task.assigneeId;
  const canRework = !d.approved && task.attempt < task.maxAttempts && !!assigneeId;
  const result: "completed" | "rework" | "failed" = d.approved ? "completed" : canRework ? "rework" : "failed";

  await withEvents(async (tx, emit) => {
    await emit({ companyId, taskId, employeeId: d.reviewerId, type: "task.review_decided", payload: { approved: d.approved, assigneeId: assigneeId ?? null, notes: d.notes, score: d.score, reviewerId: d.reviewerId, method: d.method, checklist: d.checklist ?? null } });
    if (assigneeId) {
      if (d.approved) {
        await recordEvidence(tx, { employeeId: assigneeId, kind: "REVIEW_APPROVED", summary: `${task.title}: ${d.notes}`, taskId, score: d.score, createdById: d.reviewerId });
        await recordEvidence(tx, { employeeId: assigneeId, kind: "TASK_COMPLETED", summary: task.title, taskId });
        await tx.employee.update({ where: { id: assigneeId }, data: { xp: { increment: XP.approved + XP.completed } } });
      } else {
        await recordEvidence(tx, { employeeId: assigneeId, kind: "REVIEW_REJECTED", summary: `${task.title}: ${d.notes}`, taskId, score: d.score, createdById: d.reviewerId });
      }
    }
    if (result === "completed") {
      await moveTask(tx, taskId, "REVIEW", "COMPLETED", { completedAt: new Date() });
      const a = await tx.assignment.findFirst({ where: { taskId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
      if (a) await tx.assignment.update({ where: { id: a.id }, data: { status: "HANDED_OFF", endedAt: new Date(), handoff: { ...((a.handoff ?? {}) as object), reviewStatus: "approved" } as Prisma.InputJsonValue } });
      await emit({ companyId, taskId, employeeId: assigneeId, type: "task.completed", payload: { status: "COMPLETED", from: "REVIEW", reviewerId: d.reviewerId, summary: truncate(task.resultSummary ?? "", 500) } });
    } else if (result === "failed") {
      await moveTask(tx, taskId, "REVIEW", "FAILED", { completedAt: new Date(), errorMessage: `Review rejected: ${truncate(d.notes, 1000)}` });
      await tx.assignment.updateMany({ where: { taskId, status: "ACTIVE" }, data: { status: "RETURNED", endedAt: new Date() } });
      if (assigneeId) await recordEvidence(tx, { employeeId: assigneeId, kind: "TASK_FAILED", summary: `Review rejected with no attempts left: ${task.title}`, taskId });
      await emit({ companyId, taskId, employeeId: assigneeId, type: "task.failed", payload: { status: "FAILED", from: "REVIEW", message: `Review rejected: ${truncate(d.notes, 500)}` } });
    }
    if (d.reviewerId) await emit({ companyId, taskId, employeeId: d.reviewerId, type: "employee.state", payload: { state: "IDLE", taskId, reason: "review done" } });
  });

  if (result === "rework") {
    await startExecution(companyId, taskId, { reviewNotes: d.notes });
    return result;
  }
  if (result === "completed" && assigneeId) {
    await enqueueEmployeeIdle(companyId, assigneeId, taskId, opts.idleDelayMs ?? 4000).catch((err: Error) => logger.warn({ err: err.message }, "idle settle enqueue failed"));
    await evaluateProgression(assigneeId).catch((err: Error) => logger.warn({ err: err.message }, "progression check failed"));
  }
  await onTaskTerminal(taskId);
  if (result === "completed" && !opts.skipPostmortem) await maybeEnqueuePostmortem(taskId);
  return result;
}

/**
 * Drafts a task postmortem via ../learning/postmortem (if present). Skipped
 * for simulated work. Mode comes from the employee's (or company's) learning
 * schedule token strategy, defaulting to ZERO (no LLM call).
 */
export async function maybeEnqueuePostmortem(taskId: string): Promise<void> {
  try {
    const last = await prisma.executionSession.findFirst({ where: { taskId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, select: { mode: true } });
    if (!last || last.mode === "SIMULATED") return;
    const mod = await optionalImport("../learning/postmortem");
    const fn = mod?.generateTaskPostmortem as ((id: string, o: { mode: "ZERO" | "LOW" }) => Promise<unknown>) | undefined;
    if (typeof fn !== "function") return;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { companyId: true, assigneeId: true } });
    if (!task) return;
    const sched =
      (task.assigneeId ? await prisma.learningSchedule.findFirst({ where: { companyId: task.companyId, employeeId: task.assigneeId } }) : null) ??
      (await prisma.learningSchedule.findFirst({ where: { companyId: task.companyId, employeeId: null } }));
    await fn(taskId, { mode: sched?.tokenStrategy === "LOW" ? "LOW" : "ZERO" });
  } catch (err) {
    logger.warn({ taskId, err: (err as Error).message }, "postmortem hook failed");
  }
}
