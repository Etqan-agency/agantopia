import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@agentopia/db";
import type { RunnerToolInfo } from "@agentopia/shared";
import type { ProviderAdapter } from "../../providers/types";

// Isolate Redis keys/queues and on-disk data for this run (read lazily by core).
const RUN = randomBytes(4).toString("hex");
process.env.AGENTOPIA_REDIS_PREFIX = `agentopia-test-${RUN}`;
const TMP = mkdtempSync(path.join(tmpdir(), "agentopia-hard-"));
const WORKSPACES = path.join(TMP, "workspaces");
process.env.AGENTOPIA_WORKSPACE_ROOT = WORKSPACES;
process.env.AGENTOPIA_ARTIFACT_ROOT = path.join(TMP, "artifacts");

const core = await import("../../index");
const { createTask, runExecution, finalizeExecution, recoverOrphanedTasks, runnerCanExecute, signInDetectedAgain, obliterateQueues, closeQueues, closeRedis, encryptSecret, generateToken, hashToken, runnerHeartbeat, claimRunnerJob } = core;

let userId = "";
const companyIds: string[] = [];

const TOOL_OK: RunnerToolInfo = { installed: true, path: "/usr/local/bin/claude", version: "2.0.65 (Claude Code)", auth: "logged_in", authMethod: "keychain", executionAvailable: true };
const CODEX_MISSING: RunnerToolInfo = { installed: false, auth: "unknown", executionAvailable: false, reason: "Codex CLI is not installed" };
const caps = (auth: "subscription" | "env") => ({ providers: ["ANTHROPIC", "OPENAI"] as Array<"ANTHROPIC" | "OPENAI">, auth, version: "test", tools: { claude: TOOL_OK, codex: CODEX_MISSING }, detectedAt: new Date().toISOString() });
const usage0 = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: null, costSource: "unavailable" as const };

async function makeCompany(label: string) {
  const company = await prisma.company.create({ data: { ownerId: userId, name: `HARD ${label} ${RUN}` } });
  companyIds.push(company.id);
  const emp = await prisma.employee.create({ data: { companyId: company.id, name: `Frontend ${label} ${RUN}`, avatar: {}, title: "Frontend", department: "FRONTEND", specialty: "FRONTEND" } });
  return { companyId: company.id, employeeId: emp.id };
}

async function connect(companyId: string, employeeId: string, authMode: "SUBSCRIPTION_CLI" | "API_KEY") {
  const conn = await prisma.providerConnection.create({
    data: { companyId, provider: "ANTHROPIC", mode: "LOCAL_RUNNER", authMode, label: authMode === "API_KEY" ? "Runner key" : "My Claude plan", encryptedSecret: authMode === "API_KEY" ? encryptSecret("sk-ant-runner") : null },
  });
  await prisma.employee.update({ where: { id: employeeId }, data: { providerConnectionId: conn.id } });
  return conn;
}

async function makeRunner(companyId: string, auth: "subscription" | "env", name: string) {
  const r = await prisma.runner.create({ data: { companyId, name: `${name}-${RUN}`, tokenHash: hashToken(generateToken()) } });
  await runnerHeartbeat(r, caps(auth));
  return prisma.runner.findUniqueOrThrow({ where: { id: r.id } });
}

const task = (id: string) => prisma.task.findUniqueOrThrow({ where: { id } });
const sessions = (taskId: string) => prisma.executionSession.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
const direct = (companyId: string, employeeId: string, title: string) =>
  createTask(companyId, { userId }, { title, description: "Build an accessible React signup form", priority: "NORMAL", submitToManager: false, assigneeId: employeeId });

