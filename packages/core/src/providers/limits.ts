/**
 * Usage Limit Manager: one ProviderLimitState row per (company, provider).
 *
 * A subscription (or API) usage/rate limit, or an expired sign-in, parks the
 * affected tasks in WAITING_FOR_PROVIDER_LIMIT (no attempt consumed) until the
 * provider-reported reset / Retry-After time passes, or a bounded backoff
 * (5 min × 2^n, max 60 min) when the provider gave no time. There is no paid
 * fallback: a limited subscription connection is never switched to an API
 * key or another connection. AUTH_EXPIRED stays until a heartbeat/verify shows
 * the user signed in again (or an execution succeeds).
 *
 * The pure classifier lives in ./classify (safe for the local runner).
 */
import { prisma, Prisma, type ProviderLimitState } from "@agentopia/db";
import type { ProviderLimitKind, ProviderLimitPayload, TaskStatus } from "@agentopia/shared";
import { emitEvent, withEvents } from "../events/emit";
import { logger } from "../logging";
import { canTransition } from "../orchestration/state-machine";
import { isLimitErrorKind, type ClassifiedProviderError } from "./classify";

export type LimitProvider = "ANTHROPIC" | "OPENAI" | "SIMULATED";

/** Max automatic re-queues after provider limits before a task is BLOCKED. */
export const MAX_LIMIT_RETRIES = 5;
const BACKOFF_BASE_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 60 * 60_000;

/** Bounded backoff used when the provider reported no reset/retry time: 5 min × 2^n, capped at 60 min. */
export function limitBackoffMs(n: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(n, 10)), BACKOFF_MAX_MS);
}

function limitKindOf(kind: ClassifiedProviderError["kind"]): ProviderLimitKind | null {
  if (kind === "USAGE_LIMIT") return "USAGE_LIMIT";
  if (kind === "RATE_LIMIT") return "RATE_LIMITED";
  if (kind === "AUTH_EXPIRED") return "AUTH_EXPIRED";
  return null;
}

/** ProviderLimitState → classified error (for parking from a stored state). */
export function classifiedFromState(s: Pick<ProviderLimitState, "kind" | "message" | "retryAfterAt" | "resetAt" | "source">): ClassifiedProviderError {
  const kind = s.kind === "RATE_LIMITED" ? "RATE_LIMIT" : s.kind === "USAGE_LIMIT" ? "USAGE_LIMIT" : s.kind === "AUTH_EXPIRED" ? "AUTH_EXPIRED" : "OTHER";
  return { kind, message: s.message ?? "Provider limit", retryAfterAt: s.retryAfterAt ?? undefined, resetAt: s.resetAt ?? undefined, source: s.source === "provider_reported" ? "provider_reported" : "classified" };
}

async function audit(companyId: string, action: string, entityId: string, metadata: object) {
  await prisma.auditLog.create({ data: { companyId, userId: null, action, entityType: "ProviderLimitState", entityId, metadata: metadata as Prisma.InputJsonValue } }).catch(() => undefined);
}

/** Ids of WAITING_FOR_PROVIDER_LIMIT tasks whose assignee uses `provider`. */
export async function waitingTaskIds(companyId: string, provider: LimitProvider): Promise<string[]> {
  const rows = await prisma.task.findMany({
    where: { companyId, status: "WAITING_FOR_PROVIDER_LIMIT", assignee: { providerConnection: { provider } } },
    select: { id: true },
    take: 500,
  });
  return rows.map((r) => r.id);
}

/** Current limit row (null when never limited). */
export async function getProviderLimit(companyId: string, provider: LimitProvider): Promise<ProviderLimitState | null> {
  if (provider === "SIMULATED") return null;
  return prisma.providerLimitState.findUnique({ where: { companyId_provider: { companyId, provider } } });
}

export interface RecordLimitOptions {
  /** Prior automatic re-queues (drives the backoff when no time is reported). */
  attempt?: number;
  /** Tasks to report in the event (default: the provider's waiting tasks). */
  affectedTaskIds?: string[];
  now?: Date;
}

/**
 * Upserts the provider's limit state from a classified error, emits
 * `provider.limit` and writes an audit row. No-op (returns null) for kinds
 * that are not limits (OTHER / UNSUPPORTED / RUNNER_OFFLINE) and for SIMULATED.
 */
