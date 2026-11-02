/**
 * Single integration seam between the web layer and `@agentopia/core`.
 *
 * Core is built in parallel; every call goes through this file so signature
 * changes are fixed in one place. Modules are loaded with literal dynamic
 * imports (bundler-resolvable) and a missing module surfaces as a 503
 * `core_unavailable` error instead of crashing unrelated routes. Where a safe
 * local fallback exists (event persistence) it is used and logged once.
 */
import { prisma, Prisma, type Db } from "@agentopia/db";
import type { EventType, TaskEvent } from "@agentopia/shared";
import { ApiError } from "./errors";

export { encryptSecret, decryptSecret, secretLast4, hashToken, generateToken } from "@agentopia/core/crypto/secrets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type AnyModule = Record<string, unknown>;

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[core-seam] ${msg}`);
}

async function fn(loader: () => Promise<AnyModule>, mod: string, name: string): Promise<AnyFn | null> {
  try {
    const m = await loader();
    const f = m?.[name];
    return typeof f === "function" ? (f as AnyFn) : null;
  } catch (err) {
    warnOnce(`${mod}:${name}`, `${mod} could not be loaded (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
}

async function required(loader: () => Promise<AnyModule>, mod: string, name: string): Promise<AnyFn> {
  const f = await fn(loader, mod, name);
  if (!f) throw new ApiError(503, "core_unavailable", `${mod}.${name} is not available yet`);
  return f;
}

// Literal specifiers so Next.js can bundle them. @ts-ignore keeps the web
// typecheck green while core modules are still being written.
// prettier-ignore
const L = {
  emit: () => import("@agentopia/core/events/emit") as Promise<AnyModule>,
  bus: () => import("@agentopia/core/events/bus") as Promise<AnyModule>,
  providers: () => import("@agentopia/core/providers/index") as Promise<AnyModule>,
  orchestration: () => import("@agentopia/core/orchestration/service") as Promise<AnyModule>,
  career: () => import("@agentopia/core/orchestration/career") as Promise<AnyModule>,
  queues: () => import("@agentopia/core/queue/queues") as Promise<AnyModule>,
  schedule: () => import("@agentopia/core/learning/schedule") as Promise<AnyModule>,
  run: () => import("@agentopia/core/learning/run") as Promise<AnyModule>,
  sources: () => import("@agentopia/core/learning/sources") as Promise<AnyModule>,
  knowledge: () => import("@agentopia/core/memory/knowledge") as Promise<AnyModule>,
  search: () => import("@agentopia/core/memory/search") as Promise<AnyModule>,
  workspace: () => import("@agentopia/core/workspace/paths") as Promise<AnyModule>,
  runnerServer: () => import("@agentopia/core/runner/server") as Promise<AnyModule>,
  runnerProtocol: () => import("@agentopia/core/runner/protocol") as Promise<AnyModule>,
  providerStatus: () => import("@agentopia/core/providers/status") as Promise<AnyModule>,
  limits: () => import("@agentopia/core/providers/limits") as Promise<AnyModule>,
};


export type Actor = { userId: string };

// --- Events --------------------------------------------------------------------
export type EmitInput = {
  companyId: string;
  taskId?: string | null;
  employeeId?: string | null;
  type: EventType;
  payload?: Record<string, unknown>;
};

