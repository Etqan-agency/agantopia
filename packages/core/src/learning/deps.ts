/**
 * Thin, overridable wrappers around cross-slice services (events, queues,
 * crypto). Each wrapper tries a dynamic import of the owning module and falls
 * back to a safe local behaviour with a logged warning, so the learning engine
 * compiles and runs standalone (and in tests) even before those modules exist.
 */
import { pino } from "pino";
import { prisma, Prisma, type Db } from "@agentopia/db";
import type { EventType } from "@agentopia/shared";

export const log = pino({ name: "learning", level: process.env.LOG_LEVEL ?? (process.env.VITEST ? "silent" : "info") });

export type EmitInput = {
  companyId: string;
  employeeId?: string | null;
  taskId?: string | null;
  type: EventType;
  payload: Record<string, unknown>;
};

export type LearningDeps = {
  emitEvent: (db: Db, input: EmitInput) => Promise<unknown>;
  enqueueLearningRun: (runId: string) => Promise<unknown>;
  upsertLearningScheduler: (scheduleId: string, spec: { pattern: string; tz: string }, data: { scheduleId: string }) => Promise<unknown>;
  removeLearningScheduler: (scheduleId: string) => Promise<unknown>;
  decryptSecret: (encrypted: string) => string | Promise<string>;
};

type AnyModule = Record<string, unknown>;

/**
 * Lazy loaders with string-literal specifiers so bundlers (Next/Turbopack) and
 * tsx both resolve them. A failed load falls back to the local behaviour below.
 */
const loaders = {
  events: () => import("../events/emit") as Promise<AnyModule>,
  queues: () => import("../queue/queues") as Promise<AnyModule>,
  crypto: () => import("../crypto/secrets") as Promise<AnyModule>,
};
type ModuleKey = keyof typeof loaders;
const moduleCache = new Map<ModuleKey, AnyModule | null>();

async function load(key: ModuleKey): Promise<AnyModule | null> {
  if (moduleCache.has(key)) return moduleCache.get(key) ?? null;
  let mod: AnyModule | null = null;
  try {
    mod = await loaders[key]();
  } catch (err) {
    log.warn({ module: key, err: String(err) }, "cross-slice module unavailable; using fallback");
  }
  moduleCache.set(key, mod);
  return mod;
}

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  log.warn(msg);
}

async function callExport<T>(key: ModuleKey, name: string, args: unknown[]): Promise<{ ok: true; value: T } | { ok: false }> {
  const mod = await load(key);
  const fn = mod?.[name];
  if (typeof fn !== "function") return { ok: false };
  return { ok: true, value: (await (fn as (...a: unknown[]) => unknown)(...args)) as T };
}

const defaults: LearningDeps = {
  async emitEvent(db, input) {
    const r = await callExport("events", "emitEvent", [db, input]);
    if (r.ok) return r.value;
    warnOnce("emit", "events/emit not available; writing TaskEvent directly without broadcast");
    return db.taskEvent.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId ?? null,
        taskId: input.taskId ?? null,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  },
  async enqueueLearningRun(runId) {
    const r = await callExport("queues", "enqueueLearningRun", [runId]);
    if (!r.ok) warnOnce("enqueue", "queue/queues.enqueueLearningRun not available; run left QUEUED");
    return r.ok ? r.value : undefined;
  },
  async upsertLearningScheduler(scheduleId, spec, data) {
    const r = await callExport("queues", "upsertLearningScheduler", [scheduleId, spec, data]);
    if (!r.ok) warnOnce("upsert", "queue/queues.upsertLearningScheduler not available; schedule not synced");
    return r.ok ? r.value : undefined;
  },
  async removeLearningScheduler(scheduleId) {
    const r = await callExport("queues", "removeLearningScheduler", [scheduleId]);
    if (!r.ok) warnOnce("remove", "queue/queues.removeLearningScheduler not available; schedule not synced");
    return r.ok ? r.value : undefined;
  },
  async decryptSecret(encrypted) {
    const r = await callExport<string>("crypto", "decryptSecret", [encrypted]);
    if (!r.ok) throw new Error("crypto/secrets.decryptSecret not available");
    return r.value;
  },
};

let current: LearningDeps = { ...defaults };

/** Active dependency set (overridable in tests or by the worker). */
export function deps(): LearningDeps {
  return current;
}

/** Override some dependencies; returns a function restoring the previous set. */
export function setLearningDeps(overrides: Partial<LearningDeps>): () => void {
  const prev = current;
  current = { ...current, ...overrides };
  return () => {
    current = prev;
  };
}

/** Emit an event; never throws (event delivery must not fail a learning run). */
export async function emit(input: EmitInput, db: Db = prisma): Promise<void> {
  try {
    await current.emitEvent(db, input);
  } catch (err) {
    log.warn({ err: String(err), type: input.type }, "emit failed");
  }
}