export async function recordProviderLimit(companyId: string, provider: LimitProvider, classified: ClassifiedProviderError, opts: RecordLimitOptions = {}): Promise<ProviderLimitState | null> {
  const kind = limitKindOf(classified.kind);
  if (!kind || provider === "SIMULATED") return null;
  const now = opts.now ?? new Date();
  let retryAfterAt = classified.retryAfterAt ?? null;
  const resetAt = classified.resetAt ?? null;
  if (kind !== "AUTH_EXPIRED" && !retryAfterAt && !resetAt) retryAfterAt = new Date(now.getTime() + limitBackoffMs(opts.attempt ?? 0));
  if (kind === "AUTH_EXPIRED") retryAfterAt = null;
  const data = {
    kind,
    message: classified.message.slice(0, 1000),
    retryAfterAt,
    resetAt: kind === "AUTH_EXPIRED" ? null : resetAt,
    source: classified.source,
    lastErrorAt: now,
    ...(classified.utilization !== undefined ? { utilization: classified.utilization } : {}),
    ...(classified.windowLabel !== undefined ? { windowLabel: classified.windowLabel } : {}),
  };
  const row = await prisma.providerLimitState.upsert({
    where: { companyId_provider: { companyId, provider } },
    create: { companyId, provider, ...data },
    update: data,
  });
  const affectedTaskIds = opts.affectedTaskIds ?? (await waitingTaskIds(companyId, provider));
  const payload: ProviderLimitPayload = {
    provider,
    kind,
    message: row.message ?? undefined,
    retryAfterAt: row.retryAfterAt?.toISOString() ?? null,
    resetAt: row.resetAt?.toISOString() ?? null,
    source: classified.source,
    affectedTaskIds,
  };
  await emitEvent(prisma, { companyId, type: "provider.limit", payload });
  await audit(companyId, "provider.limit", row.id, { provider, kind, retryAfterAt: payload.retryAfterAt, resetAt: payload.resetAt, source: classified.source });
  logger.info({ companyId, provider, kind, retryAfterAt: payload.retryAfterAt, resetAt: payload.resetAt }, "provider limit recorded");
  return row;
}

/** Sets the provider back to OK, emits `provider.limit_cleared`. Returns false when it was not limited. */
export async function clearProviderLimit(companyId: string, provider: LimitProvider, reason: string): Promise<boolean> {
  if (provider === "SIMULATED") return false;
  const cur = await getProviderLimit(companyId, provider);
  if (!cur || cur.kind === "OK") return false;
  const u = await prisma.providerLimitState.updateMany({
    where: { id: cur.id, kind: cur.kind, updatedAt: cur.updatedAt },
    data: { kind: "OK", message: reason.slice(0, 1000), retryAfterAt: null, resetAt: null },
  });
  if (u.count !== 1) return false;
  const payload: ProviderLimitPayload = { provider, kind: "OK", message: reason, retryAfterAt: null, resetAt: null, affectedTaskIds: await waitingTaskIds(companyId, provider) };
  await emitEvent(prisma, { companyId, type: "provider.limit_cleared", payload: { ...payload, previousKind: cur.kind } });
  await audit(companyId, "provider.limit_cleared", cur.id, { provider, previousKind: cur.kind, reason });
  return true;
}

/**
 * Stores a provider-reported usage window (e.g. Claude `rate_limit_event`
 * utilization) without changing the limit kind. Never invents values.
 */
export async function recordProviderUsageReport(companyId: string, provider: LimitProvider, r: { utilization?: number; windowLabel?: string; resetAt?: Date }): Promise<void> {
  if (provider === "SIMULATED" || (r.utilization === undefined && !r.windowLabel)) return;
  const cur = await getProviderLimit(companyId, provider);
  const data = {
    utilization: r.utilization ?? null,
    windowLabel: r.windowLabel ?? null,
    ...(r.resetAt && (!cur || cur.kind === "OK") ? { resetAt: r.resetAt } : {}),
  };
  await prisma.providerLimitState.upsert({ where: { companyId_provider: { companyId, provider } }, create: { companyId, provider, kind: "OK", ...data }, update: data });
}

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
  retryAfterAt?: Date;
  resetAt?: Date;
  kind?: ProviderLimitKind;
}