/** Adapter that waits for the abort signal (optionally reporting usage first). */
const waitingAdapter = (onStart?: (hooks: Parameters<ProviderAdapter["run"]>[1]) => Promise<void> | void): ProviderAdapter => ({
  kind: "SIMULATED",
  verify: async () => ({ ok: true, status: "VERIFIED" }),
  listModels: async () => [],
  run: async (req, hooks) => {
    await onStart?.(hooks);
    if (!req.signal.aborted) await new Promise<void>((r) => req.signal.addEventListener("abort", () => r(), { once: true }));
    return { status: "CANCELLED", summary: "", usage: usage0, artifacts: [] };
  },
});

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: `HARD ${RUN}`, email: `hard-${RUN}@agentopia.test` } });
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

describe("env runners never run subscription work", () => {
  it("gate: an --auth env runner does not count for SUBSCRIPTION_CLI targets", () => {
    expect(runnerCanExecute(caps("env"), "ANTHROPIC", "SUBSCRIPTION_CLI")).toBe(false);
    expect(runnerCanExecute(caps("env"), "ANTHROPIC", "API_KEY")).toBe(true);
    expect(runnerCanExecute(caps("subscription"), "ANTHROPIC", "SUBSCRIPTION_CLI")).toBe(true);
  });

  it("subscription task with only an env runner is BLOCKED (RUNNER_OFFLINE); the env runner never claims it", async () => {
    const { companyId, employeeId } = await makeCompany("envgate");
    await connect(companyId, employeeId, "SUBSCRIPTION_CLI");
    const envRunner = await makeRunner(companyId, "env", "ci-box");
    const t = await direct(companyId, employeeId, "Plan task");
    expect(await task(t.id)).toMatchObject({ status: "BLOCKED", plan: expect.objectContaining({ blockedKind: "RUNNER_OFFLINE" }) });
    expect(await sessions(t.id)).toHaveLength(0);

    // A subscription runner comes online: the task is released and queued…
    const subRunner = await makeRunner(companyId, "subscription", "laptop");
    const [s] = await sessions(t.id);
    expect(s).toMatchObject({ status: "QUEUED", mode: "LOCAL_RUNNER" });
    // …the env runner still cannot claim it (server-side filter), the subscription runner can.
    expect(await claimRunnerJob(await prisma.runner.findUniqueOrThrow({ where: { id: envRunner.id } }))).toBeNull();
    expect(await claimRunnerJob(subRunner)).toMatchObject({ executionSessionId: s!.id, authMode: "SUBSCRIPTION_CLI", secret: null });
  });

  it("an env runner still claims explicit API_KEY runner work", async () => {
    const { companyId, employeeId } = await makeCompany("envkey");
    await connect(companyId, employeeId, "API_KEY");
    const envRunner = await makeRunner(companyId, "env", "ci-box");
    const t = await direct(companyId, employeeId, "Key task");
    const [s] = await sessions(t.id);
    expect(await claimRunnerJob(envRunner)).toMatchObject({ executionSessionId: s!.id, authMode: "API_KEY", secret: "sk-ant-runner" });
  });

  it("claim: a job that cannot be prepared is failed right away (UNSUPPORTED), not left RUNNING", async () => {
    const { companyId, employeeId } = await makeCompany("prepfail");
    await connect(companyId, employeeId, "SUBSCRIPTION_CLI");
    const runner = await makeRunner(companyId, "subscription", "laptop");
    const t = await direct(companyId, employeeId, "Prep fails");
    const [s] = await sessions(t.id);
    // Force prepareExecutionInput to throw: no stored workspace and an unusable workspace root.
    await prisma.executionSession.update({ where: { id: s!.id }, data: { workspacePath: null } });
    const blocker = path.join(TMP, "not-a-dir");
    writeFileSync(blocker, "x");
    process.env.AGENTOPIA_WORKSPACE_ROOT = path.join(blocker, "sub");
    try {
      expect(await claimRunnerJob(runner)).toBeNull();
    } finally {
      process.env.AGENTOPIA_WORKSPACE_ROOT = WORKSPACES;
    }
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: s!.id } })).toMatchObject({ status: "FAILED", errorKind: "UNSUPPORTED", leaseExpiresAt: null });
    expect((await task(t.id)).status).toBe("BLOCKED");
  });
});

