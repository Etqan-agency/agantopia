/**
 * FloorView builder: the office hot path. Exactly 4 SQL round-trips
 * (floor+company, rooms+desks, employees+active task, task summary); the last
 * three run in parallel.
 */
import { prisma } from "@agentopia/db";
import { DEFAULT_LAYOUT, isValidTimeZone, type DeskView, type FloorLayout, type FloorView, type RoomKind, type VisualState } from "@agentopia/shared";
import { notFound } from "../errors";
import { toAvatar } from "./views";

type FloorRow = {
  id: string; name: string; order: number; buildingId: string; layout: unknown; archivedAt: Date | null; buildingIsDemo: boolean;
  companyId: string | null; companyName: string | null; companyIsDemo: boolean | null; companyArchivedAt: Date | null; timezone: string | null;
};
type RoomRow = { id: string; name: string; kind: string; x: number; y: number; w: number; h: number; deskId: string | null; dx: number | null; dy: number | null; facing: string | null; employeeId: string | null };
type EmpRow = { id: string; name: string; title: string; specialty: string; role: string; rank: string; status: string; visualState: string; avatar: unknown; provider: string | null; deskId: string | null; currentTaskId: string | null };
type SummaryRow = { active: number; review: number; blocked: number; completedToday: number };

function toLayout(v: unknown): FloorLayout {
  if (v && typeof v === "object" && typeof (v as FloorLayout).width === "number") return { ...DEFAULT_LAYOUT, ...(v as FloorLayout) };
  return DEFAULT_LAYOUT;
}

const FACINGS = new Set(["up", "down", "left", "right"]);

/**
 * Build the FloorView. Authorization must be done by the caller
 * (requireFloorAccess), or pass `demoOnly` for the visitor demo, which 404s
 * unless both the building and the company are demo rows.
 */
export async function buildFloorView(floorId: string, opts: { demoOnly?: boolean } = {}): Promise<FloorView> {
  const floors = await prisma.$queryRaw<FloorRow[]>`
    SELECT f.id, f.name, f."order", f."buildingId", f.layout, f."archivedAt", b."isDemo" AS "buildingIsDemo",
           c.id AS "companyId", c.name AS "companyName", c."isDemo" AS "companyIsDemo", c."archivedAt" AS "companyArchivedAt", c.timezone
    FROM "Floor" f
    JOIN "Building" b ON b.id = f."buildingId"
    LEFT JOIN "Company" c ON c.id = f."companyId"
    WHERE f.id = ${floorId}`;
  const floor = floors[0];
  if (!floor || floor.archivedAt) throw notFound("Floor");
  if (opts.demoOnly && !(floor.buildingIsDemo && floor.companyIsDemo)) throw notFound("Floor");
  const companyId = floor.companyId && !floor.companyArchivedAt ? floor.companyId : null;
  // Legacy rows may hold an unknown zone; never let it reach `AT TIME ZONE`.
  const tz = floor.timezone && isValidTimeZone(floor.timezone) ? floor.timezone : "UTC";

  const [roomRows, empRows, summaryRows] = await Promise.all([
    prisma.$queryRaw<RoomRow[]>`
      SELECT r.id, r.name, r.kind::text AS kind, r.x, r.y, r.w, r.h,
             d.id AS "deskId", d.x AS dx, d.y AS dy, d.facing, d."employeeId"
      FROM "Room" r LEFT JOIN "Desk" d ON d."roomId" = r.id
      WHERE r."floorId" = ${floorId}
      ORDER BY r."order", r.id, d.y, d.x`,
    companyId
      ? prisma.$queryRaw<EmpRow[]>`
      SELECT e.id, e.name, e.title, e.specialty::text AS specialty, e.role::text AS role, e.rank::text AS rank, e.status::text AS status,
             e."visualState"::text AS "visualState", e.avatar, pc.provider::text AS provider, d.id AS "deskId", a."taskId" AS "currentTaskId"
      FROM "Employee" e
      LEFT JOIN "ProviderConnection" pc ON pc.id = e."providerConnectionId"
      LEFT JOIN "Desk" d ON d."employeeId" = e.id
      LEFT JOIN LATERAL (
        SELECT a."taskId" FROM "Assignment" a JOIN "Task" t ON t.id = a."taskId"
        WHERE a."employeeId" = e.id AND a.status = 'ACTIVE'
          AND t.status IN ('PLANNING','ASSIGNED','IN_PROGRESS','WAITING_APPROVAL','REVIEW')
        ORDER BY a."createdAt" DESC LIMIT 1
      ) a ON true
      WHERE e."companyId" = ${companyId} AND e.status <> 'ARCHIVED'
      ORDER BY e.role, e."createdAt"`
      : Promise.resolve([] as EmpRow[]),
    companyId
      ? prisma.$queryRaw<SummaryRow[]>`
      SELECT count(*) FILTER (WHERE status IN ('PLANNING','ASSIGNED','IN_PROGRESS','WAITING_APPROVAL'))::int AS active,
             count(*) FILTER (WHERE status = 'REVIEW')::int AS review,
             count(*) FILTER (WHERE status = 'BLOCKED')::int AS blocked,
             count(*) FILTER (WHERE status = 'COMPLETED'
               AND "completedAt" >= (date_trunc('day', now() AT TIME ZONE ${tz}) AT TIME ZONE ${tz}))::int AS "completedToday"
      FROM "Task" WHERE "companyId" = ${companyId}`
      : Promise.resolve([{ active: 0, review: 0, blocked: 0, completedToday: 0 }]),
  ]);

  const rooms = new Map<string, FloorView["rooms"][number]>();
  for (const r of roomRows) {
    let room = rooms.get(r.id);
    if (!room) {
      room = { id: r.id, name: r.name, kind: r.kind as RoomKind, x: r.x, y: r.y, w: r.w, h: r.h, desks: [] };
      rooms.set(r.id, room);
    }
    if (r.deskId) {
      room.desks.push({
        id: r.deskId, x: r.dx ?? 0, y: r.dy ?? 0,
        facing: (FACINGS.has(r.facing ?? "") ? r.facing : "down") as DeskView["facing"],
        employeeId: r.employeeId,
      });
    }
  }

  const s = summaryRows[0] ?? { active: 0, review: 0, blocked: 0, completedToday: 0 };
  return {
    id: floor.id,
    name: floor.name,
    order: floor.order,
    buildingId: floor.buildingId,
    company: companyId ? { id: companyId, name: floor.companyName ?? "", isDemo: !!floor.companyIsDemo } : null,
    layout: toLayout(floor.layout),
    rooms: [...rooms.values()],
    employees: empRows.map((e) => ({
      id: e.id, name: e.name, title: e.title, specialty: e.specialty, role: e.role as "MANAGER" | "EMPLOYEE", rank: e.rank,
      status: e.status as "ACTIVE" | "PAUSED" | "ARCHIVED",
      visualState: (e.status === "PAUSED" ? "OFFLINE" : e.visualState) as VisualState,
      avatar: toAvatar(e.avatar), deskId: e.deskId, currentTaskId: e.currentTaskId, provider: e.provider,
    })),
    taskSummary: { active: Number(s.active), review: Number(s.review), blocked: Number(s.blocked), completedToday: Number(s.completedToday) },
  };
}
