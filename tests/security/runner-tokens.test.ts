/** Runner bearer tokens: scoped to one company, revocable, never usable across tenants. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/core", async (orig) => {
  const real = await orig<typeof import("../../apps/web/src/server/core")>();
  return { ...real, syncScheduleToQueue: vi.fn(async () => undefined), enqueueManagerReview: vi.fn(async () => undefined) };
});

import { actAs, call, cleanupUsers, makeUser, prisma } from "../../apps/web/src/server/test-utils";
import { createCompany } from "../../apps/web/src/server/services/companies";
import * as runners from "../../apps/web/src/app/api/companies/[cid]/runners/route";
import * as runnerRevoke from "../../apps/web/src/app/api/companies/[cid]/runners/[rid]/route";
import * as heartbeat from "../../apps/web/src/app/api/runner/heartbeat/route";
import * as claim from "../../apps/web/src/app/api/runner/jobs/claim/route";
import * as jobEvents from "../../apps/web/src/app/api/runner/jobs/[sid]/events/route";
import * as complete from "../../apps/web/src/app/api/runner/jobs/[sid]/complete/route";
import * as control from "../../apps/web/src/app/api/runner/jobs/[sid]/control/route";

const users: string[] = [];
const ctx: Record<"A" | "B", { cid: string; managerId: string; token: string; runnerId: string; sessionId: string; taskId: string }> = {} as never;
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
/** Core runner protocol capabilities (packages/core/src/runner/protocol.ts). */
const CAPS = { providers: ["ANTHROPIC", "OPENAI"], auth: "subscription", version: "test", hostname: "ci" };
const USAGE = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001, costSource: "provider_reported" };

async function queuedSession(companyId: string, employeeId: string) {
  const task = await prisma.task.create({ data: { companyId, title: "runner job", description: "do it", status: "ASSIGNED", assigneeId: employeeId } });
  const s = await prisma.executionSession.create({ data: { companyId, taskId: task.id, employeeId, attempt: 1, provider: "anthropic", mode: "LOCAL_RUNNER", status: "QUEUED" } });
  return { taskId: task.id, sessionId: s.id };
}

beforeAll(async () => {
  for (const key of ["A", "B"] as const) {
    const u = await makeUser(`run${key}`);
    users.push(u.id);
    const c = await createCompany(u.id, { name: `Runner ${key}`, timezone: "UTC" });
    actAs(u);
    const r = await call(runners.POST, { method: "POST", params: { cid: c.company.id }, body: { name: `laptop-${key}` } });
    expect(r.status).toBe(201);
    expect(typeof r.json.token).toBe("string");
    const { taskId, sessionId } = await queuedSession(c.company.id, c.managerId);
    ctx[key] = { cid: c.company.id, managerId: c.managerId, token: r.json.token, runnerId: r.json.runner.id, sessionId, taskId };
  }
});

afterAll(async () => {
  actAs(null);
  await cleanupUsers(users);
});

