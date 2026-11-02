import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@agentopia/db";
import type { TaskEvent } from "@agentopia/shared";

// Isolate Redis keys/queues and on-disk data for this run (read lazily by core).
const RUN = randomBytes(4).toString("hex");
process.env.AGENTOPIA_REDIS_PREFIX = `agentopia-test-${RUN}`;
const TMP = mkdtempSync(path.join(tmpdir(), "agentopia-it-"));
process.env.AGENTOPIA_WORKSPACE_ROOT = path.join(TMP, "workspaces");
process.env.AGENTOPIA_ARTIFACT_ROOT = path.join(TMP, "artifacts");

const core = await import("../../index");
const { createTask, runManagerPlan, runExecution, runManagerReview, taskAction, decideApproval, createSimulatedAdapter, subscribeCompanyEvents, obliterateQueues, closeQueues, closeRedis } = core;
const { authenticateRunner, runnerHeartbeat, claimRunnerJob, recordRunnerEvents, getRunnerControl, completeRunnerJob, generateToken, hashToken } = core;

const adapter = createSimulatedAdapter({ stepDelayMs: 5 });
const fast = { adapter, controlPollMs: 25, approvalPollMs: 25 };

let userId = "";
const companyIds: string[] = [];

async function makeCompany(label: string, staff: Array<{ name: string; specialty: "MANAGEMENT" | "FRONTEND" | "BACKEND" | "QA"; manager?: boolean }>) {
  const company = await prisma.company.create({ data: { ownerId: userId, name: `IT ${label} ${RUN}` } });
  companyIds.push(company.id);
  const emps: Record<string, string> = {};
  for (const s of staff) {
    const e = await prisma.employee.create({
      data: { companyId: company.id, name: `${s.name} ${RUN}`, avatar: {}, title: s.name, department: s.specialty, specialty: s.specialty, role: s.manager ? "MANAGER" : "EMPLOYEE" },
    });
    emps[s.name] = e.id;
  }
  return { companyId: company.id, emps };
}

async function eventTypes(taskId: string) {
  return (await prisma.taskEvent.findMany({ where: { taskId }, orderBy: { seq: "asc" } })).map((e) => e.type);
}

function isSubsequence(needle: string[], hay: string[]) {
  let i = 0;
  for (const h of hay) if (h === needle[i]) i++;
  return i === needle.length;
}

async function latestSession(taskId: string) {
  return prisma.executionSession.findFirstOrThrow({ where: { taskId }, orderBy: { attempt: "desc" } });
}

