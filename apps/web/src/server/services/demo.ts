/**
 * Visitor demo: unauthenticated, read-only, and restricted to rows whose
 * building AND company are `isDemo = true`. Nothing here writes.
 */
import { prisma } from "@agentopia/db";
import { z } from "zod";
import type { DemoBuilding, DemoScript } from "../../lib/api-types";
import demoScript from "../demo-script.json";
import { notFound } from "../errors";
import { getEmployeeDetail } from "./employees";
import { buildFloorView } from "./floor-view";
import { getTaskDetail } from "./tasks";
import { taskListSelect, toEventView, toTaskListItem } from "./views";

const DEMO_COMPANY = { isDemo: true, archivedAt: null, floor: { building: { isDemo: true } } } as const;

export async function getDemoBuilding(): Promise<DemoBuilding> {
  const b = await prisma.building.findFirst({
    where: { isDemo: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true,
      floors: {
        where: { archivedAt: null, company: { isDemo: true, archivedAt: null } },
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true, company: { select: { id: true, name: true } } },
      },
    },
  });
  if (!b) throw notFound("Demo building (run `pnpm db:seed`)");
  return b;
}

export function getDemoFloorView(floorId: string) {
  return buildFloorView(floorId, { demoOnly: true });
}

export async function getDemoEmployee(employeeId: string) {
  const e = await prisma.employee.findFirst({ where: { id: employeeId, company: DEMO_COMPANY }, select: { companyId: true } });
  if (!e) throw notFound("Employee");
  const detail = await getEmployeeDetail(e.companyId, employeeId);
  // Visitors see the public profile only; provider wiring is not exposed.
  return { ...detail, providerConnection: detail.providerConnection ? { ...detail.providerConnection, id: "demo" } : null, providerConnectionId: null };
}

export const DemoTasksQuery = z.object({ companyId: z.string().optional(), floorId: z.string().optional() });

export async function listDemoTasks(q: z.infer<typeof DemoTasksQuery>) {
  const rows = await prisma.task.findMany({
    where: {
      isDemo: true,
      company: { ...DEMO_COMPANY, ...(q.companyId ? { id: q.companyId } : {}), ...(q.floorId ? { floor: { id: q.floorId, building: { isDemo: true } } } : {}) },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: taskListSelect,
  });
  return { items: rows.map(toTaskListItem), nextCursor: null };
}

export async function getDemoTask(taskId: string) {
  const t = await prisma.task.findFirst({ where: { id: taskId, isDemo: true, company: DEMO_COMPANY }, select: { companyId: true } });
  if (!t) throw notFound("Task");
  const [detail, events] = await Promise.all([
    getTaskDetail(t.companyId, taskId, { isDemo: true }),
    prisma.taskEvent.findMany({ where: { taskId, companyId: t.companyId }, orderBy: { seq: "asc" }, take: 500 }),
  ]);
  return { ...detail, events: events.map(toEventView) };
}

export function getDemoScript(): DemoScript {
  const s = demoScript as unknown as DemoScript;
  return { ...s, simulated: true, events: s.events.map((e) => ({ ...e, simulated: true, payload: { ...e.payload, simulated: true } })) };
}
