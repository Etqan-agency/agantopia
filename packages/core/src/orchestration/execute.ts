import { prisma, Prisma, type ExecutionStatus } from "@agentopia/db";
import { compilePrompt, PromptFieldsSchema, ROLE_TEMPLATES, type CompanySettings, type ProviderSettings, type TaskStatus } from "@agentopia/shared";
import { decryptSecret } from "../crypto/secrets";
import { emitEvent, withEvents } from "../events/emit";
import { logger } from "../logging";
import { getProviderAdapter } from "../providers";
import type { ApprovalKindRequest, ExecutionHooks, ExecutionResult, ProviderAdapter, ProviderEvent, UsageReport } from "../providers/types";
import { emptyUsage } from "../providers/types";
import { abortStatus, sleep, truncate } from "../providers/util";
import { assembleSystemPrompt, buildTaskBrief, wrapUntrusted, type HandoffRecord } from "../prompt/assemble";
import { enqueueManagerReview } from "../queue/queues";
import { artifactPath, ensureWorkspace } from "../workspace/paths";
import { boundedJson, getCompanySettings, moveTask, pickReviewer, providerKindOf, providerSettingsOf } from "./common";
import { onTaskTerminal } from "./lifecycle";
import { optionalImport } from "./optional";
import { acquireExecutionSlot, refreshExecutionSlot, releaseExecutionSlot } from "./semaphore";
import { recordEvidence } from "./career";
import { startExecution } from "./service";
import { recordUsage } from "./usage";
import { classifyProviderError, isLimitErrorKind, type ClassifiedProviderError } from "../providers/classify";
import { isProviderAvailable, noteProviderHealthy, parkTaskForProviderLimit, recordProviderLimit, recordProviderUsageReport, blockTask, getProviderLimit, classifiedFromState } from "../providers/limits";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RunExecutionOptions {
  /** Override the provider adapter (tests). */
  adapter?: ProviderAdapter;
  /** Lease length (ms). Default 60s. */
  leaseMs?: number;
  /** Lease refresh interval (ms). Default 15s. */
  heartbeatMs?: number;
  /** Cancel-flag poll interval (ms). Default 2s. */
  controlPollMs?: number;
  /** Approval poll interval (ms). Default 2s. */
  approvalPollMs?: number;
  /** Delay before retrying when the company semaphore is full (ms). Default 5s. */
  deferMs?: number;
}

export type RunExecutionOutcome =
  | { outcome: "skipped"; reason: string }
  | { outcome: "parked"; reason: string }
  | { outcome: "deferred"; delayMs: number }
  | { outcome: "finished"; status: ExecutionStatus; nextExecutionSessionId?: string | null };

const TERMINAL: ExecutionStatus[] = ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"];
const INLINE_LIMIT = 64 * 1024;

type MemoryHit = { title?: string; excerpt?: string; content?: string; text?: string; sourceUrl?: string | null; kind?: string };

/**
 * Retrieves verified memory via ../memory/search when that module exists
 * (optional). Uses its `buildMemoryContext` (untrusted-data wrapping) when
 * exported, else wraps the chunks with `wrapUntrusted`.
 */
async function memoryContextFor(args: { companyId: string; employeeId: string; projectId: string | null; query: string }): Promise<string> {
  try {
    const mod = await optionalImport("../memory/search");
    const fn = mod?.searchMemory as ((q: { companyId: string; employeeId?: string | null; projectId?: string | null; query: string; limit?: number }) => Promise<unknown>) | undefined;
    if (typeof fn !== "function") return "";
    const raw = (await fn({ companyId: args.companyId, employeeId: args.employeeId, projectId: args.projectId, query: args.query.slice(0, 300), limit: 8 })) as unknown;
    const hits = (Array.isArray(raw) ? raw : ((raw as { chunks?: unknown[]; items?: unknown[] })?.chunks ?? (raw as { items?: unknown[] })?.items ?? [])) as MemoryHit[];
    if (!hits.length) return "";
    const build = mod?.buildMemoryContext as ((chunks: unknown[]) => string) | undefined;
    if (typeof build === "function") return build(hits);
    const body = hits.map((h, i) => `[${i + 1}] ${h.title ?? h.kind ?? "note"}${h.sourceUrl ? ` (${h.sourceUrl})` : ""}\n${truncate(h.excerpt ?? h.content ?? h.text ?? "", 1500)}`).join("\n\n");
    return wrapUntrusted("verified company knowledge", truncate(body, 6000));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "memory search unavailable");
    return "";
  }
}