describe("runner tokens", () => {
  it("token is stored hashed and never listed", async () => {
    const row = await prisma.runner.findUniqueOrThrow({ where: { id: ctx.A.runnerId } });
    expect(row.tokenHash).not.toBe(ctx.A.token);
    actAs({ id: (await prisma.company.findUniqueOrThrow({ where: { id: ctx.A.cid } })).ownerId, email: "x", name: "x" });
    const list = await call(runners.GET, { params: { cid: ctx.A.cid } });
    expect(list.text).not.toContain(ctx.A.token);
    expect(list.text).not.toContain(row.tokenHash);
  });

  it("missing or bogus tokens are rejected with 401", async () => {
    expect((await call(heartbeat.POST, { method: "POST", body: { capabilities: CAPS } })).status).toBe(401);
    expect((await call(claim.POST, { method: "POST", headers: bearer("x".repeat(43)) })).status).toBe(401);
  });

  it("A's runner claims only A's session, never B's", async () => {
    const hb = await call(heartbeat.POST, { method: "POST", headers: bearer(ctx.A.token), body: { capabilities: CAPS } });
    expect(hb.status).toBe(200);
    const r = await call(claim.POST, { method: "POST", headers: bearer(ctx.A.token), body: { capabilities: CAPS } });
    expect(r.status).toBe(200);
    expect(r.json.job.executionSessionId).toBe(ctx.A.sessionId);
    expect(r.json.job.companyId).toBe(ctx.A.cid);
    expect(r.json.job.secret).toBeNull(); // subscription: the runner uses the CLI sign-in on the machine
    const again = await call(claim.POST, { method: "POST", headers: bearer(ctx.A.token), body: { capabilities: CAPS } });
    expect(again.json.job).toBeNull();
    const b = await prisma.executionSession.findUniqueOrThrow({ where: { id: ctx.B.sessionId } });
    expect(b.status).toBe("QUEUED");
    expect(b.runnerId).toBeNull();
  });

  it("A's token cannot post events, poll control, or complete B's session", async () => {
    const ev = await call(jobEvents.POST, {
      method: "POST", headers: bearer(ctx.A.token), params: { sid: ctx.B.sessionId },
      body: { items: [{ type: "event", event: { type: "progress", text: "spoof" } }] },
    });
    expect(ev.status).toBe(403);
    const ctl = await call(control.GET, { headers: bearer(ctx.A.token), params: { sid: ctx.B.sessionId } });
    expect(ctl.status).toBe(403);
    const done = await call(complete.POST, {
      method: "POST", headers: bearer(ctx.A.token), params: { sid: ctx.B.sessionId },
      body: { status: "SUCCEEDED", summary: "spoof", usage: USAGE, artifacts: [] },
    });
    expect(done.status).toBe(403);
    expect(await prisma.taskEvent.count({ where: { companyId: ctx.B.cid, type: "task.progress" } })).toBe(0);
  });

  it("A's runner can report on its own leased session and complete it", async () => {
    const ev = await call(jobEvents.POST, {
      method: "POST", headers: bearer(ctx.A.token), params: { sid: ctx.A.sessionId },
      body: { items: [{ type: "event", event: { type: "tool_use", tool: "Read", input: {} } }, { type: "usage", usage: USAGE }] },
    });
    expect(ev.status).toBe(200);
    expect(ev.json.ok).toBe(true);
    const done = await call(complete.POST, {
      method: "POST", headers: bearer(ctx.A.token), params: { sid: ctx.A.sessionId },
      body: { status: "SUCCEEDED", summary: "ok", usage: USAGE, artifacts: [{ name: "out.md", kind: "TEXT", content: "# hi" }] },
    });
    expect(done.status).toBe(200);
    const s = await prisma.executionSession.findUniqueOrThrow({ where: { id: ctx.A.sessionId } });
    expect(s.status).toBe("SUCCEEDED");
    expect(await prisma.artifact.count({ where: { executionSessionId: s.id } })).toBe(1);
    expect(await prisma.usageRecord.count({ where: { executionSessionId: s.id, source: "PROVIDER_REPORTED" } })).toBe(1);
  });

  it("revoked tokens stop working", async () => {
    const ownerA = (await prisma.company.findUniqueOrThrow({ where: { id: ctx.A.cid } })).ownerId;
    actAs({ id: ownerA, email: "x", name: "x" });
    expect((await call(runnerRevoke.DELETE, { method: "DELETE", params: { cid: ctx.A.cid, rid: ctx.A.runnerId } })).status).toBe(200);
    expect((await call(heartbeat.POST, { method: "POST", headers: bearer(ctx.A.token), body: { capabilities: CAPS } })).status).toBe(401);
  });

  it("B's owner cannot revoke A's runner", async () => {
    const ownerB = (await prisma.company.findUniqueOrThrow({ where: { id: ctx.B.cid } })).ownerId;
    actAs({ id: ownerB, email: "x", name: "x" });
    expect((await call(runnerRevoke.DELETE, { method: "DELETE", params: { cid: ctx.A.cid, rid: ctx.A.runnerId } })).status).toBe(403);
    expect((await call(runnerRevoke.DELETE, { method: "DELETE", params: { cid: ctx.B.cid, rid: ctx.A.runnerId } })).status).toBe(404);
  });
});
