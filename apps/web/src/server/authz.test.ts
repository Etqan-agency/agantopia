/**
 * Tenant isolation: user B must not read or modify anything in user A's company.
 * Handlers are invoked directly with a stubbed session (__setTestSession).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@agentopia/db";

vi.mock("./core", async (orig) => {
  const real = await orig<typeof import("./core")>();
  return {
    ...real,
    syncScheduleToQueue: vi.fn(async () => undefined),
    enqueueManagerReview: vi.fn(async () => undefined),
    createTask: vi.fn(async () => {
      throw new Error("createTask must not be reached by an unauthorized caller");
    }),
  };
});

import { actAs, call, cleanupUsers, makeUser } from "./test-utils";
import { createCompany } from "./services/companies";
import { requireCompanyAccess } from "./authz";
import * as company from "../app/api/companies/[cid]/route";
import * as employees from "../app/api/companies/[cid]/employees/route";
import * as employee from "../app/api/companies/[cid]/employees/[eid]/route";
import * as promptVersions from "../app/api/companies/[cid]/employees/[eid]/prompt-versions/route";
import * as rank from "../app/api/companies/[cid]/employees/[eid]/rank/route";
import * as tasks from "../app/api/companies/[cid]/tasks/route";
import * as task from "../app/api/companies/[cid]/tasks/[tid]/route";
import * as taskEvents from "../app/api/companies/[cid]/tasks/[tid]/events/route";
import * as providers from "../app/api/companies/[cid]/providers/route";
import * as provider from "../app/api/companies/[cid]/providers/[pid]/route";
import * as knowledge from "../app/api/companies/[cid]/knowledge/route";
import * as knowledgeDecide from "../app/api/companies/[cid]/knowledge/[kid]/decide/route";
import * as floorView from "../app/api/floors/[id]/view/route";
import * as floor from "../app/api/floors/[id]/route";
import * as events from "../app/api/companies/[cid]/events/route";
import * as me from "../app/api/me/route";

const users: string[] = [];
let A: Awaited<ReturnType<typeof makeUser>>;
let B: Awaited<ReturnType<typeof makeUser>>;
let aCompanyId: string;
let aFloorId: string;
let aManagerId: string;
let bCompanyId: string;
let aTaskId: string;
let aProviderId: string;
let aKnowledgeId: string;

beforeAll(async () => {
  A = await makeUser("a");
  B = await makeUser("b");
  users.push(A.id, B.id);
  const a = await createCompany(A.id, { name: "A Corp", timezone: "Africa/Cairo" });
  const b = await createCompany(B.id, { name: "B Corp", timezone: "Africa/Cairo" });
  aCompanyId = a.company.id;
  aFloorId = a.floorId;
  aManagerId = a.managerId;
  bCompanyId = b.company.id;
  aTaskId = (await prisma.task.create({ data: { companyId: aCompanyId, title: "Secret task", description: "A only" } })).id;
  aProviderId = (await prisma.providerConnection.create({ data: { companyId: aCompanyId, provider: "SIMULATED", mode: "SIMULATED", label: "sim" } })).id;
  aKnowledgeId = (
    await prisma.knowledgeEntry.create({ data: { companyId: aCompanyId, kind: "LEARNED_NOTE", provenance: "LEARNING_DETERMINISTIC", title: "draft", content: "x" } })
  ).id;
});

afterAll(async () => {
  actAs(null);
  await cleanupUsers(users);
});

describe("company creation", () => {
  it("creates floor, rooms, desks, manager with prompt v1 and a default schedule", async () => {
    const floorRow = await prisma.floor.findUniqueOrThrow({ where: { id: aFloorId }, include: { rooms: { include: { desks: true } } } });
    expect(floorRow.companyId).toBe(aCompanyId);
    expect(floorRow.rooms.length).toBe(7);
    const mgr = await prisma.employee.findUniqueOrThrow({ where: { id: aManagerId }, include: { promptVersions: true, desk: { include: { room: true } }, careerEvidence: true } });
    expect(mgr.role).toBe("MANAGER");
    expect(mgr.currentPromptVersion).toBe(1);
    expect(mgr.promptVersions).toHaveLength(1);
    expect(mgr.desk?.room.kind).toBe("MANAGER_OFFICE");
    expect(mgr.careerEvidence.map((e) => e.kind)).toContain("INITIALIZED_AS");
    expect(await prisma.learningSchedule.count({ where: { companyId: aCompanyId, employeeId: null } })).toBe(1);
  });

  it("owner sees the floor view; 401 without a session", async () => {
    actAs(A);
    const ok = await call(floorView.GET, { params: { id: aFloorId } });
    expect(ok.status).toBe(200);
    expect(ok.json.employees.some((e: { id: string }) => e.id === aManagerId)).toBe(true);
    actAs(null);
    const anon = await call(company.GET, { params: { cid: aCompanyId } });
    expect(anon.status).toBe(401);
    expect(anon.json.error.code).toBe("unauthorized");
  });
});

describe("cross-tenant access is denied", () => {
  it("service layer: B has no access to A's company", async () => {
    await expect(requireCompanyAccess(B.id, aCompanyId)).rejects.toMatchObject({ status: 403 });
  });

  it("B cannot read A's company, employees, tasks, events, providers, knowledge or floors", async () => {
    actAs(B);
    const reads = [
      call(company.GET, { params: { cid: aCompanyId } }),
      call(employees.GET, { params: { cid: aCompanyId } }),
      call(employee.GET, { params: { cid: aCompanyId, eid: aManagerId } }),
      call(promptVersions.GET, { params: { cid: aCompanyId, eid: aManagerId } }),
      call(tasks.GET, { params: { cid: aCompanyId } }),
      call(task.GET, { params: { cid: aCompanyId, tid: aTaskId } }),
      call(taskEvents.GET, { params: { cid: aCompanyId, tid: aTaskId } }),
      call(events.GET, { params: { cid: aCompanyId } }),
      call(providers.GET, { params: { cid: aCompanyId } }),
      call(knowledge.GET, { params: { cid: aCompanyId } }),
      call(floorView.GET, { params: { id: aFloorId } }),
    ];
    for (const r of await Promise.all(reads)) {
      expect(r.status).toBe(403);
      expect(r.json.error.code).toBe("forbidden");
    }
    const mine = await call(me.GET);
    expect(JSON.stringify(mine.json)).not.toContain(aCompanyId);
  });

  it("B cannot modify A's company, employees, tasks, providers, knowledge or floors", async () => {
    actAs(B);
    const writes = [
      call(company.PATCH, { method: "PATCH", params: { cid: aCompanyId }, body: { name: "pwned" } }),
      call(company.DELETE, { method: "DELETE", params: { cid: aCompanyId } }),
      call(employees.POST, { method: "POST", params: { cid: aCompanyId }, body: { name: "Mole", specialty: "QA" } }),
      call(employee.PATCH, { method: "PATCH", params: { cid: aCompanyId, eid: aManagerId }, body: { name: "pwned" } }),
      call(rank.POST, { method: "POST", params: { cid: aCompanyId, eid: aManagerId }, body: { rank: "TRAINEE", reason: "pwned" } }),
      call(tasks.POST, { method: "POST", params: { cid: aCompanyId }, body: { title: "evil task", description: "do evil things" } }),
      call(provider.DELETE, { method: "DELETE", params: { cid: aCompanyId, pid: aProviderId } }),
      call(knowledgeDecide.POST, { method: "POST", params: { cid: aCompanyId, kid: aKnowledgeId }, body: { decision: "APPROVED" } }),
      call(floor.PATCH, { method: "PATCH", params: { id: aFloorId }, body: { name: "pwned" } }),
    ];
    for (const r of await Promise.all(writes)) expect([403, 404]).toContain(r.status);
    const c = await prisma.company.findUniqueOrThrow({ where: { id: aCompanyId } });
    expect(c.name).toBe("A Corp");
    expect(c.archivedAt).toBeNull();
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: aManagerId } })).rank).toBe("SENIOR");
    expect((await prisma.providerConnection.findUniqueOrThrow({ where: { id: aProviderId } })).status).not.toBe("REVOKED");
    expect((await prisma.knowledgeEntry.findUniqueOrThrow({ where: { id: aKnowledgeId } })).status).toBe("DRAFT");
    expect((await prisma.floor.findUniqueOrThrow({ where: { id: aFloorId } })).name).not.toBe("pwned");
  });

  it("IDOR through B's own company path with A's ids returns 404", async () => {
    actAs(B);
    const rs = await Promise.all([
      call(employee.GET, { params: { cid: bCompanyId, eid: aManagerId } }),
      call(employee.PATCH, { method: "PATCH", params: { cid: bCompanyId, eid: aManagerId }, body: { name: "pwned" } }),
      call(task.GET, { params: { cid: bCompanyId, tid: aTaskId } }),
      call(taskEvents.GET, { params: { cid: bCompanyId, tid: aTaskId } }),
      call(provider.DELETE, { method: "DELETE", params: { cid: bCompanyId, pid: aProviderId } }),
      call(knowledgeDecide.POST, { method: "POST", params: { cid: bCompanyId, kid: aKnowledgeId }, body: { decision: "APPROVED" } }),
    ]);
    for (const r of rs) expect(r.status).toBe(404);
    // Hiring into B's company while pointing at A's manager / provider is rejected.
    const hire = await call(employees.POST, { method: "POST", params: { cid: bCompanyId }, body: { name: "X", specialty: "QA", reportsToId: aManagerId } });
    expect(hire.status).toBe(400);
    const hire2 = await call(employees.POST, { method: "POST", params: { cid: bCompanyId }, body: { name: "X", specialty: "QA", providerConnectionId: aProviderId } });
    expect(hire2.status).toBe(400);
  });

  it("archived companies are 404 even for the owner", async () => {
    const extra = await createCompany(A.id, { name: "Temp", timezone: "UTC" });
    actAs(A);
    expect((await call(company.DELETE, { method: "DELETE", params: { cid: extra.company.id } })).status).toBe(200);
    expect((await call(company.GET, { params: { cid: extra.company.id } })).status).toBe(404);
  });
});

describe("validation and error shape", () => {
  it("rejects invalid bodies with 400 validation_error", async () => {
    actAs(A);
    const r = await call(employees.POST, { method: "POST", params: { cid: aCompanyId }, body: { name: "", specialty: "CHEF" } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("validation_error");
    expect(Array.isArray(r.json.error.details)).toBe(true);
  });

  it("hires an employee from a template into the specialty room", async () => {
    actAs(A);
    const r = await call(employees.POST, { method: "POST", params: { cid: aCompanyId }, body: { name: "Quinn", specialty: "QA", rank: "EXPERT" } });
    expect(r.status).toBe(201);
    expect(r.json.desk.roomKind).toBe("QA");
    expect(r.json.evidence.map((e: { kind: string }) => e.kind)).toEqual(["INITIALIZED_AS"]);
    expect(r.json.prompt.version).toBe(1);
    expect(r.json.skills.length).toBeGreaterThan(0);
    const audit = await prisma.auditLog.findFirst({ where: { companyId: aCompanyId, action: "employee.hire", entityId: r.json.id } });
    expect(audit).not.toBeNull();
  });
});