/**
 * Handles a failed/timed-out attempt: schedules a retry (new session) when
 * attempts remain (and `retry` is not false), otherwise fails the task with evidence. Returns the new
 * session id when a retry was started.
 */
export async function handleExecutionFailure(taskId: string, error: string, opts: { retry?: boolean } = {}): Promise<string | null> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;
  const status = task.status as TaskStatus;
  if (status !== "IN_PROGRESS" && status !== "WAITING_APPROVAL") return null;
  if (opts.retry !== false && task.attempt < task.maxAttempts && task.assigneeId) {
    await emitEvent(prisma, { companyId: task.companyId, taskId, employeeId: task.assigneeId, type: "task.retry_scheduled", payload: { attempt: task.attempt + 1, maxAttempts: task.maxAttempts, error: truncate(error, 500) } });
    try {
      const s = await startExecution(task.companyId, taskId);
      // null: parked for a provider limit or blocked (runner offline); the task is no longer failing.
      return s?.id ?? null;
    } catch (err) {
      error = `${error}; retry could not start: ${(err as Error).message}`;
    }
  }
  await withEvents(async (tx, emit) => {
    if (!(await moveTask(tx, taskId, status, "FAILED", { errorMessage: truncate(error, 2000), completedAt: new Date() }))) return;
    await tx.assignment.updateMany({ where: { taskId, status: "ACTIVE" }, data: { status: "RETURNED", endedAt: new Date() } });
    if (task.assigneeId) await recordEvidence(tx, { employeeId: task.assigneeId, kind: "TASK_FAILED", summary: `Failed: ${task.title}. ${truncate(error, 300)}`, taskId });
    await emit({ companyId: task.companyId, taskId, employeeId: task.assigneeId, type: "task.failed", payload: { status: "FAILED", from: status, attempt: task.attempt, message: truncate(error, 1000) } });
  });
  await onTaskTerminal(taskId);
  return null;
}

/** Everything an adapter needs for a session (shared by the worker and the local-runner claim). */
export interface PreparedExecution {
  systemPrompt: string;
  taskBrief: string;
  memoryContext: string;
  settings: ProviderSettings;
  /** Decrypted secret (only when `includeSecret` and a key is stored). */
  secret?: string;
  workspacePath: string;
  model?: string;
  resumeSessionId: string | null;
  costCapUsd: number;
  timeoutSec: number;
  companySettings: CompanySettings;
  /** SUBSCRIPTION_CLI (user's own CLI login; never a secret) | API_KEY | null (simulated / no connection). */
  authMode: "SUBSCRIPTION_CLI" | "API_KEY" | null;
}

/**
 * Builds the system prompt (current prompt version + enabled skills +
 * hand-off), task brief, untrusted memory context and effective limits for a
 * session. `costCapUsd` = task.maxCostUsd ?? connection maxCostUsd ?? company default.
 */
