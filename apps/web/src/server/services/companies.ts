import { prisma, Prisma } from "@agentopia/db";
import {
  CompanySettingsSchema, DEFAULT_LAYOUT, DEFAULT_ROOMS, LearningConfigSchema, ROLE_TEMPLATES,
  type CreateCompanyInput, type CreateFloorInput, type RenameBuildingInput, type UpdateCompanyInput, type UpdateFloorInput,
} from "@agentopia/shared";
import type { z } from "zod";
import type { CompanyRaw, MeResponse } from "../../lib/api-types";
import { audit } from "../audit";
import { requireBuildingAccess, requireCompanyAccess, requireFloorAccess, type SessionUser } from "../authz";
import { syncScheduleToQueue } from "../core";
import { conflict, notFound } from "../errors";
import { createEmployeeTx, ensureGlobalSkills, findFreeDesk, resolveSkillSlugs } from "./employee-factory";
import { companySettings } from "./views";

// --- Me ------------------------------------------------------------------------------
export async function getMe(user: SessionUser): Promise<MeResponse> {
  const uid = user.id;
  const accessible = { archivedAt: null, OR: [{ ownerId: uid }, { memberships: { some: { userId: uid } } }] } satisfies Prisma.CompanyWhereInput;
  const [dbUser, buildings] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true, email: true, image: true } }),
    prisma.building.findMany({
      where: { OR: [{ ownerId: uid }, { floors: { some: { archivedAt: null, company: accessible } } }] },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, isDemo: true, ownerId: true,
        floors: {
          where: { archivedAt: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true, name: true, order: true, companyId: true,
            company: { select: { id: true, name: true, archivedAt: true, ownerId: true, memberships: { where: { userId: uid }, select: { id: true } } } },
          },
        },
      },
    }),
  ]);
  const out: MeResponse["buildings"] = buildings.map((b) => {
    const isOwner = b.ownerId === uid;
    const floors = b.floors
      .filter((f) => isOwner || (f.company && !f.company.archivedAt && (f.company.ownerId === uid || f.company.memberships.length > 0)))
      .map((f) => {
        const company = f.company && !f.company.archivedAt ? { id: f.company.id, name: f.company.name } : null;
        return { id: f.id, name: f.name, order: f.order, companyId: company?.id ?? null, company };
      });
    return { id: b.id, name: b.name, isDemo: b.isDemo, isOwner, floors };
  });
  const defaultCompanyId = out.flatMap((b) => b.floors).find((f) => f.companyId)?.companyId ?? null;
  return {
    user: dbUser ? { ...dbUser, image: dbUser.image ?? null } : { id: user.id, name: user.name, email: user.email, image: null },
    buildings: out,
    defaultCompanyId,
  };
}

// --- Buildings / floors ------------------------------------------------------------------
export async function createBuilding(userId: string, input: z.infer<typeof RenameBuildingInput>) {
  const b = await prisma.building.create({ data: { ownerId: userId, name: input.name }, select: { id: true, name: true, isDemo: true, createdAt: true, updatedAt: true } });
  await audit(null, userId, "building.create", "Building", b.id, { name: b.name });
  return b;
}

export async function renameBuilding(userId: string, buildingId: string, input: z.infer<typeof RenameBuildingInput>) {
  await requireBuildingAccess(userId, buildingId, { write: true });
  const b = await prisma.building.update({ where: { id: buildingId }, data: { name: input.name }, select: { id: true, name: true, isDemo: true, createdAt: true, updatedAt: true } });
  await audit(null, userId, "building.rename", "Building", b.id, { name: b.name });
  return b;
}

async function nextFloorOrder(tx: Prisma.TransactionClient, buildingId: string) {
  const agg = await tx.floor.aggregate({ where: { buildingId }, _max: { order: true } });
  return (agg._max.order ?? 0) + 1;
}

const floorSelect = { id: true, name: true, order: true, buildingId: true, companyId: true, archivedAt: true, createdAt: true, updatedAt: true } satisfies Prisma.FloorSelect;

export async function createFloor(userId: string, input: z.infer<typeof CreateFloorInput>) {
  await requireBuildingAccess(userId, input.buildingId, { write: true });
  const floor = await prisma.$transaction(async (tx) =>
    tx.floor.create({
      data: { buildingId: input.buildingId, name: input.name, order: await nextFloorOrder(tx, input.buildingId), layout: DEFAULT_LAYOUT as unknown as Prisma.InputJsonValue },
      select: floorSelect,
    }),
  );
  await audit(null, userId, "floor.create", "Floor", floor.id, { buildingId: input.buildingId, name: input.name });
  return floor;
}

export async function updateFloor(userId: string, floorId: string, input: z.infer<typeof UpdateFloorInput>) {
  const { floor } = await requireFloorAccess(userId, floorId, { write: true });
  if (input.archived === true && floor.companyId) {
    const c = await prisma.company.findUnique({ where: { id: floor.companyId }, select: { archivedAt: true } });
    if (c && !c.archivedAt) throw conflict("Archive the company on this floor before archiving the floor");
  }
  const updated = await prisma.floor.update({
    where: { id: floorId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
    },
    select: floorSelect,
  });
  await audit(floor.companyId, userId, "floor.update", "Floor", floorId, input);
  return updated;
}