describe("finalizeExecution is atomic and guarded", () => {
  it("a second finalize (or one for a session the server already failed) changes nothing", async () => {
    const { companyId, employeeId } = await makeCompany("final");
    const t = await direct(companyId, employeeId, "Simulated task");
    const [s] = await sessions(t.id);
    const ok = { status: "SUCCEEDED" as const, summary: "done", usage: usage0, artifacts: [{ name: "summary.md", kind: "TEXT" as const, content: "done" }] };
    expect(await finalizeExecution(s!.id, ok)).toMatchObject({ status: "SUCCEEDED" });
    expect((await task(t.id)).status).toBe("REVIEW");
    expect(await finalizeExecution(s!.id, { ...ok, status: "FAILED", error: "late duplicate" })).toMatchObject({ nextExecutionSessionId: null });
    expect(await prisma.usageRecord.count({ where: { executionSessionId: s!.id } })).toBe(1);
    expect(await prisma.artifact.count({ where: { executionSessionId: s!.id } })).toBe(1);
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: s!.id } })).toMatchObject({ status: "SUCCEEDED" });

    // Session already failed by maintenance: a late SUCCEEDED report neither records usage nor moves the task.
    const t2 = await direct(companyId, employeeId, "Simulated task two");
    const [s2] = await sessions(t2.id);
    await prisma.executionSession.update({ where: { id: s2!.id }, data: { status: "FAILED", error: "lease expired", endedAt: new Date() } });
    await finalizeExecution(s2!.id, ok);
    expect(await prisma.usageRecord.count({ where: { executionSessionId: s2!.id } })).toBe(0);
    expect((await task(t2.id)).status).toBe("IN_PROGRESS");
  });

  it("worker: a lost lease aborts the run and the stale result is discarded", async () => {
    const { companyId, employeeId } = await makeCompany("lease");
    const t = await direct(companyId, employeeId, "Lease task");
    const [s] = await sessions(t.id);
    let seen: unknown = null;
    const adapter: ProviderAdapter = {
      ...waitingAdapter(async () => {
        // Maintenance fails the session while the worker still runs it.
        await prisma.executionSession.update({ where: { id: s!.id }, data: { status: "FAILED", error: "lease expired", endedAt: new Date(), leaseExpiresAt: null } });
      }),
    };
    const run = adapter.run;
    adapter.run = async (req, hooks) => {
      const r = await run(req, hooks);
      seen = req.signal.reason;
      return r;
    };
    expect(await runExecution(s!.id, { adapter, heartbeatMs: 20, controlPollMs: 10 })).toEqual({ outcome: "skipped", reason: "lease lost" });
    expect(seen).toBe("lease_lost");
    expect(await prisma.executionSession.findUniqueOrThrow({ where: { id: s!.id } })).toMatchObject({ status: "FAILED", error: "lease expired", leaseExpiresAt: null });
    expect(await prisma.usageRecord.count({ where: { executionSessionId: s!.id } })).toBe(0);
  });
});