/**
 * Whether new work may start on `provider` for the company. Unavailable while
 * the state is not OK and its retryAfterAt/resetAt is in the future;
 * AUTH_EXPIRED is unavailable until cleared.
 */
export async function isProviderAvailable(companyId: string, provider: LimitProvider, now: Date = new Date()): Promise<ProviderAvailability> {
  const s = await getProviderLimit(companyId, provider);
  return availabilityOf(s, now);
}

/** Pure availability rule for a limit row (exported for tests and the status view). */
export function availabilityOf(s: Pick<ProviderLimitState, "kind" | "message" | "retryAfterAt" | "resetAt"> | null, now: Date = new Date()): ProviderAvailability {
  if (!s || s.kind === "OK") return { available: true };
  if (s.kind === "AUTH_EXPIRED") {
    return { available: false, kind: s.kind, reason: s.message ? `Sign-in required: ${s.message}` : "Sign-in required: the provider rejected the local sign-in" };
  }
  const until = Math.max(s.retryAfterAt?.getTime() ?? 0, s.resetAt?.getTime() ?? 0);
  if (until > now.getTime()) {
    const label = s.kind === "USAGE_LIMIT" ? "Usage limit reached" : "Rate limited";
    return { available: false, kind: s.kind, reason: `${label}${s.message ? `: ${s.message}` : ""}`, retryAfterAt: s.retryAfterAt ?? undefined, resetAt: s.resetAt ?? undefined };
  }
  return { available: true, kind: s.kind, retryAfterAt: s.retryAfterAt ?? undefined, resetAt: s.resetAt ?? undefined };
}

/** Provider of a task's assignee connection (null for simulated / unassigned). */
export async function providerOfTask(taskId: string): Promise<"ANTHROPIC" | "OPENAI" | null> {
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { assignee: { select: { providerConnection: { select: { provider: true } } } } } });
  const p = t?.assignee?.providerConnection?.provider;
  return p === "ANTHROPIC" || p === "OPENAI" ? p : null;
}

/** Ends a task's still-active attempts when it is parked/blocked (queued → CANCELLED, running → cancel requested). */
async function stopActiveSessions(tx: Prisma.TransactionClient, taskId: string, why: string, errorKind: string): Promise<void> {
  await tx.executionSession.updateMany({ where: { taskId, status: "QUEUED" }, data: { status: "CANCELLED", endedAt: new Date(), error: why.slice(0, 2000), errorKind } });
  await tx.executionSession.updateMany({ where: { taskId, status: { in: ["RUNNING", "WAITING_APPROVAL"] } }, data: { cancelRequested: true } });
}

export interface ParkOptions {
  /** True when an attempt was already counted for this run (session started): grants it back. */
  refundAttempt?: boolean;
  provider?: LimitProvider;
}

export type ParkOutcome = { parked: true; limitRetries: number } | { parked: false; blocked: boolean; reason: string };

/**
 * Parks a task in WAITING_FOR_PROVIDER_LIMIT: increments `limitRetries`,
 * grants back the attempt (no attempt consumed), keeps the ACTIVE assignment,
 * emits `task.waiting_provider_limit` and `employee.state` BLOCKED ("provider
 * limit"). Artifacts/usage of the interrupted run are persisted by
 * finalizeExecution before this is called. After MAX_LIMIT_RETRIES automatic
 * re-queues the task is BLOCKED instead ("retry manually").
 */