// --- Companies ------------------------------------------------------------------------------
const MANAGER_NAME = "Morgan Hale";

export async function createCompany(userId: string, input: z.infer<typeof CreateCompanyInput>) {
  if (input.buildingId) await requireBuildingAccess(userId, input.buildingId, { write: true });
  const settings = CompanySettingsSchema.parse({});
  const learning = LearningConfigSchema.parse({ timezone: input.timezone });
  const tpl = ROLE_TEMPLATES.MANAGEMENT;

  const result = await prisma.$transaction(
    async (tx) => {
      let buildingId = input.buildingId;
      if (!buildingId) {
        const first = await tx.building.findFirst({ where: { ownerId: userId, isDemo: false }, orderBy: { createdAt: "asc" }, select: { id: true } });
        buildingId = first?.id ?? (await tx.building.create({ data: { ownerId: userId, name: "My building" }, select: { id: true } })).id;
      }
      const company = await tx.company.create({
        data: { ownerId: userId, name: input.name, timezone: input.timezone, settings: settings as Prisma.InputJsonValue, memberships: { create: { userId, role: "OWNER" } } },
      });
      const floor = await tx.floor.create({
        data: {
          buildingId, companyId: company.id, name: input.floorName ?? input.name,
          order: await nextFloorOrder(tx, buildingId), layout: DEFAULT_LAYOUT as unknown as Prisma.InputJsonValue,
        },
      });
      for (const [i, r] of DEFAULT_ROOMS.entries()) {
        await tx.room.create({
          data: {
            floorId: floor.id, companyId: company.id, name: r.name, kind: r.kind, x: r.x, y: r.y, w: r.w, h: r.h, order: i,
            desks: { create: r.deskSlots.map((d) => ({ x: d.x, y: d.y, facing: d.facing })) },
          },
        });
      }
      await ensureGlobalSkills(tx);
      const skillIds = await resolveSkillSlugs(tx, company.id, tpl.skills);
      const deskId = await findFreeDesk(tx, company.id, { kind: "MANAGER_OFFICE" });
      const manager = await createEmployeeTx(tx, {
        companyId: company.id, name: MANAGER_NAME, specialty: "MANAGEMENT", role: "MANAGER", rank: "SENIOR",
        title: tpl.title, department: tpl.department, prompt: tpl.prompt, skillIds, topics: tpl.topics, deskId, createdById: userId,
        initializedSummary: "Initialized as SENIOR manager at company creation (assigned rank, not demonstrated experience).",
      });
      const schedule = await tx.learningSchedule.create({ data: { companyId: company.id, employeeId: null, ...learning } });
      return { company, floor, buildingId, manager, schedule };
    },
    { timeout: 20000 },
  );

  await syncScheduleToQueue(result.schedule.id);
  await audit(result.company.id, userId, "company.create", "Company", result.company.id, { name: input.name, floorId: result.floor.id, buildingId: result.buildingId });
  return {
    company: await getCompany(userId, result.company.id),
    floorId: result.floor.id,
    buildingId: result.buildingId,
    managerId: result.manager.id,
  };
}

export async function getCompany(userId: string, companyId: string): Promise<CompanyRaw> {
  const { role } = await requireCompanyAccess(userId, companyId);
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, timezone: true, isDemo: true, settings: true, createdAt: true, updatedAt: true, floor: { select: { id: true, name: true, order: true, buildingId: true } } },
  });
  if (!c) throw notFound("Company");
  return { ...c, settings: companySettings(c.settings), role };
}

export async function updateCompany(userId: string, companyId: string, input: z.infer<typeof UpdateCompanyInput>) {
  const { company } = await requireCompanyAccess(userId, companyId, { owner: true });
  const settings = input.settings ? CompanySettingsSchema.parse({ ...companySettings(company.settings), ...input.settings }) : undefined;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(settings ? { settings: settings as Prisma.InputJsonValue } : {}),
    },
  });
  await audit(companyId, userId, "company.update", "Company", companyId, input);
  return getCompany(userId, companyId);
}

export async function archiveCompany(userId: string, companyId: string) {
  await requireCompanyAccess(userId, companyId, { owner: true });
  const now = new Date();
  await prisma.$transaction([
    prisma.company.update({ where: { id: companyId }, data: { archivedAt: now } }),
    prisma.floor.updateMany({ where: { companyId }, data: { archivedAt: now } }),
    prisma.learningSchedule.updateMany({ where: { companyId }, data: { enabled: false } }),
  ]);
  // Unschedule learning jobs for the archived company.
  const schedules = await prisma.learningSchedule.findMany({ where: { companyId }, select: { id: true } });
  for (const s of schedules) await syncScheduleToQueue(s.id);
  await audit(companyId, userId, "company.archive", "Company", companyId, {});
  return { ok: true, archivedAt: now };
}