export async function prepareExecutionInput(executionSessionId: string, opts: { includeSecret: boolean }): Promise<PreparedExecution> {
  const session = await prisma.executionSession.findUniqueOrThrow({
    where: { id: executionSessionId },
    include: { task: true, employee: { include: { providerConnection: true, skills: { where: { enabled: true }, include: { skill: true } }, promptVersions: true } } },
  });
  const { task, employee } = session;
  const companySettings = await getCompanySettings(session.companyId);
  const conn = employee.providerConnection;
  const base = providerSettingsOf(conn);
  const costCapUsd = task.maxCostUsd ?? (conn ? base.maxCostUsd : companySettings.defaultMaxCostUsd);
  const settings: ProviderSettings = { ...base, maxCostUsd: costCapUsd, timeoutSec: task.timeoutSec };
  const authMode = conn && conn.provider !== "SIMULATED" ? conn.authMode : null;
  // Subscription connections never hand out a key (even if one is stored): the user's own CLI sign-in is used.
  const secret = opts.includeSecret && authMode === "API_KEY" && conn?.encryptedSecret ? decryptSecret(conn.encryptedSecret) : undefined;
  const workspacePath = session.workspacePath ?? (await ensureWorkspace(session.companyId, task.projectId));
  const pv = employee.promptVersions.find((p) => p.version === employee.currentPromptVersion);
  const compiled = pv?.compiled ?? compilePrompt(PromptFieldsSchema.parse(ROLE_TEMPLATES[employee.specialty].prompt));
  const assignment = await prisma.assignment.findFirst({ where: { taskId: task.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  const handoff = (assignment?.handoff as HandoffRecord | null) ?? null;
  const systemPrompt = assembleSystemPrompt({
    compiledPrompt: compiled,
    skills: employee.skills.filter((s) => s.skill.enabled).map((s) => ({ name: s.skill.name, instructions: s.skill.instructions })),
    handoff,
  });
  const memoryContext = await memoryContextFor({ companyId: session.companyId, employeeId: employee.id, projectId: task.projectId, query: `${task.title} ${task.description}` });
  const taskBrief = buildTaskBrief(task, { reviewNotes: handoff?.reviewNotes ?? null, attempt: session.attempt });
  return { systemPrompt, taskBrief, memoryContext, settings, secret, workspacePath, model: session.model ?? undefined, resumeSessionId: session.providerSessionId, costCapUsd, timeoutSec: task.timeoutSec, companySettings, authMode };
}

/** Identifies the session an event belongs to. */
export interface SessionRef {
  executionSessionId: string;
  companyId: string;
  taskId: string;
  employeeId: string;
}

/** Persists one provider event as a TaskEvent (or session update) and broadcasts it. */
export async function persistProviderEvent(ref: SessionRef, e: ProviderEvent): Promise<void> {
  const evBase = { companyId: ref.companyId, taskId: ref.taskId, employeeId: ref.employeeId };
  const sid = ref.executionSessionId;
  switch (e.type) {
    case "session":
      await prisma.executionSession.update({ where: { id: sid }, data: { providerSessionId: e.providerSessionId } });
      break;
    case "message":
      await emitEvent(prisma, { ...evBase, type: "execution.message", payload: { executionSessionId: sid, role: e.role, text: truncate(e.text, 4000) } });
      await noteProviderHealthy(sid).catch(() => false);
      break;
    case "provider_status": {
      const s = await prisma.executionSession.findUnique({ where: { id: sid }, select: { provider: true } });
      const provider = providerKindOf(s?.provider ?? "simulated");
      if (provider !== "SIMULATED") {
        await recordProviderUsageReport(ref.companyId, provider, { utilization: e.utilization, windowLabel: e.windowLabel, resetAt: e.resetAt ? new Date(e.resetAt) : undefined });
        if (e.status !== "allowed") {
          await emitEvent(prisma, { ...evBase, type: "task.progress", payload: { executionSessionId: sid, message: e.status === "rejected" ? "Provider usage limit reached" : "Provider usage is close to its limit", provider, utilization: e.utilization ?? null, windowLabel: e.windowLabel ?? null, resetAt: e.resetAt ?? null } });
        }
      }
      break;
    }
    case "tool_use":
      await noteProviderHealthy(sid).catch(() => false);
      await emitEvent(prisma, { ...evBase, type: "execution.tool_use", payload: { executionSessionId: sid, phase: "call", tool: e.tool, input: boundedJson(e.input), toolUseId: e.toolUseId ?? null } });
      break;
    case "tool_result":
      await emitEvent(prisma, { ...evBase, type: "execution.tool_use", payload: { executionSessionId: sid, phase: "result", tool: e.tool ?? null, output: truncate(e.output, 2000), isError: e.isError ?? false } });
      break;
    case "progress":
      await emitEvent(prisma, { ...evBase, type: "task.progress", payload: { executionSessionId: sid, message: truncate(e.text, 1000) } });
      break;
  }
}

/** Persists a usage snapshot event (cumulative per session). */
export async function persistUsage(ref: SessionRef, u: UsageReport): Promise<void> {
  await prisma.executionSession.update({ where: { id: ref.executionSessionId }, data: { usage: u as unknown as Prisma.InputJsonValue, costUsd: u.costUsd, costSource: u.costSource } });
  await emitEvent(prisma, { companyId: ref.companyId, taskId: ref.taskId, employeeId: ref.employeeId, type: "execution.usage", payload: { executionSessionId: ref.executionSessionId, ...u } });
}

/**
 * Creates a PENDING ApprovalRequest for a session and parks session + task in
 * WAITING_APPROVAL (emits task.waiting_approval). Expires at `expiresAt`.
 */
export async function openApproval(ref: SessionRef, r: { kind: ApprovalKindRequest; title: string; payload: unknown }, expiresAt: Date) {
  return withEvents(async (tx, emit) => {
    const a = await tx.approvalRequest.create({
      data: { companyId: ref.companyId, taskId: ref.taskId, executionSessionId: ref.executionSessionId, kind: r.kind, title: truncate(r.title, 300), payload: (boundedJson(r.payload, 8000) ?? {}) as Prisma.InputJsonValue, expiresAt },
    });
    await tx.executionSession.updateMany({ where: { id: ref.executionSessionId, status: "RUNNING" }, data: { status: "WAITING_APPROVAL" } });
    await tx.task.updateMany({ where: { id: ref.taskId, status: "IN_PROGRESS" }, data: { status: "WAITING_APPROVAL" } });
    await emit({ companyId: ref.companyId, taskId: ref.taskId, employeeId: ref.employeeId, type: "task.waiting_approval", payload: { status: "WAITING_APPROVAL", from: "IN_PROGRESS", approvalId: a.id, kind: r.kind, title: a.title } });
    return a;
  });
}

/** Returns session + task from WAITING_APPROVAL to RUNNING/IN_PROGRESS when no approval is pending. */
export async function resumeAfterApprovals(ref: SessionRef, reason: string): Promise<void> {
  const pending = await prisma.approvalRequest.count({ where: { executionSessionId: ref.executionSessionId, status: "PENDING" } });
  if (pending) return;
  await withEvents(async (tx, emit) => {
    const s = await tx.executionSession.updateMany({ where: { id: ref.executionSessionId, status: "WAITING_APPROVAL" }, data: { status: "RUNNING" } });
    await tx.task.updateMany({ where: { id: ref.taskId, status: "WAITING_APPROVAL" }, data: { status: "IN_PROGRESS" } });
    if (s.count) await emit({ companyId: ref.companyId, taskId: ref.taskId, employeeId: ref.employeeId, type: "employee.state", payload: { state: "WORKING", taskId: ref.taskId, reason } });
  });
}

const FINALIZABLE: ExecutionStatus[] = ["RUNNING", "WAITING_APPROVAL", "QUEUED"];

/**
 * True when a failed run hit a hard spending stop (Agentopia's per-run cost
 * cap, or the SDK's `error_max_budget_usd`). Retrying would spend the same
 * budget again, so the task fails once. `terminal` is the explicit marker;
 * the error-text check covers older runners that do not send it.
 */
export function isTerminalStop(result: Pick<ExecutionResult, "status" | "terminal" | "error">): boolean {
  if (result.status !== "FAILED") return false;
  if (result.terminal) return true;
  return /^Stopped: (cost cap of|per-execution budget reached)/.test(result.error ?? "");
}

/** enqueueManagerReview with a small bounded retry (a transient Redis error must not strand a task in REVIEW). */
async function enqueueReviewWithRetry(taskId: string, attempts = 3): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await enqueueManagerReview(taskId);
      return;
    } catch (err) {
      if (i === attempts - 1) {
        logger.error({ err: (err as Error).message, taskId }, "could not enqueue the manager review");
        return;
      }
      await sleep(250 * 2 ** i);
    }
  }
}