describe("cost-cap stops are terminal (no retry)", () => {
  it("worker: the cost cap fails the task once even with attempts left", async () => {
    const { companyId, employeeId } = await makeCompany("cap");
    const t = await direct(companyId, employeeId, "Expensive task");
    expect((await task(t.id)).maxAttempts).toBeGreaterThan(1);
    const [s] = await sessions(t.id);
    const adapter = waitingAdapter((hooks) => hooks.onUsage({ ...usage0, costUsd: 999, costSource: "provider_reported" }));
    expect(await runExecution(s!.id, { adapter, controlPollMs: 10 })).toMatchObject({ outcome: "finished", status: "FAILED", nextExecutionSessionId: null });
    expect(await task(t.id)).toMatchObject({ status: "FAILED", errorMessage: expect.stringMatching(/^Stopped: cost cap of/) });
    expect(await sessions(t.id)).toHaveLength(1);
  });

  it("runner/SDK: terminal results (and the legacy budget text) are not retried; ordinary failures are", async () => {
    const { companyId, employeeId } = await makeCompany("cap2");
    const fail = (error: string, terminal?: boolean) => ({ status: "FAILED" as const, summary: "", usage: usage0, artifacts: [], error, errorKind: "OTHER" as const, ...(terminal ? { terminal } : {}) });

    const a = await direct(companyId, employeeId, "SDK budget");
    await finalizeExecution((await sessions(a.id))[0]!.id, fail("Stopped: per-execution budget reached", true));
    expect((await task(a.id)).status).toBe("FAILED");
    expect(await sessions(a.id)).toHaveLength(1);

    const b = await direct(companyId, employeeId, "Old runner cost cap");
    await finalizeExecution((await sessions(b.id))[0]!.id, fail("Stopped: cost cap of $1.00 reached"));
    expect((await task(b.id)).status).toBe("FAILED");

    const c = await direct(companyId, employeeId, "Ordinary failure");
    const next = await finalizeExecution((await sessions(c.id))[0]!.id, fail("tool crashed"));
    expect(next.nextExecutionSessionId).toBeTruthy();
    expect((await task(c.id)).status).toBe("IN_PROGRESS");
  });
});

describe("maintenance: orphaned IN_PROGRESS tasks", () => {
  it("a leaf task IN_PROGRESS without an active session is recovered with an event", async () => {
    const { companyId, employeeId } = await makeCompany("orphan");
    const t = await direct(companyId, employeeId, "Orphan task");
    const [s] = await sessions(t.id);
    // Simulates a crash between ending the session and moving the task (no attempts left → FAILED).
    await prisma.executionSession.update({ where: { id: s!.id }, data: { status: "FAILED", endedAt: new Date(), error: "boom" } });
    await prisma.task.update({ where: { id: t.id }, data: { attempt: 5, maxAttempts: 5 } });
    const live = await direct(companyId, employeeId, "Live task");
    expect(await recoverOrphanedTasks(new Date(), { companyId })).toBe(0); // inside the grace period
    expect(await recoverOrphanedTasks(new Date(Date.now() + 60_000), { companyId, graceMs: 1000 })).toBe(1);
    expect(await task(t.id)).toMatchObject({ status: "FAILED" });
    expect(await prisma.taskEvent.count({ where: { taskId: t.id, type: "task.progress", payload: { path: ["recovered"], equals: true } } })).toBe(1);
    expect((await task(live.id)).status).toBe("IN_PROGRESS"); // has a QUEUED session
  });
});

describe("heartbeat: AUTH_EXPIRED clears only on a detection change", () => {
  it("signInDetectedAgain", () => {
    const err = new Date("2026-11-02T10:00:00Z");
    expect(signInDetectedAgain({ ...TOOL_OK, auth: "not_logged_in", executionAvailable: false }, TOOL_OK, undefined, err)).toBe(true);
    expect(signInDetectedAgain(undefined, TOOL_OK, undefined, err)).toBe(true);
    // keychain item still present, nothing changed → stays expired
    expect(signInDetectedAgain(TOOL_OK, TOOL_OK, "2026-11-02T11:00:00Z", err)).toBe(false);
    // detection changed after the error (e.g. a new auth method) → cleared
    expect(signInDetectedAgain(TOOL_OK, { ...TOOL_OK, authMethod: "oauth_token" }, "2026-11-02T11:00:00Z", err)).toBe(true);
    // changed, but detected before the error → not cleared
    expect(signInDetectedAgain(TOOL_OK, { ...TOOL_OK, authMethod: "oauth_token" }, "2026-11-02T09:00:00Z", err)).toBe(false);
  });
});