export async function parkTaskForProviderLimit(taskId: string, classified: ClassifiedProviderError, opts: ParkOptions = {}): Promise<ParkOutcome> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { parked: false, blocked: false, reason: "task not found" };
  const from = task.status as TaskStatus;
  const provider = opts.provider ?? (await providerOfTask(taskId)) ?? "SIMULATED";
  const limitRetries = task.limitRetries + 1;
  if (limitRetries > MAX_LIMIT_RETRIES) {
    const blocked = await blockTask(taskId, from, "Provider limit retries exhausted; retry manually", { errorKind: classified.kind, provider });
    return { parked: false, blocked, reason: "retries exhausted" };
  }
  const path = pathTo(from, "WAITING_FOR_PROVIDER_LIMIT");
  if (!path) return { parked: false, blocked: false, reason: `cannot park from ${from}` };
  const ok = await withEvents(async (tx, emit) => {
    let cur = from;
    for (const next of path) {
      const r = await tx.task.updateMany({ where: { id: taskId, status: cur }, data: { status: next } });
      if (r.count !== 1) return false;
      cur = next;
    }
    await stopActiveSessions(tx, taskId, `Postponed: ${classified.message}`, classified.kind);
    await tx.task.update({
      where: { id: taskId },
      data: {
        limitRetries,
        errorMessage: classified.message.slice(0, 2000),
        ...(opts.refundAttempt ? { maxAttempts: { increment: 1 } } : {}),
      },
    });
    await emit({
      companyId: task.companyId,
      taskId,
      employeeId: task.assigneeId,
      type: "task.waiting_provider_limit",
      payload: {
        status: "WAITING_FOR_PROVIDER_LIMIT",
        from,
        provider,
        kind: classified.kind,
        message: classified.message,
        resetAt: classified.resetAt?.toISOString() ?? null,
        retryAfterAt: classified.retryAfterAt?.toISOString() ?? null,
        source: classified.source,
        attempt: limitRetries,
      },
    });
    if (task.assigneeId) await emit({ companyId: task.companyId, taskId, employeeId: task.assigneeId, type: "employee.state", payload: { state: "BLOCKED", taskId, reason: "provider limit" } });
    return true;
  });
  return ok ? { parked: true, limitRetries } : { parked: false, blocked: false, reason: "task changed concurrently" };
}

/** Status path from → to, directly or through IN_PROGRESS (e.g. REVIEW → IN_PROGRESS → WAITING_FOR_PROVIDER_LIMIT). */
export function pathTo(from: TaskStatus, to: TaskStatus): TaskStatus[] | null {
  if (from === to) return [];
  if (canTransition(from, to)) return [to];
  if (from === "WAITING_APPROVAL" && canTransition("IN_PROGRESS", to)) return ["IN_PROGRESS", to];
  if (canTransition(from, "IN_PROGRESS") && canTransition("IN_PROGRESS", to)) return ["IN_PROGRESS", to];
  return null;
}

/** Moves a task to BLOCKED with a message (and records why on Task.plan). Emits task.blocked + employee.state BLOCKED. */
export async function blockTask(taskId: string, from: TaskStatus, message: string, meta: { errorKind: string; provider?: string }): Promise<boolean> {
  const path = pathTo(from, "BLOCKED");
  if (!path) return false;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { companyId: true, assigneeId: true, plan: true } });
  if (!task) return false;
  return withEvents(async (tx, emit) => {
    let cur = from;
    for (const next of path) {
      const r = await tx.task.updateMany({ where: { id: taskId, status: cur }, data: { status: next } });
      if (r.count !== 1) return false;
      cur = next;
    }
    await stopActiveSessions(tx, taskId, message, meta.errorKind);
    const plan = { ...((task.plan as object | null) ?? {}), blockedKind: meta.errorKind, blockedProvider: meta.provider ?? null };
    await tx.task.update({ where: { id: taskId }, data: { errorMessage: message.slice(0, 2000), plan: plan as Prisma.InputJsonValue } });
    await emit({ companyId: task.companyId, taskId, employeeId: task.assigneeId, type: "task.blocked", payload: { status: "BLOCKED", from, message, errorKind: meta.errorKind, provider: meta.provider ?? null } });
    if (task.assigneeId) await emit({ companyId: task.companyId, taskId, employeeId: task.assigneeId, type: "employee.state", payload: { state: "BLOCKED", taskId, reason: meta.errorKind === "RUNNER_OFFLINE" ? "runner offline" : "provider limit" } });
    return true;
  });
}

type StartFn = (companyId: string, taskId: string) => Promise<unknown>;

/**
 * Moves one WAITING task back to ASSIGNED and starts a new execution (the
 * execution gate re-checks availability). Over MAX_LIMIT_RETRIES → BLOCKED.
 */
