import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { createAnthropicAdapter } from "@agentopia/core/providers/anthropic";
import { createClaudeCliAdapter } from "@agentopia/core/providers/claude-cli";
import { createCodexAdapter } from "@agentopia/core/providers/openai-codex";
import type { ExecutionHooks, ExecutionResult, ProviderAdapter, UsageReport } from "@agentopia/core/providers/types";
import { emptyUsage } from "@agentopia/core/providers/types";
import { abortStatus, truncate } from "@agentopia/core/providers/util";
import { APPROVAL_TITLE_MAX, boundProviderEvent, clip, EVENT_BATCH_MAX, type RunnerControlResponse, type RunnerEventItem, type RunnerEventsResponse, type RunnerJob } from "@agentopia/core/runner/protocol";
import { ensureWorkspace } from "@agentopia/core/workspace/paths";
import { HttpError, isTransient, request, withRetry, type ClientOptions } from "./http";
import type { DetectedTools } from "./detect";

export interface ExecuteOptions {
  client: ClientOptions;
  /** "subscription" (default; legacy "cli"): the user's own CLI sign-in. "env": API keys from this machine's environment. */
  auth: "subscription" | "env" | "cli";
  /** Latest detection (binary paths, sign-in state). */
  tools?: DetectedTools;
  /** Adapter override (tests). */
  adapterFor?: (job: RunnerJob, plan: ExecutionPlan) => ProviderAdapter;
  log: Logger;
  controlPollMs?: number;
  flushMs?: number;
  /** Base backoff for event-batch retries (ms, tests). Default 1000. */
  retryBaseMs?: number;
}

function envKeyFor(provider: RunnerJob["provider"]): string | undefined {
  if (provider === "ANTHROPIC") return process.env.ANTHROPIC_API_KEY || undefined;
  if (provider === "OPENAI") return process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY || undefined;
  return undefined;
}

const LEASE_LOST_STATUSES = [403, 404, 409];
/** Bound on buffered items kept across transient server failures. */
const MAX_BUFFERED = 2000;

/** Drops the `n` oldest plain provider events (usage, approvals and limit reports are kept). */
function dropOldestEvents(buffer: RunnerEventItem[], n: number): void {
  for (let i = 0; i < buffer.length && n > 0; ) {
    if (buffer[i]!.type === "event") {
      buffer.splice(i, 1);
      n -= 1;
    } else i += 1;
  }
}

export type ExecutionPlan =
  | { kind: "subscription"; authMode: "SUBSCRIPTION_CLI"; binaryPath?: string }
  | { kind: "key"; authMode: "API_KEY"; secret: string }
  | { kind: "refuse"; errorKind: "UNSUPPORTED" | "AUTH_EXPIRED"; error: string };

/**
 * Chooses how this runner executes a job (never a silent switch to paid usage):
 *  - a job carrying a key (explicit API_KEY connection) → SDK adapter with that key;
 *  - subscription runner → the user's own CLI (claude -p / codex exec) with its own sign-in;
 *  - env runner → SDK adapter with this machine's env key (explicitly chosen by `--auth env`),
 *    only for API_KEY jobs: a SUBSCRIPTION_CLI job is refused (UNSUPPORTED).
 */