/**
 * Persists an execution outcome (artifacts, UsageRecord, session status,
 * `execution.ended`) and applies the task follow-up: REVIEW + handoff +
 * review job on success, cancellation, or retry/fail. Used by the worker and
 * by the local-runner completion route.
 *
 * Idempotent and atomic: the session moves to its terminal status with a
 * guarded `updateMany` (only from RUNNING / WAITING_APPROVAL / QUEUED) in the
 * same transaction as its artifacts, usage record and, on success, the task's
 * move to REVIEW. A second call (or a call for a session the server already
 * failed/re-queued) changes nothing: no usage, no task move, no review job.
 */
export async function finalizeExecution(executionSessionId: string, result: ExecutionResult): Promise<RunExecutionOutcome & { outcome: "finished" }> {
  const session = await prisma.executionSession.findUniqueOrThrow({ where: { id: executionSessionId } });
  if (!FINALIZABLE.includes(session.status)) return { outcome: "finished", status: result.status, nextExecutionSessionId: null };
  const companyId = session.companyId;
  const evBase = { companyId, taskId: session.taskId, employeeId: session.employeeId };
  const usage = result.usage ?? emptyUsage();

  const artifactRows: Prisma.ArtifactCreateManyInput[] = [];
  for (const a of result.artifacts ?? []) {
    const content = a.content ?? "";
    const sizeBytes = Buffer.byteLength(content, "utf8");
    const sha256 = content ? createHash("sha256").update(content).digest("hex") : null;
    let storagePath: string | null = null;
    let inline: string | null = content || null;
    if (sizeBytes > INLINE_LIMIT) {
      storagePath = artifactPath(companyId, session.taskId, `${session.id}-${a.name}`);
      await mkdir(path.dirname(storagePath), { recursive: true });
      await writeFile(storagePath, content, "utf8");
      inline = null;
    }
    artifactRows.push({ companyId, taskId: session.taskId, executionSessionId: session.id, name: truncate(a.name, 200), kind: a.kind, mimeType: a.mimeType ?? "text/plain", content: inline, storagePath, sizeBytes, sha256 });
  }
  const succeeded = result.status === "SUCCEEDED";
  const reviewer = succeeded ? await pickReviewer(companyId, session.employeeId) : null;
  const summary = truncate(result.summary || "(no summary)", 8000);

  const done = await withEvents(async (tx, emit) => {
    const won = await tx.executionSession.updateMany({
      where: { id: session.id, status: { in: FINALIZABLE } },
      data: {
        status: result.status,
        endedAt: new Date(),
        leaseExpiresAt: null,
        usage: usage as unknown as Prisma.InputJsonValue,
        costUsd: usage.costUsd,
        costSource: usage.costSource,
        error: result.error ? truncate(result.error, 2000) : null,
        errorKind: succeeded ? null : (result.errorKind ?? null),
        providerSessionId: result.providerSessionId ?? undefined,
      },
    });
    if (won.count !== 1) return null;
    const ids: string[] = [];
    for (const row of artifactRows) ids.push((await tx.artifact.create({ data: row, select: { id: true } })).id);
    await recordUsage({ companyId, employeeId: session.employeeId, taskId: session.taskId, executionSessionId: session.id, provider: session.provider, usage }, tx);
    await tx.approvalRequest.updateMany({ where: { executionSessionId: session.id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: new Date(), note: "execution ended" } });
    await emit({ ...evBase, type: "execution.ended", payload: { executionSessionId: session.id, status: result.status, costUsd: usage.costUsd, costSource: usage.costSource, error: result.error ?? null, errorKind: result.errorKind ?? null, artifactIds: ids, numTurns: result.numTurns ?? null } });
    let movedToReview = false;
    if (succeeded) {
      const t = await tx.task.findUnique({ where: { id: session.taskId }, select: { status: true } });
      if (t?.status === "WAITING_APPROVAL") await moveTask(tx, session.taskId, "WAITING_APPROVAL", "IN_PROGRESS");
      if (t && (t.status === "WAITING_APPROVAL" || t.status === "IN_PROGRESS") && (await moveTask(tx, session.taskId, "IN_PROGRESS", "REVIEW", { resultSummary: summary }))) {
        movedToReview = true;
        await emit({ ...evBase, type: "task.handoff", payload: { fromEmployeeId: session.employeeId, toEmployeeId: reviewer?.id ?? null, artifactIds: ids, summary: truncate(summary, 500), status: "REVIEW" } });
      }
    }
    return { movedToReview };
  });
  if (!done) return { outcome: "finished", status: result.status, nextExecutionSessionId: null };

  if (succeeded) {
    await noteProviderHealthy(session.id).catch(() => false);
    if (done.movedToReview) await enqueueReviewWithRetry(session.taskId);
    return { outcome: "finished", status: "SUCCEEDED" };
  }

  const fresh = await prisma.task.findUnique({ where: { id: session.taskId } });
  if (!fresh || fresh.status === "CANCELLED") return { outcome: "finished", status: result.status };
  const fromStatus = fresh.status as TaskStatus;

  if (result.status === "CANCELLED") {
    await withEvents(async (tx, emit) => {
      if (!(await moveTask(tx, session.taskId, fromStatus, "CANCELLED", { completedAt: new Date(), errorMessage: "Execution cancelled" }))) return;
      await tx.assignment.updateMany({ where: { taskId: session.taskId, status: "ACTIVE" }, data: { status: "CANCELLED", endedAt: new Date() } });
      await emit({ ...evBase, type: "task.cancelled", payload: { status: "CANCELLED", from: fromStatus, note: "Execution cancelled" } });
    });
    await onTaskTerminal(session.taskId);
    return { outcome: "finished", status: "CANCELLED" };
  }
  // Provider conditions: usage/rate limit or expired sign-in → Usage Limit Manager (no attempt consumed, no fallback).
  const provider = providerKindOf(session.provider);
  if (result.status === "FAILED" && provider !== "SIMULATED" && isLimitErrorKind(result.errorKind)) {
    const classified: ClassifiedProviderError = {
      kind: result.errorKind,
      message: result.error ?? result.errorKind,
      resetAt: result.limit?.resetAt ? new Date(result.limit.resetAt) : undefined,
      retryAfterAt: result.limit?.retryAfterAt ? new Date(result.limit.retryAfterAt) : undefined,
      source: result.limit?.source ?? "classified",
    };
    const t = await prisma.task.findUnique({ where: { id: session.taskId }, select: { limitRetries: true } });
    const state = await recordProviderLimit(companyId, provider, classified, { attempt: t?.limitRetries ?? 0, affectedTaskIds: [session.taskId] });
    // Park with the stored window (it carries the backoff when the provider gave no time).
    const park = await parkTaskForProviderLimit(session.taskId, state ? classifiedFromState(state) : classified, { refundAttempt: true, provider });
    if (park.parked || park.blocked) return { outcome: "finished", status: result.status, nextExecutionSessionId: null };
  }
  if (result.status === "FAILED" && result.errorKind === "UNSUPPORTED") {
    // A setup problem (e.g. API key in the runner env in subscription mode, CLI missing): retrying cannot help.
    if (await blockTask(session.taskId, fromStatus, result.error ?? "Unsupported provider setup", { errorKind: "UNSUPPORTED", provider })) {
      return { outcome: "finished", status: result.status, nextExecutionSessionId: null };
    }
  }
  // Spending stops (cost cap / budget) are final: a retry would spend the same budget again.
  const next = await handleExecutionFailure(session.taskId, result.error ?? `Execution ${result.status.toLowerCase()}`, { retry: !isTerminalStop(result) });
  return { outcome: "finished", status: result.status, nextExecutionSessionId: next };
}