export async function releaseWaitingTask(taskId: string, start: StartFn, reason = "provider limit window passed"): Promise<"released" | "blocked" | "skipped"> {
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || t.status !== "WAITING_FOR_PROVIDER_LIMIT") return "skipped";
  if (t.limitRetries > MAX_LIMIT_RETRIES) {
    return (await blockTask(taskId, "WAITING_FOR_PROVIDER_LIMIT", "Provider limit retries exhausted; retry manually", { errorKind: "USAGE_LIMIT" })) ? "blocked" : "skipped";
  }
  const moved = await withEvents(async (tx, emit) => {
    const r = await tx.task.updateMany({ where: { id: taskId, status: "WAITING_FOR_PROVIDER_LIMIT" }, data: { status: "ASSIGNED", errorMessage: null } });
    if (r.count !== 1) return false;
    await emit({ companyId: t.companyId, taskId, employeeId: t.assigneeId, type: "task.progress", payload: { status: "ASSIGNED", from: "WAITING_FOR_PROVIDER_LIMIT", message: `Resuming: ${reason}` } });
    return true;
  });
  if (!moved) return "skipped";
  try {
    await start(t.companyId, taskId);
  } catch (err) {
    logger.warn({ err: (err as Error).message, taskId }, "resume after provider limit could not start");
    const cur = await prisma.task.findUnique({ where: { id: taskId }, select: { status: true } });
    if (cur?.status === "ASSIGNED") await blockTask(taskId, "ASSIGNED", `Could not resume after provider limit: ${(err as Error).message}`, { errorKind: "OTHER" });
    return "blocked";
  }
  return "released";
}

/**
 * Maintenance (every 60s): for each company/provider whose limit window has
 * passed, moves WAITING tasks back to ASSIGNED and starts them (bounded by
 * MAX_LIMIT_RETRIES, else BLOCKED). `opts.start` defaults to startExecution;
 * `opts.companyId` scopes the sweep to one company.
 */
export async function releaseWaitingTasks(now: Date = new Date(), opts: { companyId?: string; start?: StartFn } = {}): Promise<{ released: number; blocked: number; stillWaiting: number }> {
  const startFn: StartFn = opts.start ?? (async (c, t) => (await import("../orchestration/service")).startExecution(c, t));
  const tasks = await prisma.task.findMany({
    where: { status: "WAITING_FOR_PROVIDER_LIMIT", ...(opts.companyId ? { companyId: opts.companyId } : {}) },
    select: { id: true, companyId: true, assignee: { select: { providerConnection: { select: { provider: true } } } } },
    orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
    take: 200,
  });
  const avail = new Map<string, ProviderAvailability>();
  const out = { released: 0, blocked: 0, stillWaiting: 0 };
  for (const t of tasks) {
    const provider = (t.assignee?.providerConnection?.provider ?? "SIMULATED") as LimitProvider;
    const key = `${t.companyId}:${provider}`;
    if (!avail.has(key)) avail.set(key, await isProviderAvailable(t.companyId, provider, now));
    if (!avail.get(key)!.available) {
      out.stillWaiting += 1;
      continue;
    }
    const r = await releaseWaitingTask(t.id, startFn);
    if (r === "released") out.released += 1;
    else if (r === "blocked") out.blocked += 1;
  }
  return out;
}

const healthyChecked = new Set<string>();

/**
 * Called on the first assistant output of a session (and on success): when
 * the provider is limited and this session started after the limit was
 * recorded, the provider demonstrably works again → clearProviderLimit.
 */
export async function noteProviderHealthy(executionSessionId: string): Promise<boolean> {
  if (healthyChecked.has(executionSessionId)) return false;
  healthyChecked.add(executionSessionId);
  if (healthyChecked.size > 5000) healthyChecked.clear();
  const s = await prisma.executionSession.findUnique({ where: { id: executionSessionId }, select: { companyId: true, provider: true, startedAt: true, createdAt: true } });
  if (!s || s.provider === "simulated") return false;
  const provider = s.provider === "anthropic" ? "ANTHROPIC" : "OPENAI";
  const st = await getProviderLimit(s.companyId, provider);
  if (!st || st.kind === "OK") return false;
  const started = s.startedAt ?? s.createdAt;
  if (st.lastErrorAt && started.getTime() <= st.lastErrorAt.getTime()) return false;
  return clearProviderLimit(s.companyId, provider, "Execution started successfully after the limit");
}