/** Persist + broadcast an event. Falls back to persisting only. */
export async function emitEvent(input: EmitInput, db: Db = prisma): Promise<unknown> {
  const f = await fn(L.emit, "events/emit", "emitEvent");
  if (f) return f(db, { ...input, payload: input.payload ?? {} });
  warnOnce("emit-fallback", "events/emit unavailable: writing TaskEvent without broadcast");
  return db.taskEvent.create({
    data: {
      companyId: input.companyId,
      taskId: input.taskId ?? null,
      employeeId: input.employeeId ?? null,
      type: input.type,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/** Subscribe to live company events. Returns null when the bus is unavailable (caller polls). */
export async function subscribeCompanyEvents(companyId: string, handler: (e: TaskEvent | Record<string, unknown>) => void): Promise<(() => void) | null> {
  const f = await fn(L.bus, "events/bus", "subscribeCompanyEvents");
  if (!f) return null;
  const unsub = await f(companyId, handler);
  return typeof unsub === "function" ? (unsub as () => void) : () => {};
}

// --- Providers -------------------------------------------------------------------
export type VerifyResult = { ok: boolean; status?: string; models?: string[]; error?: string; message?: string };
export type ProviderAdapterLike = {
  verify(secret?: string): Promise<VerifyResult>;
  listModels(secret?: string): Promise<string[]>;
};

export async function getProviderAdapter(kind: string): Promise<ProviderAdapterLike> {
  const f = await required(L.providers, "providers", "getProviderAdapter");
  return f(kind) as ProviderAdapterLike;
}

// --- Provider status / limits (subscription-first) -------------------------------------
/** Core's `getProviderStatuses(companyId)` → `ProviderStatusView[]`, or null when core is unavailable (caller derives locally). */
export async function getProviderStatusesCore(companyId: string): Promise<unknown[] | null> {
  const f = await fn(L.providerStatus, "providers/status", "getProviderStatuses");
  if (!f) return null;
  const out = await f(companyId);
  return Array.isArray(out) ? out : null;
}

/** Core's `clearProviderLimit` (true when a limit was cleared), or null when unavailable (caller clears locally). */
export async function clearProviderLimitCore(companyId: string, provider: string, reason: string): Promise<boolean | null> {
  const f = await fn(L.limits, "providers/limits", "clearProviderLimit");
  if (!f) return null;
  return (await f(companyId, provider, reason)) === true;
}

// --- Runner protocol (core implementation) ------------------------------------------------------
/** Core `authenticateRunner(authorization)` → full Runner row or null. */
export async function authenticateRunnerCore(authorization: string): Promise<unknown | null> {
  return (await required(L.runnerServer, "runner/server", "authenticateRunner"))(authorization);
}
export type RunnerServerFn = "runnerHeartbeat" | "claimRunnerJob" | "recordRunnerEvents" | "getRunnerControl" | "completeRunnerJob";
export async function runnerServer(name: RunnerServerFn): Promise<AnyFn> {
  return required(L.runnerServer, "runner/server", name);
}
type SafeParser = { safeParse(v: unknown): { success: true; data: unknown } | { success: false; error: unknown } };
/** A zod schema exported by `@agentopia/core/runner/protocol`, or null. */
export async function runnerProtocolSchema(name: "RunnerCapabilitiesSchema" | "RunnerHeartbeatInput" | "RunnerEventsInput" | "RunnerCompleteInput"): Promise<SafeParser | null> {
  try {
    const m = await L.runnerProtocol();
    const s = m?.[name] as SafeParser | undefined;
    return s && typeof s.safeParse === "function" ? s : null;
  } catch (err) {
    warnOnce(`protocol:${name}`, `runner/protocol could not be loaded (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
}

// --- Orchestration -----------------------------------------------------------------
export async function createTask(companyId: string, actor: Actor, input: unknown): Promise<{ id: string } & Record<string, unknown>> {
  return (await required(L.orchestration, "orchestration/service", "createTask"))(companyId, actor, input);
}
export async function taskAction(companyId: string, taskId: string, action: string, actor: Actor, note?: string): Promise<unknown> {
  return (await required(L.orchestration, "orchestration/service", "taskAction"))(companyId, taskId, action, actor, note);
}
export async function decideApproval(companyId: string, approvalId: string, decision: string, actor: Actor, note?: string): Promise<unknown> {
  return (await required(L.orchestration, "orchestration/service", "decideApproval"))(companyId, approvalId, decision, actor, note);
}
export async function enqueueManagerReview(taskId: string): Promise<unknown> {
  return (await required(L.queues, "queue/queues", "enqueueManagerReview"))(taskId);
}
export async function evaluateProgression(employeeId: string): Promise<unknown> {
  const f = await fn(L.career, "orchestration/career", "evaluateProgression");
  return f ? f(employeeId) : null;
}
/** Core owner override (OWNER_OVERRIDE + RANK_CHANGE evidence, audit, event). Returns false if unavailable. */
export async function overrideRank(companyId: string, employeeId: string, rank: string, reason: string, userId: string): Promise<boolean> {
  const f = await fn(L.career, "orchestration/career", "overrideRank");
  if (!f) return false;
  await f(companyId, employeeId, rank, reason, userId);
  return true;
}

// --- Learning ----------------------------------------------------------------------
export async function syncScheduleToQueue(scheduleId: string): Promise<void> {
  const f = await fn(L.schedule, "learning/schedule", "syncScheduleToQueue");
  if (!f) return warnOnce("sync", "learning/schedule.syncScheduleToQueue unavailable; schedule saved but not queued");
  try {
    await f(scheduleId);
  } catch (err) {
    console.error("[core-seam] syncScheduleToQueue failed", err instanceof Error ? err.message : err);
  }
}
export async function computeNextRuns(config: unknown, from: Date, count: number): Promise<Date[]> {
  const f = await fn(L.schedule, "learning/schedule", "computeNextRuns");
  if (!f) return [];
  try {
    const out = await f(config, from, count);
    return Array.isArray(out) ? out.map((d) => new Date(d)) : [];
  } catch {
    return [];
  }
}
/** Returns the created run id, or null when skipped (budget, paused, nothing due). */
export async function startScheduledLearningRun(scheduleId: string, opts?: { trigger?: "scheduled" | "manual"; employeeId?: string }): Promise<string | null> {
  return (await required(L.schedule, "learning/schedule", "startScheduledLearningRun"))(scheduleId, opts ?? {});
}
export async function cancelLearningRun(runId: string, companyId: string): Promise<boolean> {
  return (await required(L.run, "learning/run", "cancelLearningRun"))(runId, { companyId });
}
/** Returns created sources, or null when the core helper is unavailable (caller falls back). */
export async function ensureDefaultSources(companyId: string, employeeId: string, specialty: string): Promise<unknown> {
  const f = await fn(L.sources, "learning/sources", "ensureDefaultSources");
  if (f) return f(companyId, employeeId, specialty);
  return null; // caller falls back to template sources
}

// --- Memory ------------------------------------------------------------------------
export async function createOwnerKnowledge(companyId: string, actor: Actor, input: unknown): Promise<{ id: string } & Record<string, unknown>> {
  return (await required(L.knowledge, "memory/knowledge", "createOwnerKnowledge"))(companyId, actor.userId, input);
}
export async function decideKnowledge(companyId: string, knowledgeId: string, decision: string, actor: Actor, note?: string): Promise<unknown> {
  return (await required(L.knowledge, "memory/knowledge", "decideKnowledge"))(companyId, knowledgeId, decision, actor.userId, note ?? null);
}
export async function deleteKnowledge(companyId: string, knowledgeId: string): Promise<boolean> {
  return (await required(L.knowledge, "memory/knowledge", "deleteKnowledge"))(companyId, knowledgeId);
}
export type MemoryChunk = { id: string; kind: string; title: string; excerpt: string; sourceUrl: string | null; provenance: string; confidence: number; retrievedAt: Date | null; taskId: string | null; projectId: string | null; rank: number };
export async function searchMemory(input: { companyId: string; employeeId?: string; projectId?: string; query: string; limit: number }): Promise<MemoryChunk[]> {
  const out = await (await required(L.search, "memory/search", "searchMemory"))(input);
  return Array.isArray(out) ? out : ((out as { chunks?: MemoryChunk[] })?.chunks ?? []);
}

// --- Workspace ----------------------------------------------------------------------
export async function ensureWorkspace(companyId: string, projectId?: string): Promise<string | null> {
  const f = await fn(L.workspace, "workspace/paths", "ensureWorkspace");
  if (!f) return null;
  try {
    const out = await f(companyId, projectId);
    return typeof out === "string" ? out : ((out as { path?: string })?.path ?? null);
  } catch (err) {
    console.error("[core-seam] ensureWorkspace failed", err instanceof Error ? err.message : err);
    return null;
  }
}
