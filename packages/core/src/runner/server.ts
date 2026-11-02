import { prisma, Prisma, type Runner } from "@agentopia/db";
import { hashToken } from "../crypto/secrets";
import { DomainError } from "../errors";
import { emitEvent } from "../events/emit";
import { finalizeExecution, openApproval, parkQueuedSessionIfLimited, persistProviderEvent, persistUsage, prepareExecutionInput, resumeAfterApprovals, type SessionRef } from "../orchestration/execute";
import { providerKindOf } from "../orchestration/common";
import { releaseRunnerOfflineTasks, runnerCanExecute, runnerToolFor } from "../orchestration/gate";
import { clearProviderLimit, getProviderLimit, isProviderAvailable, recordProviderLimit } from "../providers/limits";
import { logger } from "../logging";
import { emptyUsage, type ProviderEvent } from "../providers/types";
import type { RunnerToolInfo } from "@agentopia/shared";
import { RunnerCapabilitiesSchema, type RunnerCapabilities, type RunnerCapabilitiesParsed, type RunnerCompleteInputT, type RunnerControlResponse, type RunnerEventItem, type RunnerEventsResponse, type RunnerHeartbeatResponse, type RunnerJob } from "./protocol";

const LEASE_MS = 60_000;

/** Resolves a runner from an `Authorization: Bearer <token>` value (hashed lookup); null when unknown/revoked. */
export async function authenticateRunner(authorization: string | null | undefined): Promise<Runner | null> {
  const m = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!m) return null;
  const r = await prisma.runner.findUnique({ where: { tokenHash: hashToken(m[1]!) } });
  if (!r || r.status === "REVOKED" || r.revokedAt) return null;
  return r;
}

/** Comparable view of capabilities (ignores detectedAt). */
function capsKey(c: Partial<RunnerCapabilitiesParsed> | null | undefined): string {
  if (!c) return "";
  const { detectedAt: _d, ...rest } = c;
  return JSON.stringify(rest);
}

/**
 * Whether a heartbeat's detection shows a NEW sign-in that may clear an
 * AUTH_EXPIRED limit. "logged_in" alone is not enough: on macOS it only means
 * the keychain item exists, which stays true after the provider rejected the
 * login. Clears when the previous detection was not signed in, or when the
 * detection itself changed (e.g. a different auth method) after the error.
 */
export function signInDetectedAgain(prevTool: RunnerToolInfo | undefined, tool: RunnerToolInfo, detectedAt: string | undefined, lastErrorAt: Date | null | undefined): boolean {
  if (tool.auth !== "logged_in") return false;
  if (!prevTool || prevTool.auth !== "logged_in") return true;
  const at = detectedAt ? Date.parse(detectedAt) : Number.NaN;
  const changed = JSON.stringify(prevTool) !== JSON.stringify(tool);
  return changed && Number.isFinite(at) && !!lastErrorAt && at > lastErrorAt.getTime();
}

/**
 * Records a heartbeat: ONLINE + lastSeenAt + normalized capabilities (legacy
 * auth "cli" → "subscription"). Emits runner.status when it comes online and
 * runner.capabilities when detection changed. A tool whose detection changed
 * to "logged_in" clears an AUTH_EXPIRED limit for its provider (see
 * signInDetectedAgain); when the runner can now execute, tasks blocked as RUNNER_OFFLINE are released.
 */
export async function runnerHeartbeat(runner: Runner, capabilities: RunnerCapabilities): Promise<RunnerHeartbeatResponse> {
  const parsed = RunnerCapabilitiesSchema.safeParse(capabilities);
  const caps: RunnerCapabilitiesParsed = parsed.success ? parsed.data : ({ ...capabilities, auth: capabilities.auth === "cli" ? "subscription" : capabilities.auth } as RunnerCapabilitiesParsed);
  const prevCaps = (runner.capabilities ?? null) as Partial<RunnerCapabilitiesParsed> | null;
  await prisma.runner.update({ where: { id: runner.id }, data: { status: "ONLINE", lastSeenAt: new Date(), capabilities: caps as unknown as Prisma.InputJsonValue } });
  const cameOnline = runner.status !== "ONLINE";
  const changed = capsKey(prevCaps) !== capsKey(caps);
  if (cameOnline) await emitEvent(prisma, { companyId: runner.companyId, type: "runner.status", payload: { runnerId: runner.id, status: "ONLINE", auth: caps.auth } });
  if (changed) await emitEvent(prisma, { companyId: runner.companyId, type: "runner.capabilities", payload: { runnerId: runner.id, capabilities: caps } });
  for (const provider of ["ANTHROPIC", "OPENAI"] as const) {
    const tool = runnerToolFor(caps, provider);
    if (tool?.auth !== "logged_in") continue;
    const st = await getProviderLimit(runner.companyId, provider);
    if (st?.kind !== "AUTH_EXPIRED") continue;
    if (signInDetectedAgain(runnerToolFor(prevCaps, provider), tool, caps.detectedAt, st.lastErrorAt)) {
      await clearProviderLimit(runner.companyId, provider, `Signed in again (detected by runner "${runner.name}")`);
    }
  }
  if (cameOnline || changed) await releaseRunnerOfflineTasks({ companyId: runner.companyId }).catch((err: Error) => logger.warn({ err: err.message }, "runner-offline release failed"));
  return { runnerId: runner.id, serverTime: new Date().toISOString() };
}