beforeAll(async () => {
  const u = await prisma.user.create({ data: { name: `IT ${RUN}`, email: `it-${RUN}@agentopia.test` } });
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

describe("orchestration (real DB, simulated adapter)", () => {
  it("runs create → plan → execute → review end to end", async () => {
    const { companyId, emps } = await makeCompany("happy", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    const live: TaskEvent[] = [];
    const unsub = subscribeCompanyEvents(companyId, (e) => live.push(e));
    await new Promise((r) => setTimeout(r, 100));

    const task = await createTask(companyId, { userId }, { title: "Build a React signup form", description: "Create an accessible signup form component with Tailwind.", priority: "NORMAL", submitToManager: true });
    expect(task.status).toBe("BACKLOG");

    const plan = await runManagerPlan(task.id);
    expect(plan).toMatchObject({ outcome: "assigned", assigneeId: emps.Frontend });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("IN_PROGRESS");
    const assignment = await prisma.assignment.findFirstOrThrow({ where: { taskId: task.id } });
    expect(assignment.reason).toMatch(/specialty match/);
    expect(assignment.assignedById).toBe(emps.Manager);

    const s = await latestSession(task.id);
    expect(s).toMatchObject({ provider: "simulated", mode: "SIMULATED", attempt: 1, status: "QUEUED" });
    const exec = await runExecution(s.id, fast);
    expect(exec).toMatchObject({ outcome: "finished", status: "SUCCEEDED" });
    expect(await runExecution(s.id, fast)).toMatchObject({ outcome: "skipped" }); // idempotent
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("REVIEW");

    const review = await runManagerReview(task.id, { idleDelayMs: 10 });
    expect(review).toMatchObject({ outcome: "decided", result: "completed", decision: { approved: true, method: "checklist", reviewerId: emps.Manager } });

    const done = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.resultSummary).toMatch(/^Simulated run \(no provider was called\)/);

    const types = await eventTypes(task.id);
    expect(
      isSubsequence(
        ["task.created", "task.planned", "task.assigned", "task.started", "execution.started", "execution.message", "execution.tool_use", "execution.usage", "execution.ended", "task.handoff", "task.review_started", "task.review_decided", "task.completed"],
        types,
      ),
    ).toBe(true);
    const handoff = await prisma.taskEvent.findFirstOrThrow({ where: { taskId: task.id, type: "task.handoff" } });
    expect(handoff.payload).toMatchObject({ fromEmployeeId: emps.Frontend, toEmployeeId: emps.Manager });

    const artifacts = await prisma.artifact.findMany({ where: { taskId: task.id } });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ kind: "TEXT", name: "summary.md", executionSessionId: s.id });
    const usage = await prisma.usageRecord.findMany({ where: { taskId: task.id } });
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ provider: "simulated", source: "ESTIMATED", inputTokens: 0, costUsd: null });
    const sessionDone = await prisma.executionSession.findUniqueOrThrow({ where: { id: s.id } });
    expect(sessionDone).toMatchObject({ status: "SUCCEEDED", costSource: "unavailable", leaseExpiresAt: null });

    const evidence = (await prisma.employeeCareerEvidence.findMany({ where: { employeeId: emps.Frontend } })).map((e) => e.kind).sort();
    expect(evidence).toEqual(["REVIEW_APPROVED", "TASK_COMPLETED"]);
    const fe = await prisma.employee.findUniqueOrThrow({ where: { id: emps.Frontend } });
    expect(fe.xp).toBe(15);
    expect(fe.visualState).toBe("COMPLETED");
    expect((await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe("HANDED_OFF");

    await new Promise((r) => setTimeout(r, 200));
    unsub();
    expect(live.some((e) => e.type === "task.completed" && e.taskId === task.id && typeof e.seq === "number")).toBe(true);
  });

  it("cancels a running execution", async () => {
    const { companyId, emps } = await makeCompany("cancel", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    const task = await createTask(companyId, { userId }, { title: "Slow React page", description: "A page that takes a while", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    expect(task.status).toBe("IN_PROGRESS");
    const s = await latestSession(task.id);
    const running = runExecution(s.id, { ...fast, adapter: createSimulatedAdapter({ stepDelayMs: 400 }) });
    await new Promise((r) => setTimeout(r, 120));
    const cancelled = await taskAction(companyId, task.id, "cancel", { userId }, "changed my mind");
    expect(cancelled.status).toBe("CANCELLED");
    expect(await running).toMatchObject({ outcome: "finished", status: "CANCELLED" });
    expect((await prisma.executionSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("CANCELLED");
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("CANCELLED");
    expect((await prisma.assignment.findFirstOrThrow({ where: { taskId: task.id } })).status).toBe("CANCELLED");
    expect(await eventTypes(task.id)).toContain("task.cancelled");
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: emps.Frontend } })).visualState).toBe("IDLE");
    await expect(taskAction(companyId, task.id, "cancel", { userId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("retries a [simulate:fail] task then fails it", async () => {
    const { companyId, emps } = await makeCompany("fail", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    const task = await createTask(companyId, { userId }, { title: "Broken React widget", description: "Do it [simulate:fail]", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    expect(task.maxAttempts).toBe(2);
    const s1 = await latestSession(task.id);
    const r1 = await runExecution(s1.id, fast);
    expect(r1).toMatchObject({ outcome: "finished", status: "FAILED" });
    const next = r1.outcome === "finished" ? r1.nextExecutionSessionId : null;
    expect(next).toBeTruthy();
    const s2 = await prisma.executionSession.findUniqueOrThrow({ where: { id: next! } });
    expect(s2.attempt).toBe(2);
    const r2 = await runExecution(s2.id, fast);
    expect(r2).toMatchObject({ outcome: "finished", status: "FAILED", nextExecutionSessionId: null });
    const t = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(t.status).toBe("FAILED");
    expect(t.errorMessage).toMatch(/simulated failure/);
    const types = await eventTypes(task.id);
    expect(isSubsequence(["execution.ended", "task.retry_scheduled", "task.started", "execution.ended", "task.failed"], types)).toBe(true);
    expect((await prisma.employeeCareerEvidence.findMany({ where: { employeeId: emps.Frontend } })).map((e) => e.kind)).toEqual(["TASK_FAILED"]);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: emps.Frontend } })).visualState).toBe("BLOCKED");
    // owner retry grants a new attempt
    const retried = await taskAction(companyId, task.id, "retry", { userId });
    expect(retried.status).toBe("IN_PROGRESS");
    expect((await latestSession(task.id)).attempt).toBe(3);
  });

  it("parks on approval for [simulate:block] and resumes when approved", async () => {
    const { companyId, emps } = await makeCompany("approval", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    const task = await createTask(companyId, { userId }, { title: "React page needing approval", description: "Write files [simulate:block]", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    const s = await latestSession(task.id);
    const running = runExecution(s.id, fast);
    let approval = null;
    for (let i = 0; i < 100 && !approval; i++) {
      await new Promise((r) => setTimeout(r, 20));
      approval = await prisma.approvalRequest.findFirst({ where: { taskId: task.id, status: "PENDING" } });
    }
    expect(approval).toBeTruthy();
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("WAITING_APPROVAL");
    expect((await prisma.executionSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("WAITING_APPROVAL");
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: emps.Frontend } })).visualState).toBe("WAITING_APPROVAL");
    await decideApproval(companyId, approval!.id, "APPROVED", { userId }, "go ahead");
    expect(await running).toMatchObject({ outcome: "finished", status: "SUCCEEDED" });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("REVIEW");
    expect(isSubsequence(["task.waiting_approval", "task.approval_decided", "employee.state", "execution.ended", "task.handoff"], await eventTypes(task.id))).toBe(true);
    await expect(decideApproval(companyId, approval!.id, "DENIED", { userId })).rejects.toMatchObject({ code: "CONFLICT" });

    // Denial via the task action → attempt fails and a retry is scheduled.
    const t2 = await createTask(companyId, { userId }, { title: "Another React page", description: "[simulate:block]", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    const s2 = await latestSession(t2.id);
    const run2 = runExecution(s2.id, fast);
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 20));
      if (await prisma.approvalRequest.findFirst({ where: { taskId: t2.id, status: "PENDING" } })) break;
    }
    await taskAction(companyId, t2.id, "reject", { userId }, "not now");
    expect(await run2).toMatchObject({ outcome: "finished", status: "FAILED" });
    expect(await eventTypes(t2.id)).toContain("task.retry_scheduled");
  });

  it("blocks when no qualified employee exists, and decomposes multi-specialty requests", async () => {
    const { companyId, emps } = await makeCompany("plan", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
      { name: "Backend", specialty: "BACKEND" },
    ]);
    const qa = await createTask(companyId, { userId }, { title: "Write Playwright e2e tests", description: "Regression coverage for checkout", priority: "NORMAL", submitToManager: true });
    expect(await runManagerPlan(qa.id)).toMatchObject({ outcome: "blocked" });
    const blocked = await prisma.task.findUniqueOrThrow({ where: { id: qa.id } });
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.errorMessage).toMatch(/No qualified QA employee/);
    expect(await eventTypes(qa.id)).toContain("task.blocked");

    const parent = await createTask(companyId, { userId }, {
      title: "Signup feature",
      description: "Deliverables:\n- Build the React signup form component\n- Add the signup API endpoint with Prisma",
      priority: "HIGH",
      submitToManager: true,
    });
    const p = await runManagerPlan(parent.id);
    expect(p.outcome).toBe("decomposed");
    const childIds = p.childIds!;
    expect(childIds).toHaveLength(2);
    for (const id of childIds) expect(await runManagerPlan(id)).toMatchObject({ outcome: "assigned" });
    const children = await prisma.task.findMany({ where: { parentTaskId: parent.id }, orderBy: { createdAt: "asc" } });
    expect(children.map((c) => c.assigneeId).sort()).toEqual([emps.Frontend, emps.Backend].sort());
    for (const c of children) {
      await runExecution((await latestSession(c.id)).id, fast);
      await runManagerReview(c.id, { idleDelayMs: 10 });
    }
    const doneParent = await prisma.task.findUniqueOrThrow({ where: { id: parent.id } });
    expect(doneParent.status).toBe("COMPLETED");
    expect(doneParent.plan).toMatchObject({ mode: "decomposed", source: "deterministic" });
  });

  it("waits for dependencies before planning", async () => {
    const { companyId, emps } = await makeCompany("deps", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    const first = await createTask(companyId, { userId }, { title: "React header", description: "component", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    const second = await createTask(companyId, { userId }, { title: "React footer", description: "component", priority: "NORMAL", submitToManager: true, dependsOn: [first.id] });
    expect(await runManagerPlan(second.id)).toMatchObject({ outcome: "waiting" });
    await runExecution((await latestSession(first.id)).id, fast);
    await runManagerReview(first.id, { idleDelayMs: 10 });
    expect(await runManagerPlan(second.id)).toMatchObject({ outcome: "assigned" });
    await expect(createTask(companyId, { userId }, { title: "Bad deps", description: "x".repeat(5), priority: "NORMAL", submitToManager: true, dependsOn: ["nope"] })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("serves the local-runner protocol (claim → events → approval → complete)", async () => {
    const { companyId, emps } = await makeCompany("runner", [
      { name: "Manager", specialty: "MANAGEMENT", manager: true },
      { name: "Frontend", specialty: "FRONTEND" },
    ]);
    // An `--auth env` runner only takes explicit API_KEY work (legacy runner connection with a key).
    const conn = await prisma.providerConnection.create({ data: { companyId, provider: "ANTHROPIC", mode: "LOCAL_RUNNER", authMode: "API_KEY", label: "My laptop" } });
    await prisma.employee.update({ where: { id: emps.Frontend }, data: { providerConnectionId: conn.id } });
    const token = generateToken();
    await prisma.runner.create({ data: { companyId, name: "laptop", tokenHash: hashToken(token) } });
    const runner = await authenticateRunner(`Bearer ${token}`);
    expect(runner).toBeTruthy();
    expect(await authenticateRunner("Bearer nope")).toBeNull();
    await runnerHeartbeat(runner!, { providers: ["ANTHROPIC"], auth: "env", version: "test" });

    await prisma.knowledgeEntry.create({ data: { companyId, kind: "OWNER_INSTRUCTION", provenance: "OWNER", status: "VERIFIED", title: `Runner page conventions ${RUN}`, content: "React page components must use the shared layout wrapper." } });
    const task = await createTask(companyId, { userId }, { title: "React page via runner", description: "React page component", priority: "NORMAL", submitToManager: false, assigneeId: emps.Frontend });
    const s = await latestSession(task.id);
    expect(s).toMatchObject({ mode: "LOCAL_RUNNER", provider: "anthropic", status: "QUEUED" });
    expect(await runExecution(s.id, fast)).toMatchObject({ outcome: "skipped" }); // worker never runs runner jobs

    const fresh = (await prisma.runner.findUniqueOrThrow({ where: { id: runner!.id } }));
    const job = await claimRunnerJob(fresh);
    expect(job).toMatchObject({ executionSessionId: s.id, provider: "ANTHROPIC", secret: null, authMode: "API_KEY" });
    expect(job!.systemPrompt).toMatch(/Untrusted content/);
    expect(job!.memoryContext).toContain(`Runner page conventions ${RUN}`);
    expect(await claimRunnerJob(fresh)).toBeNull();

    const r1 = await recordRunnerEvents(fresh, s.id, [
      { type: "event", event: { type: "message", role: "assistant", text: "hello from runner" } },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001, costSource: "provider_reported" } },
      { type: "approval_request", clientRequestId: "a1", approvalKind: "TOOL_USE", title: "Allow Bash: ls", payload: { tool: "Bash" } },
    ]);
    expect(r1.cancel).toBe(false);
    const approvalId = r1.approvals.a1!;
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("WAITING_APPROVAL");
    await decideApproval(companyId, approvalId, "APPROVED", { userId });
    const ctl = await getRunnerControl(fresh, s.id);
    expect(ctl.approvals).toEqual([{ id: approvalId, status: "APPROVED", note: null }]);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("IN_PROGRESS");

    const other = await prisma.runner.create({ data: { companyId, name: "other", tokenHash: hashToken(generateToken()) } });
    await expect(getRunnerControl(other, s.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const fin = await completeRunnerJob(fresh, s.id, {
      status: "SUCCEEDED",
      summary: "Done locally",
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001, costSource: "provider_reported" },
      artifacts: [{ name: "summary.md", kind: "TEXT", content: "Done locally" }],
    });
    expect(fin).toMatchObject({ status: "SUCCEEDED" });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("REVIEW");
    const usage = await prisma.usageRecord.findFirstOrThrow({ where: { executionSessionId: s.id } });
    expect(usage).toMatchObject({ source: "PROVIDER_REPORTED", costUsd: 0.001, provider: "anthropic" });
    await expect(completeRunnerJob(fresh, s.id, { status: "FAILED", summary: "", usage: usage as never, artifacts: [] })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