export function planExecution(job: RunnerJob, auth: ExecuteOptions["auth"], tools?: DetectedTools): ExecutionPlan {
  if (job.secret) return { kind: "key", authMode: "API_KEY", secret: job.secret };
  const mode = auth === "env" ? "env" : "subscription";
  const tool = job.provider === "ANTHROPIC" ? tools?.claude : job.provider === "OPENAI" ? tools?.codex : undefined;
  const name = job.provider === "ANTHROPIC" ? "Claude Code" : "Codex";
  if (mode === "env") {
    // `--auth env` bills this machine's API keys per token: never use them for a subscription (plan) task.
    if (job.authMode === "SUBSCRIPTION_CLI") return { kind: "refuse", errorKind: "UNSUPPORTED", error: "Subscription connection: start the runner with --auth subscription" };
    const secret = envKeyFor(job.provider);
    if (!secret) return { kind: "refuse", errorKind: "UNSUPPORTED", error: `No ${job.provider === "ANTHROPIC" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"} in the runner environment (or start the runner with --auth subscription)` };
    return { kind: "key", authMode: "API_KEY", secret };
  }
  if (job.authMode === "API_KEY") return { kind: "refuse", errorKind: "UNSUPPORTED", error: "This connection is configured for an API key but the server sent none; reconnect it" };
  if (tool && !tool.installed) return { kind: "refuse", errorKind: "UNSUPPORTED", error: tool.reason ?? `${name} is not installed on the runner machine` };
  if (tool && tool.auth === "not_logged_in") return { kind: "refuse", errorKind: "AUTH_EXPIRED", error: tool.reason ?? `${name} is not signed in on the runner machine` };
  return { kind: "subscription", authMode: "SUBSCRIPTION_CLI", binaryPath: tool?.path };
}

function defaultAdapterFor(job: RunnerJob, plan: ExecutionPlan): ProviderAdapter {
  if (job.provider === "ANTHROPIC") return plan.kind === "subscription" ? createClaudeCliAdapter({ binaryPath: plan.binaryPath, auth: "subscription" }) : createAnthropicAdapter();
  return createCodexAdapter();
}

/**
 * Runs one claimed job with the provider adapter, streaming events to the
 * server in batches, polling control for cancel/approvals, and posting the
 * final result. Never throws for job-level failures (they are reported).
 */