/**
 * Pre-start gate for an already-QUEUED session (API/worker path and runner
 * claims): when the provider is limited, the session is CANCELLED (errorKind =
 * the limit), its attempt is granted back and the task is parked. Returns true
 * when parked.
 */
export async function parkQueuedSessionIfLimited(executionSessionId: string, now: Date = new Date()): Promise<boolean> {
  const s = await prisma.executionSession.findUnique({ where: { id: executionSessionId } });
  if (!s || s.status !== "QUEUED") return false;
  const provider = providerKindOf(s.provider);
  if (provider === "SIMULATED") return false;
  const a = await isProviderAvailable(s.companyId, provider, now);
  if (a.available) return false;
  const st = await getProviderLimit(s.companyId, provider);
  const classified = st ? classifiedFromState(st) : classifyProviderError(provider, { text: a.reason ?? "provider limit" });
  const errorKind = classified.kind;
  const u = await prisma.executionSession.updateMany({
    where: { id: s.id, status: "QUEUED" },
    data: { status: "CANCELLED", endedAt: now, error: `Postponed: ${a.reason ?? "provider limit"}`, errorKind },
  });
  if (u.count !== 1) return false;
  await emitEvent(prisma, { companyId: s.companyId, taskId: s.taskId, employeeId: s.employeeId, type: "execution.ended", payload: { executionSessionId: s.id, status: "CANCELLED", errorKind, error: `Postponed: ${a.reason ?? "provider limit"}` } });
  await parkTaskForProviderLimit(s.taskId, classified, { refundAttempt: true, provider });
  return true;
}