/**
 * Grants the oldest QUEUED LOCAL_RUNNER session of the runner's company
 * (provider must be in its capabilities). The decrypted secret is included
 * only when the connection stores one (created for runner use); otherwise the
 * runner uses its own environment/CLI auth.
 */
export async function claimRunnerJob(runner: Runner): Promise<RunnerJob | null> {
  await prisma.runner.update({ where: { id: runner.id }, data: { lastSeenAt: new Date(), status: "ONLINE" } });
  // Only providers this runner can execute (detected CLI + sign-in), and only while the provider is not limited:
  // queued sessions of a limited provider are parked (no attempt consumed), never re-routed.
  const providers: string[] = [];
  for (const p of ["ANTHROPIC", "OPENAI"] as const) {
    if (!runnerCanExecute(runner.capabilities, p)) continue;
    const label = p.toLowerCase();
    if (!(await isProviderAvailable(runner.companyId, p)).available) {
      const queued = await prisma.executionSession.findMany({ where: { companyId: runner.companyId, mode: "LOCAL_RUNNER", status: "QUEUED", provider: label }, select: { id: true }, take: 50 });
      for (const q of queued) await parkQueuedSessionIfLimited(q.id);
      continue;
    }
    providers.push(label);
  }
  if (!providers.length) return null;
  // An `--auth env` runner bills this machine's API keys per token: it only ever gets explicit API_KEY work,
  // never a subscription (plan) task.
  const envRunner = ((runner.capabilities ?? {}) as { auth?: string }).auth === "env";
  for (let i = 0; i < 5; i++) {
    const candidate = await prisma.executionSession.findFirst({
      where: {
        companyId: runner.companyId,
        mode: "LOCAL_RUNNER",
        status: "QUEUED",
        cancelRequested: false,
        provider: { in: providers },
        ...(envRunner ? { employee: { providerConnection: { authMode: "API_KEY" } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { task: { select: { projectId: true, title: true } } },
    });
    if (!candidate) return null;
    const now = new Date();
    const won = await prisma.executionSession.updateMany({
      where: { id: candidate.id, status: "QUEUED" },
      data: { status: "RUNNING", runnerId: runner.id, startedAt: now, heartbeatAt: now, leaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
    });
    if (won.count !== 1) continue;
    let prep: Awaited<ReturnType<typeof prepareExecutionInput>>;
    try {
      prep = await prepareExecutionInput(candidate.id, { includeSecret: true });
    } catch (err) {
      // Never leave a claimed session stalled until its lease expires (that would burn attempts): fail it as a setup problem.
      const message = `Could not prepare the job: ${(err as Error).message}`;
      logger.warn({ err: (err as Error).message, executionSessionId: candidate.id }, "runner claim: prepare failed");
      await finalizeExecution(candidate.id, { status: "FAILED", summary: "", usage: emptyUsage(), artifacts: [], error: message, errorKind: "UNSUPPORTED" }).catch((e: Error) =>
        logger.warn({ err: e.message, executionSessionId: candidate.id }, "runner claim: could not finalize the failed session"),
      );
      continue;
    }
    await emitEvent(prisma, { companyId: runner.companyId, taskId: candidate.taskId, employeeId: candidate.employeeId, type: "task.progress", payload: { executionSessionId: candidate.id, message: `Claimed by local runner "${runner.name}"`, runnerId: runner.id } });
    return {
      executionSessionId: candidate.id,
      companyId: candidate.companyId,
      taskId: candidate.taskId,
      employeeId: candidate.employeeId,
      projectId: candidate.task.projectId,
      attempt: candidate.attempt,
      provider: providerKindOf(candidate.provider),
      model: prep.model ?? null,
      systemPrompt: prep.systemPrompt,
      taskBrief: prep.taskBrief,
      memoryContext: prep.memoryContext,
      settings: prep.settings,
      secret: prep.secret ?? null,
      authMode: prep.authMode,
      resumeSessionId: prep.resumeSessionId,
      timeoutSec: prep.timeoutSec,
      costCapUsd: prep.costCapUsd,
    };
  }
  return null;
}

/** Loads a session leased to this runner and refreshes its lease; throws FORBIDDEN/CONFLICT otherwise. */
async function ownedSession(runner: Runner, sessionId: string) {
  const s = await prisma.executionSession.findUnique({ where: { id: sessionId } });
  if (!s || s.runnerId !== runner.id || s.companyId !== runner.companyId) throw new DomainError("FORBIDDEN", "This job is not leased to this runner");
  if (s.status !== "RUNNING" && s.status !== "WAITING_APPROVAL") throw new DomainError("CONFLICT", `Job is ${s.status}`);
  const now = new Date();
  await prisma.executionSession.update({ where: { id: s.id }, data: { leaseExpiresAt: new Date(now.getTime() + LEASE_MS), heartbeatAt: now } });
  await prisma.runner.update({ where: { id: runner.id }, data: { lastSeenAt: now } });
  const task = await prisma.task.findUnique({ where: { id: s.taskId }, select: { status: true, timeoutSec: true } });
  const ref: SessionRef = { executionSessionId: s.id, companyId: s.companyId, taskId: s.taskId, employeeId: s.employeeId };
  return { s, ref, cancel: s.cancelRequested || task?.status === "CANCELLED", timeoutSec: task?.timeoutSec ?? 900 };
}

/** Persists a batch of runner events (provider events, usage, approval requests). */
export async function recordRunnerEvents(runner: Runner, sessionId: string, items: RunnerEventItem[]): Promise<RunnerEventsResponse> {
  const { s, ref, cancel, timeoutSec } = await ownedSession(runner, sessionId);
  const approvals: Record<string, string> = {};
  for (const item of items) {
    if (item.type === "event") await persistProviderEvent(ref, item.event as ProviderEvent);
    else if (item.type === "usage") await persistUsage(ref, item.usage);
    else if (item.type === "provider_limit") {
      const provider = providerKindOf(s.provider);
      if (provider !== "SIMULATED") {
        await recordProviderLimit(s.companyId, provider, {
          kind: item.errorKind,
          message: item.message,
          resetAt: item.limit?.resetAt ? new Date(item.limit.resetAt) : undefined,
          retryAfterAt: item.limit?.retryAfterAt ? new Date(item.limit.retryAfterAt) : undefined,
          source: item.limit?.source ?? "classified",
        }, { affectedTaskIds: [s.taskId] });
      }
    } else {
      const expiresAt = new Date((s.startedAt ?? new Date()).getTime() + timeoutSec * 1000);
      const a = await openApproval(ref, { kind: item.approvalKind, title: item.title, payload: item.payload }, expiresAt);
      approvals[item.clientRequestId] = a.id;
    }
  }
  return { ok: true, cancel, approvals };
}

/** Control poll: cancel flag + this session's approval decisions (resumes the task when none are pending). */
export async function getRunnerControl(runner: Runner, sessionId: string): Promise<RunnerControlResponse> {
  const { s, ref, cancel } = await ownedSession(runner, sessionId);
  const rows = await prisma.approvalRequest.findMany({ where: { executionSessionId: s.id }, orderBy: { requestedAt: "asc" }, select: { id: true, status: true, note: true } });
  if (s.status === "WAITING_APPROVAL" && !rows.some((r) => r.status === "PENDING")) await resumeAfterApprovals(ref, "approval decided");
  return { cancel, approvals: rows };
}

/**
 * Completes a runner job: persists artifacts/usage and applies the task
 * follow-up (review, retry, fail). errorKind USAGE_LIMIT / RATE_LIMIT /
 * AUTH_EXPIRED → recordProviderLimit + parkTaskForProviderLimit (no attempt
 * consumed; handled in finalizeExecution); UNSUPPORTED blocks the task.
 */
export async function completeRunnerJob(runner: Runner, sessionId: string, result: RunnerCompleteInputT) {
  await ownedSession(runner, sessionId);
  return finalizeExecution(sessionId, { ...result, providerSessionId: result.providerSessionId ?? null, artifacts: result.artifacts.map((a) => ({ ...a })) });
}
