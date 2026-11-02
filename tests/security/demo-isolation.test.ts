/** Visitor demo routes are unauthenticated and must only ever expose demo rows. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/server/core", async (orig) => {
  const real = await orig<typeof import("../../apps/web/src/server/core")>();
  return { ...real, syncScheduleToQueue: vi.fn(async () => undefined) };
});

import { actAs, call, cleanupUsers, makeUser, prisma } from "../../apps/web/src/server/test-utils";
import { createCompany } from "../../apps/web/src/server/services/companies";
import * as demoBuilding from "../../apps/web/src/app/api/demo/building/route";
import * as demoFloor from "../../apps/web/src/app/api/demo/floors/[fid]/view/route";
import * as demoEmployee from "../../apps/web/src/app/api/demo/employees/[eid]/route";
import * as demoTasks from "../../apps/web/src/app/api/demo/tasks/route";
import * as demoTask from "../../apps/web/src/app/api/demo/tasks/[tid]/route";
import * as demoScript from "../../apps/web/src/app/api/demo/script/route";

const users: string[] = [];
let real: { cid: string; floorId: string; managerId: string; taskId: string; flaggedTaskId: string };

beforeAll(async () => {
  actAs(null); // demo routes need no session
  const u = await makeUser("demo");
  users.push(u.id);
  const c = await createCompany(u.id, { name: "Private Co", timezone: "UTC" });
  const t = await prisma.task.create({ data: { companyId: c.company.id, title: "private task", description: "private" } });
  // A task wrongly flagged isDemo on a NON-demo company must still be hidden.
  const flagged = await prisma.task.create({ data: { companyId: c.company.id, title: "flagged private task", description: "private", isDemo: true } });
  real = { cid: c.company.id, floorId: c.floorId, managerId: c.managerId, taskId: t.id, flaggedTaskId: flagged.id };
  // Ensure the seeded demo exists (pnpm db:seed); tests below need it.
  expect(await prisma.building.count({ where: { isDemo: true } })).toBeGreaterThan(0);
});

afterAll(async () => {
  await cleanupUsers(users);
});

describe("demo routes", () => {
  it("building lists only demo floors/companies", async () => {
    const r = await call(demoBuilding.GET);
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(real.cid);
    const ids = r.json.floors.map((f: { company: { id: string } }) => f.company.id);
    const companies = await prisma.company.findMany({ where: { id: { in: ids } } });
    expect(companies.every((c) => c.isDemo)).toBe(true);
  });

  it("task list contains only demo tasks of demo companies", async () => {
    const r = await call(demoTasks.GET);
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
    const ids = r.json.items.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(real.taskId);
    expect(ids).not.toContain(real.flaggedTaskId);
    const rows = await prisma.task.findMany({ where: { id: { in: ids } }, include: { company: true } });
    expect(rows.every((t) => t.isDemo && t.company.isDemo)).toBe(true);
    // Filtering by a real company id yields nothing.
    expect((await call(demoTasks.GET, { query: { companyId: real.cid } })).json.items).toEqual([]);
  });

  it("non-demo floor, employee and task ids are 404", async () => {
    expect((await call(demoFloor.GET, { params: { fid: real.floorId } })).status).toBe(404);
    expect((await call(demoEmployee.GET, { params: { eid: real.managerId } })).status).toBe(404);
    expect((await call(demoTask.GET, { params: { tid: real.taskId } })).status).toBe(404);
    expect((await call(demoTask.GET, { params: { tid: real.flaggedTaskId } })).status).toBe(404);
  });

  it("demo floor view and task timeline work and are simulated", async () => {
    const b = await call(demoBuilding.GET);
    const floorId = b.json.floors[0].id;
    const v = await call(demoFloor.GET, { params: { fid: floorId } });
    expect(v.status).toBe(200);
    expect(v.json.company.isDemo).toBe(true);
    expect(v.json.employees.length).toBeGreaterThan(0);
    const tasks = await call(demoTasks.GET);
    const t = await call(demoTask.GET, { params: { tid: tasks.json.items[0].id } });
    expect(t.status).toBe(200);
    expect(t.json.events.length).toBeGreaterThan(0);
    expect(t.json.events.every((e: { simulated?: boolean }) => e.simulated === true)).toBe(true);
    expect(t.text).not.toContain("encryptedSecret");
  });

  it("script events are all simulated and reference seeded demo employees", async () => {
    const s = await call(demoScript.GET);
    expect(s.status).toBe(200);
    expect(s.json.events.length).toBeGreaterThanOrEqual(25);
    expect(s.json.events.every((e: { simulated: boolean; payload: { simulated: boolean } }) => e.simulated && e.payload.simulated)).toBe(true);
    const empIds = [...new Set(s.json.events.map((e: { employeeId: string | null }) => e.employeeId).filter(Boolean))] as string[];
    const found = await prisma.employee.findMany({ where: { id: { in: empIds } }, include: { company: true } });
    expect(found.length).toBe(empIds.length);
    expect(found.every((e) => e.company.isDemo)).toBe(true);
  });
});