/**
 * Execution worker handler. Idempotent: skips terminal, runner-owned or
 * live-leased sessions. Acquires the company semaphore (returns `deferred`
 * when full), holds a lease with heartbeats, runs the adapter with hard
 * limits (timeout → TIMED_OUT, cost cap → FAILED, cancel flag → CANCELLED),
 * persists events, approvals, artifacts and usage, then moves the task to
 * REVIEW (+handoff, review job) or retries/fails it.
 */
export async function runExecution(executionSessionId: string, opts: RunExecutionOptions = {}): Promise<RunExecutionOutcome> {
  const leaseMs = opts.leaseMs ?? 60_000;
  const session = await prisma.executionSession.findUnique({ where: { id: executionSessionId }, include: { task: true } });
  if (!session) return { outcome: "skipped", reason: "missing" };
  if (TERMINAL.includes(session.status)) return { outcome: "skipped", reason: `already ${session.status}` };
  if (session.mode === "LOCAL_RUNNER") return { outcome: "skipped", reason: "owned by a local runner" };
  const { task } = session;
  const companyId = session.companyId;

  if (session.cancelRequested || task.status === "CANCELLED") {
    await prisma.executionSession.update({ where: { id: session.id }, data: { status: "CANCELLED", endedAt: new Date(), error: "cancelled before start" } });
    return { outcome: "finished", status: "CANCELLED" };
  }
  if ((session.status === "RUNNING" || session.status === "WAITING_APPROVAL") && session.leaseExpiresAt && session.leaseExpiresAt.getTime() > Date.now()) {
    return { outcome: "skipped", reason: "leased by a live worker" };
  }

  // Usage Limit Manager gate: never start (or fall back) while the provider is limited.
  if (session.status === "QUEUED" && (await parkQueuedSessionIfLimited(session.id))) return { outcome: "parked", reason: "provider limit" };

  const companySettings = await getCompanySettings(companyId);
  if (!(await acquireExecutionSlot(companyId, session.id, companySettings.maxConcurrentExecutions, leaseMs))) {
    return { outcome: "deferred", delayMs: opts.deferMs ?? 5000 };
  }

  const now = new Date();
  const claimed = await prisma.executionSession.updateMany({
    where: { id: session.id, status: { in: ["QUEUED", "RUNNING", "WAITING_APPROVAL"] }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
    data: { status: "RUNNING", leaseExpiresAt: new Date(now.getTime() + leaseMs), heartbeatAt: now, startedAt: session.startedAt ?? now },
  });
  if (claimed.count !== 1) {
    await releaseExecutionSlot(companyId, session.id);
    return { outcome: "skipped", reason: "claimed elsewhere" };
  }

  const ref: SessionRef = { executionSessionId: session.id, companyId, taskId: task.id, employeeId: session.employeeId };
  const ac = new AbortController();
  const timers: NodeJS.Timeout[] = [];
  let pendingApprovals = 0;
  let latestUsage: UsageReport | null = null;
  let costCap = companySettings.defaultMaxCostUsd;
  const deadline = Date.now() + task.timeoutSec * 1000;

  let result: ExecutionResult;
  try {
    timers.push(setTimeout(() => ac.abort("timeout"), task.timeoutSec * 1000));
    let lastBeat = Date.now();
    timers.push(
      setInterval(() => {
        void (async () => {
          try {
            const s = await prisma.executionSession.findUnique({ where: { id: session.id }, select: { cancelRequested: true } });
            if (s?.cancelRequested && !ac.signal.aborted) ac.abort("cancel");
            if (Date.now() - lastBeat >= (opts.heartbeatMs ?? 15_000)) {
              lastBeat = Date.now();
              // Guarded: never revive a session that maintenance already failed or re-queued.
              const beat = await prisma.executionSession.updateMany({
                where: { id: session.id, status: { in: ["RUNNING", "WAITING_APPROVAL"] } },
                data: { leaseExpiresAt: new Date(Date.now() + leaseMs), heartbeatAt: new Date() },
              });
              if (beat.count === 0) {
                if (!ac.signal.aborted) ac.abort("lease_lost");
                return;
              }
              await refreshExecutionSlot(companyId, session.id, leaseMs);
            }
          } catch (err) {
            logger.warn({ err: (err as Error).message, executionSessionId }, "heartbeat failed");
          }
        })();
      }, Math.min(opts.controlPollMs ?? 2000, opts.heartbeatMs ?? 15_000)),
    );

    const prep = await prepareExecutionInput(session.id, { includeSecret: session.mode === "API" });
    costCap = prep.costCapUsd;
    const adapter = opts.adapter ?? getProviderAdapter(providerKindOf(session.provider));

    const requestApproval: ExecutionHooks["requestApproval"] = async (r) => {
      if (prep.settings.autoApprove && r.kind === "TOOL_USE") return { approved: true, note: "auto-approved by connection settings" };
      pendingApprovals += 1;
      const approval = await openApproval(ref, r, new Date(deadline));
      let decided: { status: string; note: string | null } = { status: "PENDING", note: null };
      try {
        for (;;) {
          await sleep(opts.approvalPollMs ?? 2000, ac.signal);
          const row = await prisma.approvalRequest.findUnique({ where: { id: approval.id }, select: { status: true, note: true } });
          if (!row) break;
          if (row.status !== "PENDING") {
            decided = row;
            break;
          }
          if (Date.now() > deadline) {
            await prisma.approvalRequest.updateMany({ where: { id: approval.id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: new Date() } });
            await emitEvent(prisma, { companyId, taskId: task.id, employeeId: session.employeeId, type: "task.approval_decided", payload: { approvalId: approval.id, decision: "EXPIRED" } });
            decided = { status: "EXPIRED", note: "expired" };
            break;
          }
        }
      } catch {
        await prisma.approvalRequest.updateMany({ where: { id: approval.id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: new Date(), note: "execution stopped" } });
        decided = { status: "EXPIRED", note: "execution stopped" };
      } finally {
        pendingApprovals -= 1;
        if (pendingApprovals === 0 && !ac.signal.aborted) await resumeAfterApprovals(ref, decided.status === "APPROVED" ? "approval granted" : "approval not granted");
      }
      return { approved: decided.status === "APPROVED", note: decided.note ?? undefined };
    };
    const onUsage = async (u: UsageReport) => {
      latestUsage = u;
      await persistUsage(ref, u);
      if (u.costUsd !== null && u.costUsd > costCap && !ac.signal.aborted) ac.abort("cost_cap");
    };

    if (companySettings.requireApprovalForPaidExecution && session.mode === "API") {
      const d = await requestApproval({ kind: "COST", title: `Allow a paid ${session.provider} run (cap $${costCap.toFixed(2)})`, payload: { provider: session.provider, model: session.model, costCapUsd: costCap } });
      if (!d.approved) throw new Error("Paid execution was not approved");
    }

    result = await adapter.run(
      { executionSessionId: session.id, companyId, taskId: task.id, employeeId: session.employeeId, systemPrompt: prep.systemPrompt, taskBrief: prep.taskBrief, memoryContext: prep.memoryContext, workspacePath: prep.workspacePath, model: prep.model, settings: prep.settings, secret: prep.secret, signal: ac.signal, resumeSessionId: prep.resumeSessionId, authMode: prep.authMode ?? undefined },
      { onEvent: (e) => persistProviderEvent(ref, e), onUsage, requestApproval },
    );
  } catch (err) {
    result = { status: ac.signal.aborted ? abortStatus(ac.signal) : "FAILED", summary: "", usage: latestUsage ?? emptyUsage("unavailable", session.model ?? undefined), artifacts: [], error: (err as Error).message };
  } finally {
    for (const t of timers) clearTimeout(t);
    await releaseExecutionSlot(companyId, session.id).catch(() => undefined);
  }

  if (ac.signal.aborted && ac.signal.reason === "lease_lost") {
    // The server already failed or re-queued this session: its outcome belongs to whoever owns it now.
    logger.warn({ executionSessionId }, "execution lease lost; result discarded");
    return { outcome: "skipped", reason: "lease lost" };
  }
  if (ac.signal.aborted) {
    const costCapHit = ac.signal.reason === "cost_cap";
    result = {
      ...result,
      status: abortStatus(ac.signal),
      error: costCapHit ? `Stopped: cost cap of $${costCap.toFixed(2)} reached` : ac.signal.reason === "timeout" ? `Stopped: timeout of ${task.timeoutSec}s reached` : (result.error ?? "Cancelled"),
      ...(costCapHit ? { terminal: true } : {}),
    };
  }
  if (!result.usage) result.usage = latestUsage ?? emptyUsage();
  return finalizeExecution(session.id, result);
}