export async function executeJob(job: RunnerJob, opts: ExecuteOptions): Promise<ExecutionResult["status"]> {
  const { client, log } = opts;
  const base = `/api/runner/jobs/${encodeURIComponent(job.executionSessionId)}`;
  const jlog = log.child({ job: job.executionSessionId, task: job.taskId, provider: job.provider });
  const ac = new AbortController();
  const buffer: RunnerEventItem[] = [];
  const waiters = new Map<string, (d: { approved: boolean; note?: string }) => void>();
  const clientToApproval = new Map<string, string>();
  let latestUsage: UsageReport | null = null;

  /** 403/404/409: the server no longer leases this job to us (failed, re-queued or revoked). */
  const isLeaseLost = (e: unknown) => e instanceof HttpError && LEASE_LOST_STATUSES.includes(e.status);
  const onLeaseError = (e: unknown) => {
    if (isLeaseLost(e) && !ac.signal.aborted) ac.abort("lease_lost");
  };

  let inFlight: Promise<RunnerEventsResponse | null> | null = null;
  const sendBuffered = async (): Promise<RunnerEventsResponse | null> => {
    let last: RunnerEventsResponse | null = null;
    while (buffer.length) {
      const items = buffer.splice(0, Math.min(buffer.length, EVENT_BATCH_MAX));
      let res: RunnerEventsResponse;
      try {
        res = await withRetry(() => request<RunnerEventsResponse>(client, "POST", `${base}/events`, { items }), 4, opts.retryBaseMs ?? 1000);
      } catch (e) {
        // Transient (network / 5xx / 429 after retries): keep the items for the next flush. Anything else is final.
        if (isTransient(e)) {
          buffer.unshift(...items);
          if (buffer.length > MAX_BUFFERED) dropOldestEvents(buffer, buffer.length - MAX_BUFFERED);
        }
        throw e;
      }
      for (const [cid, aid] of Object.entries(res.approvals ?? {})) clientToApproval.set(cid, aid);
      if (res.cancel && !ac.signal.aborted) ac.abort("cancel");
      last = res;
    }
    return last;
  };
  /** Sends buffered items; waits for an in-flight send first so batches never overlap. */
  const flush = async (): Promise<RunnerEventsResponse | null> => {
    while (inFlight) await inFlight.catch(() => null);
    if (!buffer.length) return null;
    inFlight = sendBuffered().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
  /** Interval flush: skipped while a send is in flight. */
  const tickFlush = () => {
    if (inFlight || !buffer.length) return;
    void flush().catch((e: Error) => {
      onLeaseError(e);
      jlog.warn({ err: e.message }, "event flush failed");
    });
  };

  const applyControl = (ctl: RunnerControlResponse) => {
    if (ctl.cancel && !ac.signal.aborted) ac.abort("cancel");
    for (const a of ctl.approvals) {
      if (a.status === "PENDING") continue;
      for (const [cid, aid] of clientToApproval) {
        if (aid === a.id && waiters.has(cid)) {
          waiters.get(cid)!({ approved: a.status === "APPROVED", note: a.note ?? undefined });
          waiters.delete(cid);
        }
      }
    }
  };

  const timers: NodeJS.Timeout[] = [
    setTimeout(() => ac.abort("timeout"), job.timeoutSec * 1000),
    setInterval(tickFlush, opts.flushMs ?? 1000),
    setInterval(() => {
      void request<RunnerControlResponse>(client, "GET", `${base}/control`)
        .then(applyControl)
        .catch((e: Error) => {
          onLeaseError(e);
          jlog.warn({ err: e.message }, "control poll failed");
        });
    }, opts.controlPollMs ?? 3000),
  ];
  ac.signal.addEventListener("abort", () => {
    for (const [cid, w] of waiters) {
      w({ approved: false, note: "execution stopped" });
      waiters.delete(cid);
    }
  });

  let result: ExecutionResult;
  const plan = planExecution(job, opts.auth, opts.tools);
  const subscription = plan.kind === "subscription";
  try {
    if (plan.kind === "refuse") {
      const e = new Error(plan.error) as Error & { errorKind?: string };
      e.errorKind = plan.errorKind;
      throw e;
    }
    const secret = plan.kind === "key" ? plan.secret : undefined;
    const workspacePath = await ensureWorkspace(job.companyId, job.projectId);
    jlog.info({ workspacePath, attempt: job.attempt }, "job started");
    const hooks: ExecutionHooks = {
      onEvent: (raw) => {
        const e = boundProviderEvent(raw);
        buffer.push({ type: "event", event: e });
        // Early report so the server marks the provider limited right away (the final `complete` parks the task).
        if (e.type === "provider_status" && e.status === "rejected") {
          buffer.push({ type: "provider_limit", errorKind: "USAGE_LIMIT", message: `Subscription usage limit reached${e.windowLabel ? ` (${e.windowLabel})` : ""}`, limit: { resetAt: e.resetAt, source: "provider_reported" } });
        }
      },
      onUsage: (u) => {
        latestUsage = u;
        buffer.push({ type: "usage", usage: u });
        // The cost cap guards paid (API key) runs. Subscription runs report only a client-side estimate and are
        // bounded by max turns, the timeout and the plan's own limits.
        if (!subscription && u.costUsd !== null && u.costUsd > job.costCapUsd && !ac.signal.aborted) ac.abort("cost_cap");
      },
      requestApproval: async (r) => {
        if (job.settings.autoApprove && r.kind === "TOOL_USE") return { approved: true, note: "auto-approved by connection settings" };
        if (ac.signal.aborted) return { approved: false, note: "execution stopped" };
        const cid = randomUUID();
        const decision = new Promise<{ approved: boolean; note?: string }>((resolve) => waiters.set(cid, resolve));
        buffer.push({ type: "approval_request", clientRequestId: cid, approvalKind: r.kind, title: clip(r.title, APPROVAL_TITLE_MAX), payload: r.payload });
        try {
          await flush();
        } catch (e) {
          onLeaseError(e);
          jlog.warn({ err: (e as Error).message }, "approval request flush failed");
          if (ac.signal.aborted) return { approved: false, note: "execution stopped" };
          // Transient: the request stays buffered and the interval flush delivers it; the run waits for the decision.
          if (!isTransient(e)) {
            waiters.delete(cid);
            return { approved: false, note: "the approval request could not be delivered to Agentopia" };
          }
        }
        jlog.info({ title: r.title }, "waiting for owner approval in Agentopia");
        return decision;
      },
    };
    if (ac.signal.aborted) throw new Error(`Stopped before start (${String(ac.signal.reason)})`);
    const adapter = (opts.adapterFor ?? defaultAdapterFor)(job, plan);
    result = await adapter.run(
      {
        executionSessionId: job.executionSessionId,
        companyId: job.companyId,
        taskId: job.taskId,
        employeeId: job.employeeId,
        systemPrompt: job.systemPrompt,
        taskBrief: job.taskBrief,
        memoryContext: job.memoryContext,
        workspacePath,
        model: job.model ?? undefined,
        settings: job.settings,
        secret,
        signal: ac.signal,
        resumeSessionId: job.resumeSessionId,
        authMode: plan.authMode,
        binaryPath: plan.kind === "subscription" ? plan.binaryPath : undefined,
      },
      hooks,
    );
  } catch (err) {
    const errorKind = (err as { errorKind?: ExecutionResult["errorKind"] }).errorKind;
    result = { status: ac.signal.aborted ? abortStatus(ac.signal) : "FAILED", summary: "", usage: latestUsage ?? emptyUsage(), artifacts: [], error: (err as Error).message, ...(errorKind ? { errorKind } : {}) };
  } finally {
    for (const t of timers) clearTimeout(t);
  }
  if (ac.signal.aborted && String(ac.signal.reason) === "lease_lost") {
    // The server already failed or re-queued this job: stop here and do not report a result for it.
    jlog.warn("job lease lost (the server no longer assigns this job to this runner); stopped without reporting");
    return "FAILED";
  }
  if (ac.signal.aborted && !result.errorKind) {
    const reason = String(ac.signal.reason);
    const costCap = reason === "cost_cap";
    result = {
      ...result,
      status: abortStatus(ac.signal),
      error: costCap ? `Stopped: cost cap of $${job.costCapUsd.toFixed(2)} reached` : reason === "timeout" ? `Stopped: timeout of ${job.timeoutSec}s reached` : "Cancelled from Agentopia",
      ...(costCap ? { terminal: true } : {}),
    };
  }

  try {
    await flush();
  } catch (e) {
    jlog.warn({ err: (e as Error).message }, "final event flush failed");
    if (isLeaseLost(e)) return "FAILED";
  }
  const payload = {
    status: result.status,
    summary: truncate(result.summary ?? "", 49_000),
    providerSessionId: result.providerSessionId ?? null,
    usage: result.usage ?? latestUsage ?? emptyUsage(),
    artifacts: result.artifacts.slice(0, 20).map((a) => ({ name: a.name, kind: a.kind, content: a.content ? truncate(a.content, 250 * 1024) : undefined, mimeType: a.mimeType })),
    error: result.error ? truncate(result.error, 4900) : undefined,
    numTurns: result.numTurns,
    ...(result.errorKind ? { errorKind: result.errorKind } : {}),
    ...(result.limit ? { limit: result.limit } : {}),
    ...(result.terminal ? { terminal: true } : {}),
  };
  try {
    await withRetry(() => request(client, "POST", `${base}/complete`, payload), 6, opts.retryBaseMs ?? 1000);
  } catch (e) {
    if (!isLeaseLost(e)) throw e;
    jlog.warn({ err: (e as Error).message }, "job lease lost before completion; result not recorded");
    return "FAILED";
  }
  jlog.info({ status: result.status, errorKind: result.errorKind ?? null, costUsd: payload.usage.costUsd, costSource: payload.usage.costSource }, "job finished");
  return result.status;
}
