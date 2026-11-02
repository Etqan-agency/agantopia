import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@agentopia/db";
import type { RunnerToolInfo } from "@agentopia/shared";

// Isolate Redis keys/queues and on-disk data for this run (read lazily by core).
const RUN = randomBytes(4).toString("hex");
process.env.AGENTOPIA_REDIS_PREFIX = `agentopia-test-${RUN}`;
const TMP = mkdtempSync(path.join(tmpdir(), "agentopia-limits-"));
process.env.AGENTOPIA_WORKSPACE_ROOT = path.join(TMP, "workspaces");
process.env.AGENTOPIA_ARTIFACT_ROOT = path.join(TMP, "artifacts");

const core = await import("../../index");
const {
  createTask,
  runExecution,
  taskAction,
  createSimulatedAdapter,
  obliterateQueues,
  closeQueues,
  closeRedis,
  encryptSecret,
  generateToken,
  hashToken,
  runnerHeartbeat,
  claimRunnerJob,
  recordRunnerEvents,
  completeRunnerJob,
  recordProviderLimit,
  clearProviderLimit,
  isProviderAvailable,
  getProviderLimit,
  limitBackoffMs,
  parkTaskForProviderLimit,
  releaseWaitingTasks,
  releaseRunnerOfflineTasks,
  failRunnerSessions,
  getProviderStatuses,
  verifiedLlmConfig,
  recordProviderUsageReport,
  MAX_LIMIT_RETRIES,
} = core;

let userId = "";
const companyIds: string[] = [];

const TOOL_OK: RunnerToolInfo = { installed: true, path: "/usr/local/bin/claude", version: "2.0.65 (Claude Code)", auth: "logged_in", authMethod: "keychain", executionAvailable: true };
const TOOL_LOGGED_OUT: RunnerToolInfo = { installed: true, path: "/usr/local/bin/claude", version: "2.0.65 (Claude Code)", auth: "not_logged_in", executionAvailable: false, reason: "Not signed in: run `claude` and use /login" };
const CODEX_MISSING: RunnerToolInfo = { installed: false, auth: "unknown", executionAvailable: false, reason: "Codex CLI is not installed" };
const caps = (claude: RunnerToolInfo) => ({ providers: ["ANTHROPIC", "OPENAI"] as Array<"ANTHROPIC" | "OPENAI">, auth: "subscription" as const, version: "test", tools: { claude, codex: CODEX_MISSING }, detectedAt: new Date().toISOString() });

async function makeCompany(label: string) {
  const company = await prisma.company.create({ data: { ownerId: userId, name: `LIM ${label} ${RUN}` } });
  companyIds.push(company.id);
  const emp = await prisma.employee.create({ data: { companyId: company.id, name: `Frontend ${label} ${RUN}`, avatar: {}, title: "Frontend", department: "FRONTEND", specialty: "FRONTEND" } });
  return { companyId: company.id, employeeId: emp.id };
}

async function connect(companyId: string, employeeId: string, kind: "subscription" | "api", extra: { secret?: string; mode?: "API" | "LOCAL_RUNNER" } = {}) {
  const conn = await prisma.providerConnection.create({
    data:
      kind === "subscription"
        ? { companyId, provider: "ANTHROPIC", mode: extra.mode ?? "LOCAL_RUNNER", authMode: "SUBSCRIPTION_CLI", label: "My Claude plan", encryptedSecret: extra.secret ? encryptSecret(extra.secret) : null }
        : { companyId, provider: "ANTHROPIC", mode: "API", authMode: "API_KEY", label: "Claude API", encryptedSecret: encryptSecret(extra.secret ?? "sk-ant-test"), status: "VERIFIED" },
  });
  await prisma.employee.update({ where: { id: employeeId }, data: { providerConnectionId: conn.id } });
  return conn;
}

async function makeRunner(companyId: string, claude: RunnerToolInfo = TOOL_OK) {
  const r = await prisma.runner.create({ data: { companyId, name: `laptop-${RUN}`, tokenHash: hashToken(generateToken()) } });
  await runnerHeartbeat(r, caps(claude));
  return prisma.runner.findUniqueOrThrow({ where: { id: r.id } });
}

const task = (id: string) => prisma.task.findUniqueOrThrow({ where: { id } });
const sessions = (taskId: string) => prisma.executionSession.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
const events = async (companyId: string, type: string) => prisma.taskEvent.findMany({ where: { companyId, type }, orderBy: { seq: "asc" } });
const direct = (companyId: string, employeeId: string, title: string) =>
  createTask(companyId, { userId }, { title, description: "Build an accessible React signup form", priority: "NORMAL", submitToManager: false, assigneeId: employeeId });

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: `LIM ${RUN}`, email: `lim-${RUN}@agentopia.test` } });
  userId = u.id;
});

afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await obliterateQueues().catch(() => undefined);
  await closeQueues();
  await closeRedis();
  rmSync(TMP, { recursive: true, force: true });
});

describe("Usage Limit Manager (real DB)", () => {
  it("bounded backoff: 5 min × 2^n capped at 60 min", () => {
    expect(limitBackoffMs(0)).toBe(5 * 60_000);
    expect(limitBackoffMs(1)).toBe(10 * 60_000);
    expect(limitBackoffMs(3)).toBe(40 * 60_000);
    expect(limitBackoffMs(4)).toBe(60 * 60_000);
    expect(limitBackoffMs(50)).toBe(60 * 60_000);
  });

  it("records, reports availability, never invents a reset time, and clears", async () => {
    const { companyId } = await makeCompany("record");
    const now = new Date();
    const row = await recordProviderLimit(companyId, "ANTHROPIC", { kind: "USAGE_LIMIT", message: "You've hit your limit", source: "classified" }, { now, attempt: 1 });
    expect(row).toMatchObject({ kind: "USAGE_LIMIT", resetAt: null, source: "classified" });
    expect(row!.retryAfterAt!.getTime()).toBe(now.getTime() + 10 * 60_000); // backoff, not a reset
    const a = await isProviderAvailable(companyId, "ANTHROPIC", now);
    expect(a).toMatchObject({ available: false, kind: "USAGE_LIMIT" });
    expect(a.resetAt).toBeUndefined();
    expect((await isProviderAvailable(companyId, "ANTHROPIC", new Date(now.getTime() + 11 * 60_000))).available).toBe(true);
    expect((await isProviderAvailable(companyId, "OPENAI", now)).available).toBe(true);
    const ev = (await events(companyId, "provider.limit"))[0]!;
    expect(ev.payload).toMatchObject({ provider: "ANTHROPIC", kind: "USAGE_LIMIT", resetAt: null, source: "classified", affectedTaskIds: [] });
    expect(await prisma.auditLog.count({ where: { companyId, action: "provider.limit" } })).toBe(1);

    // AUTH_EXPIRED stays unavailable until cleared, whatever the clock says.
    await recordProviderLimit(companyId, "ANTHROPIC", { kind: "AUTH_EXPIRED", message: "Not logged in", source: "provider_reported" }, { now });
    expect((await isProviderAvailable(companyId, "ANTHROPIC", new Date(now.getTime() + 7 * 86_400_000))).available).toBe(false);
    expect(await clearProviderLimit(companyId, "ANTHROPIC", "signed in")).toBe(true);
    expect(await clearProviderLimit(companyId, "ANTHROPIC", "again")).toBe(false);
    expect((await getProviderLimit(companyId, "ANTHROPIC"))?.kind).toBe("OK");
    expect(await events(companyId, "provider.limit_cleared")).toHaveLength(1);
    // Non-limit kinds are ignored.
    expect(await recordProviderLimit(companyId, "ANTHROPIC", { kind: "OTHER", message: "boom", source: "classified" })).toBeNull();
  });

  it("API path: gate parks before starting (no attempt consumed, adapter never called), release resumes, bounded at 5 → BLOCKED", async () => {
    const { companyId, employeeId } = await makeCompany("api");
    await connect(companyId, employeeId, "api");
    const resetAt = new Date(Date.now() + 3600_000);

    // 1) A session already QUEUED when the limit is recorded: runExecution parks it.
    const t1 = await direct(companyId, employeeId, "API task one");
    const [s1] = await sessions(t1.id);
    expect(s1).toMatchObject({ mode: "API", status: "QUEUED", provider: "anthropic" });
    await recordProviderLimit(companyId, "ANTHROPIC", { kind: "USAGE_LIMIT", message: "usage limit", resetAt, source: "provider_reported" });
    let called = 0;
    const spy = { ...createSimulatedAdapter({ stepDelayMs: 1 }), run: async () => ((called += 1), { status: "SUCCEEDED" as const, summary: "", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: null, costSource: "unavailable" as const }, artifacts: [] }) };
    expect(await runExecution(s1!.id, { adapter: spy })).toEqual({ outcome: "parked", reason: "provider limit" });
    expect(called).toBe(0);
    const p1 = await task(t1.id);
    expect(p1).toMatchObject({ status: "WAITING_FOR_PROVIDER_LIMIT", limitRetries: 1, attempt: 1, maxAttempts: 3 });
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: s1!.id } })).toMatchObject({ status: "CANCELLED", errorKind: "USAGE_LIMIT" });
    const wev = (await prisma.taskEvent.findFirstOrThrow({ where: { taskId: t1.id, type: "task.waiting_provider_limit" } })).payload as Record<string, unknown>;
    expect(wev).toMatchObject({ provider: "ANTHROPIC", kind: "USAGE_LIMIT", resetAt: resetAt.toISOString(), attempt: 1 });
    const blockedState = await prisma.taskEvent.findFirstOrThrow({ where: { taskId: t1.id, type: "employee.state" }, orderBy: { seq: "desc" } });
    expect(blockedState.payload).toMatchObject({ state: "BLOCKED", reason: "provider limit" });

    // 2) New work while limited: startExecution parks it without creating a session.
    const t2 = await direct(companyId, employeeId, "API task two");
    expect(await task(t2.id)).toMatchObject({ status: "WAITING_FOR_PROVIDER_LIMIT", attempt: 0 });
    expect(await sessions(t2.id)).toHaveLength(0);

    // Manual resume is refused while limited (409 with the reason); retry behaves the same.
    await expect(taskAction(companyId, t1.id, "resume", { userId })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringMatching(/Usage limit reached/) });
    await expect(taskAction(companyId, t1.id, "retry", { userId })).rejects.toMatchObject({ code: "CONFLICT" });

    // Maintenance before the window: nothing moves.
    expect(await releaseWaitingTasks(new Date(), { companyId })).toEqual({ released: 0, blocked: 0, stillWaiting: 2 });
    // After the provider-reported reset (simulated by moving it into the past): both resume with new QUEUED attempts.
    await prisma.providerLimitState.update({ where: { companyId_provider: { companyId, provider: "ANTHROPIC" } }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect(await releaseWaitingTasks(new Date(), { companyId })).toEqual({ released: 2, blocked: 0, stillWaiting: 0 });
    expect(await task(t1.id)).toMatchObject({ status: "IN_PROGRESS", attempt: 2, limitRetries: 1 });
    expect((await sessions(t1.id)).at(-1)).toMatchObject({ status: "QUEUED", mode: "API" });

    // A successful run after the limit clears it (first execution output after the limit).
    const s2 = (await sessions(t1.id)).at(-1)!;
    expect(await runExecution(s2.id, { adapter: createSimulatedAdapter({ stepDelayMs: 1 }), controlPollMs: 20 })).toMatchObject({ outcome: "finished", status: "SUCCEEDED" });
    expect((await getProviderLimit(companyId, "ANTHROPIC"))?.kind).toBe("OK");

    // 3) Bounded: over MAX_LIMIT_RETRIES automatic re-queues → BLOCKED ("retry manually").
    await prisma.task.update({ where: { id: t2.id }, data: { status: "WAITING_FOR_PROVIDER_LIMIT", limitRetries: MAX_LIMIT_RETRIES + 1 } });
    await prisma.executionSession.updateMany({ where: { taskId: t2.id, status: "QUEUED" }, data: { status: "CANCELLED" } });
    expect(await releaseWaitingTasks(new Date(), { companyId })).toMatchObject({ blocked: 1 });
    expect(await task(t2.id)).toMatchObject({ status: "BLOCKED", errorMessage: "Provider limit retries exhausted; retry manually" });
    // and parking a task already at the cap blocks it directly
    const t3 = await direct(companyId, employeeId, "API task three");
    await prisma.task.update({ where: { id: t3.id }, data: { limitRetries: MAX_LIMIT_RETRIES } });
    expect(await parkTaskForProviderLimit(t3.id, { kind: "RATE_LIMIT", message: "429", source: "classified" }, { refundAttempt: true })).toMatchObject({ parked: false, blocked: true });
    expect((await task(t3.id)).status).toBe("BLOCKED");
    // Owner retry starts a fresh limit budget.
    await taskAction(companyId, t3.id, "retry", { userId });
    expect(await task(t3.id)).toMatchObject({ status: "IN_PROGRESS", limitRetries: 0 });
  });

  it("no paid fallback: a SUBSCRIPTION_CLI employee without a runner never gets an API execution; runner online → auto-unblock", async () => {
    const { companyId, employeeId } = await makeCompany("nofallback");
    // Even with a stored key and mode "API" on the row, subscription auth never runs server-side.
    await connect(companyId, employeeId, "subscription", { secret: "sk-ant-should-never-be-used", mode: "API" });
    expect(await verifiedLlmConfig(employeeId)).toBeNull();
    const t = await direct(companyId, employeeId, "Subscription task");
    const blocked = await task(t.id);
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.errorMessage).toMatch(/^Start the local runner on your machine/);
    expect(blocked.plan).toMatchObject({ blockedKind: "RUNNER_OFFLINE", blockedProvider: "ANTHROPIC" });
    expect(await prisma.executionSession.count({ where: { companyId, mode: "API" } })).toBe(0);
    expect(await sessions(t.id)).toHaveLength(0);
    expect((await prisma.taskEvent.findFirstOrThrow({ where: { taskId: t.id, type: "task.blocked" } })).payload).toMatchObject({ errorKind: "RUNNER_OFFLINE" });

    // A runner whose Claude Code is not signed in does not unblock it…
    const runner = await makeRunner(companyId, TOOL_LOGGED_OUT);
    expect((await task(t.id)).status).toBe("BLOCKED");
    expect((await releaseRunnerOfflineTasks({ companyId })).waiting).toBe(1);
    // …signing in (detected by the next heartbeat) does: re-assigned and a QUEUED LOCAL_RUNNER session waits for the runner.
    await runnerHeartbeat(runner, caps(TOOL_OK));
    expect(await task(t.id)).toMatchObject({ status: "IN_PROGRESS", errorMessage: null });
    const [s] = await sessions(t.id);
    expect(s).toMatchObject({ mode: "LOCAL_RUNNER", status: "QUEUED", provider: "anthropic" });
    expect(await events(companyId, "runner.capabilities")).toHaveLength(2);

    // The worker never executes it, and the runner job carries no key.
    expect(await runExecution(s!.id)).toMatchObject({ outcome: "skipped" });
    const job = await claimRunnerJob(await prisma.runner.findUniqueOrThrow({ where: { id: runner.id } }));
    expect(job).toMatchObject({ executionSessionId: s!.id, authMode: "SUBSCRIPTION_CLI", secret: null });
    expect(await prisma.executionSession.count({ where: { companyId, mode: "API" } })).toBe(0);
  });

  it("runner path: claim gating, complete with USAGE_LIMIT parks (no attempt consumed), heartbeat sign-in clears AUTH_EXPIRED, runner offline re-queues", async () => {
    const { companyId, employeeId } = await makeCompany("runner");
    await connect(companyId, employeeId, "subscription");
    let runner = await makeRunner(companyId);

    // Limit recorded while a session is QUEUED: the claim parks it instead of handing it out.
    const t = await direct(companyId, employeeId, "Runner task");
    const [q] = await sessions(t.id);
    expect(q).toMatchObject({ status: "QUEUED", mode: "LOCAL_RUNNER" });
    await recordProviderLimit(companyId, "ANTHROPIC", { kind: "RATE_LIMIT", message: "429", retryAfterAt: new Date(Date.now() + 60_000), source: "provider_reported" });
    expect(await claimRunnerJob(runner)).toBeNull();
    expect(await task(t.id)).toMatchObject({ status: "WAITING_FOR_PROVIDER_LIMIT", attempt: 1, maxAttempts: 3 });
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: q!.id } })).toMatchObject({ status: "CANCELLED", errorKind: "RATE_LIMIT" });

    // Window over (cleared) → owner resume → claim → the run hits the plan limit.
    await prisma.providerLimitState.update({ where: { companyId_provider: { companyId, provider: "ANTHROPIC" } }, data: { retryAfterAt: new Date(Date.now() - 1000) } });
    await taskAction(companyId, t.id, "resume", { userId });
    runner = await prisma.runner.findUniqueOrThrow({ where: { id: runner.id } });
    const job = await claimRunnerJob(runner);
    expect(job).toMatchObject({ authMode: "SUBSCRIPTION_CLI", secret: null, attempt: 2 });
    await recordRunnerEvents(runner, job!.executionSessionId, [
      { type: "event", event: { type: "message", role: "assistant", text: "Working on it" } },
      { type: "event", event: { type: "provider_status", status: "allowed_warning", utilization: 0.92, windowLabel: "5-hour window" } },
    ]);
    // first output after the limit cleared the RATE_LIMITED state; the warning is stored as reported usage
    const st = await getProviderLimit(companyId, "ANTHROPIC");
    expect(st).toMatchObject({ kind: "OK", utilization: 0.92, windowLabel: "5-hour window" });
    const resetAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    await recordRunnerEvents(runner, job!.executionSessionId, [{ type: "provider_limit", errorKind: "USAGE_LIMIT", message: "Subscription usage limit reached", limit: { resetAt, source: "provider_reported" } }]);
    const fin = await completeRunnerJob(runner, job!.executionSessionId, {
      status: "FAILED",
      summary: "partial",
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.002, costSource: "estimated", tokenSource: "provider_reported" },
      artifacts: [{ name: "summary.md", kind: "TEXT", content: "partial work" }],
      error: "Claude subscription usage limit reached (5-hour window)",
      errorKind: "USAGE_LIMIT",
      limit: { resetAt, source: "provider_reported" },
    });
    expect(fin).toMatchObject({ status: "FAILED", nextExecutionSessionId: null });
    expect(await task(t.id)).toMatchObject({ status: "WAITING_FOR_PROVIDER_LIMIT", attempt: 2, maxAttempts: 4, limitRetries: 2 });
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: job!.executionSessionId } })).toMatchObject({ status: "FAILED", errorKind: "USAGE_LIMIT" });
    expect(await prisma.artifact.count({ where: { executionSessionId: job!.executionSessionId } })).toBe(1); // partial artifacts kept
    expect(await prisma.usageRecord.count({ where: { executionSessionId: job!.executionSessionId } })).toBe(1);
    const lim = await getProviderLimit(companyId, "ANTHROPIC");
    expect(lim).toMatchObject({ kind: "USAGE_LIMIT", source: "provider_reported" });
    expect(lim!.resetAt!.toISOString()).toBe(resetAt);

    // UI status: waiting for the provider-reported reset, with reported usage.
    const statuses = await getProviderStatuses(companyId);
    const claude = statuses.find((s) => s.provider === "ANTHROPIC")!;
    expect(claude).toMatchObject({ status: "WAITING_FOR_RESET", authMode: "SUBSCRIPTION_CLI", waitingTasks: 1, errorKind: "USAGE_LIMIT", usage: { kind: "reported", utilization: 0.92, windowLabel: "5-hour window" } });
    expect(claude.runner).toMatchObject({ status: "ONLINE", tool: { auth: "logged_in" } });
    expect(statuses.find((s) => s.provider === "OPENAI")).toMatchObject({ status: "DISCONNECTED", usage: { kind: "unavailable", note: "Usage details unavailable from provider." } });

    // AUTH_EXPIRED: cleared by the next heartbeat that detects a sign-in.
    await recordProviderLimit(companyId, "ANTHROPIC", { kind: "AUTH_EXPIRED", message: "Not logged in", source: "provider_reported" });
    expect((await getProviderStatuses(companyId))[0]).toMatchObject({ status: "AUTHENTICATION_EXPIRED" });
    await runnerHeartbeat(runner, caps(TOOL_LOGGED_OUT));
    expect((await getProviderLimit(companyId, "ANTHROPIC"))?.kind).toBe("AUTH_EXPIRED");
    await runnerHeartbeat(await prisma.runner.findUniqueOrThrow({ where: { id: runner.id } }), caps(TOOL_OK));
    expect((await getProviderLimit(companyId, "ANTHROPIC"))?.kind).toBe("OK");

    // Runner disconnects mid-run: session FAILED (RUNNER_OFFLINE), task re-queued → no runner left → BLOCKED RUNNER_OFFLINE.
    await prisma.task.update({ where: { id: t.id }, data: { status: "ASSIGNED" } });
    await core.startExecution(companyId, t.id);
    runner = await prisma.runner.findUniqueOrThrow({ where: { id: runner.id } });
    const job2 = await claimRunnerJob(runner);
    expect(job2).toBeTruthy();
    await prisma.runner.update({ where: { id: runner.id }, data: { status: "OFFLINE" } });
    expect(await failRunnerSessions(runner.id)).toBe(1);
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: job2!.executionSessionId } })).toMatchObject({ status: "FAILED", errorKind: "RUNNER_OFFLINE" });
    expect(await task(t.id)).toMatchObject({ status: "BLOCKED", plan: expect.objectContaining({ blockedKind: "RUNNER_OFFLINE" }) });
    expect((await getProviderStatuses(companyId))[0]).toMatchObject({ status: "RUNNER_OFFLINE" });
  });

  it("usage reports never invent values", async () => {
    const { companyId } = await makeCompany("usage");
    await recordProviderUsageReport(companyId, "ANTHROPIC", {});
    expect(await getProviderLimit(companyId, "ANTHROPIC")).toBeNull();
  });
});
