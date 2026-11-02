/**
 * Execution gate (no paid fallback). Before an attempt starts:
 *  - SUBSCRIPTION_CLI / local-runner connections need an ONLINE runner whose
 *    detected tool can execute for the provider; otherwise the task is BLOCKED
 *    with errorKind RUNNER_OFFLINE ("Start the local runner on your machine")
 *    and maintenance unblocks it when such a runner comes online.
 *  - A provider under a usage/rate limit (or expired sign-in) parks the task
 *    in WAITING_FOR_PROVIDER_LIMIT.
 * Nothing here ever switches a connection to API mode or to another connection.
 */
import { prisma, type Runner } from "@agentopia/db";
import type { RunnerToolInfo, TaskStatus } from "@agentopia/shared";
import { logger } from "../logging";
import { blockTask, isProviderAvailable, type ProviderAvailability } from "../providers/limits";
import type { ExecutionTarget } from "./common";

export const RUNNER_OFFLINE_MESSAGE = "Start the local runner on your machine";

type CapsLike = { providers?: string[]; auth?: string; tools?: { claude?: RunnerToolInfo; codex?: RunnerToolInfo } };

/** The runner's detected tool for a provider (undefined for legacy runners that report no tools). */
export function runnerToolFor(capabilities: unknown, provider: "ANTHROPIC" | "OPENAI"): RunnerToolInfo | undefined {
  const caps = (capabilities ?? {}) as CapsLike;
  return provider === "ANTHROPIC" ? caps.tools?.claude : caps.tools?.codex;
}

/**
 * Whether a runner can execute jobs for `provider`: listed in `providers`
 * (when given) and, when the runner reports tools, `executionAvailable`.
 * Legacy runners without `tools` are trusted on `providers` alone.
 * A runner started with `--auth env` (API keys from its shell, billed per
 * token) never counts for a SUBSCRIPTION_CLI target: a plan task must not run
 * on a machine key.
 */
export function runnerCanExecute(capabilities: unknown, provider: "ANTHROPIC" | "OPENAI", authMode?: "SUBSCRIPTION_CLI" | "API_KEY" | null): boolean {
  const caps = (capabilities ?? {}) as CapsLike;
  if (authMode === "SUBSCRIPTION_CLI" && caps.auth === "env") return false;
  if (Array.isArray(caps.providers) && caps.providers.length && !caps.providers.includes(provider)) return false;
  const tool = runnerToolFor(capabilities, provider);
  return tool ? tool.executionAvailable === true : true;
}

/** ONLINE, non-revoked runners of the company able to execute for `provider` (and the connection's auth mode). */
export async function availableRunners(companyId: string, provider: "ANTHROPIC" | "OPENAI", authMode?: "SUBSCRIPTION_CLI" | "API_KEY" | null): Promise<Runner[]> {
  const rows = await prisma.runner.findMany({ where: { companyId, status: "ONLINE", revokedAt: null } });
  return rows.filter((r) => runnerCanExecute(r.capabilities, provider, authMode));
}

export type GateResult = { ok: true } | { ok: false; reason: "runner_offline"; message: string } | { ok: false; reason: "limit"; availability: ProviderAvailability };

/** Checks runner presence (LOCAL_RUNNER) and the provider limit (LOCAL_RUNNER / API). SIMULATED always passes. */
export async function gateExecution(companyId: string, target: Pick<ExecutionTarget, "mode" | "provider"> & Partial<Pick<ExecutionTarget, "authMode">>, now: Date = new Date()): Promise<GateResult> {
  if (target.mode === "SIMULATED" || target.provider === "SIMULATED") return { ok: true };
  const availability = await isProviderAvailable(companyId, target.provider, now);
  if (!availability.available) return { ok: false, reason: "limit", availability };
  if (target.mode === "LOCAL_RUNNER") {
    const runners = await availableRunners(companyId, target.provider, target.authMode);
    if (!runners.length) return { ok: false, reason: "runner_offline", message: RUNNER_OFFLINE_MESSAGE };
  }
  return { ok: true };
}

/** BLOCKED + errorKind RUNNER_OFFLINE (auto-unblocked by releaseRunnerOfflineTasks). */
export async function blockForRunnerOffline(taskId: string, from: TaskStatus, provider: "ANTHROPIC" | "OPENAI"): Promise<boolean> {
  const tool = provider === "ANTHROPIC" ? "Claude Code" : "Codex";
  return blockTask(taskId, from, `${RUNNER_OFFLINE_MESSAGE} (no online runner can run ${tool} for this company)`, { errorKind: "RUNNER_OFFLINE", provider });
}

type StartFn = (companyId: string, taskId: string) => Promise<unknown>;

/**
 * Maintenance: BLOCKED tasks whose block reason is RUNNER_OFFLINE are moved
 * back to ASSIGNED and started (new QUEUED session) once an ONLINE runner can
 * execute their provider.
 */
export async function releaseRunnerOfflineTasks(opts: { companyId?: string; start?: StartFn } = {}): Promise<{ released: number; waiting: number }> {
  const startFn: StartFn = opts.start ?? (async (c, t) => (await import("./service")).startExecution(c, t));
  const tasks = await prisma.task.findMany({
    where: { status: "BLOCKED", errorMessage: { startsWith: RUNNER_OFFLINE_MESSAGE }, ...(opts.companyId ? { companyId: opts.companyId } : {}) },
    select: { id: true, companyId: true, plan: true, assigneeId: true, assignee: { select: { providerConnection: { select: { provider: true, authMode: true } } } } },
    orderBy: { updatedAt: "asc" },
    take: 200,
  });
  const out = { released: 0, waiting: 0 };
  const cache = new Map<string, boolean>();
  for (const t of tasks) {
    const plan = (t.plan ?? {}) as { blockedKind?: string };
    const provider = t.assignee?.providerConnection?.provider;
    const authMode = t.assignee?.providerConnection?.authMode ?? null;
    if (plan.blockedKind !== "RUNNER_OFFLINE" || !t.assigneeId || (provider !== "ANTHROPIC" && provider !== "OPENAI")) continue;
    const key = `${t.companyId}:${provider}:${authMode ?? ""}`;
    if (!cache.has(key)) cache.set(key, (await availableRunners(t.companyId, provider, authMode)).length > 0);
    if (!cache.get(key)) {
      out.waiting += 1;
      continue;
    }
    const nextPlan = { ...(t.plan as object), blockedKind: null, blockedProvider: null };
    const moved = await prisma.task.updateMany({ where: { id: t.id, status: "BLOCKED" }, data: { status: "ASSIGNED", errorMessage: null, plan: nextPlan } });
    if (moved.count !== 1) continue;
    try {
      await startFn(t.companyId, t.id);
      out.released += 1;
    } catch (err) {
      logger.warn({ err: (err as Error).message, taskId: t.id }, "runner-offline release could not start");
    }
  }
  return out;
}
