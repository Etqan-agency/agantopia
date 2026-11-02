import { prisma, Prisma, type Specialty as DbSpecialty } from "@agentopia/db";
import {
  compilePrompt, PromptFieldsSchema, ROLE_TEMPLATES, SPECIALTIES,
  type CreatePromptVersionInput, type HireEmployeeInput, type OverrideRankInput, type SetEmployeeSkillsInput, type UpdateEmployeeInput,
  type KnowledgeStatus,
} from "@agentopia/shared";
import { z } from "zod";
import type { EmployeeDetailRaw, EmployeeListItemRaw } from "../../lib/api-types";
import { audit } from "../audit";
import { emitEvent, ensureDefaultSources, overrideRank as coreOverrideRank } from "../core";
import { badRequest, conflict, notFound } from "../errors";
import { pageArgs, toPage } from "../http";
import { createEmployeeTx, ensureGlobalSkills, findFreeDesk, resolveSkillSlugs, specialtyRoom } from "./employee-factory";
import { getEffectiveSchedule } from "./learning";
import {
  addTotals, emptyTotals, employeeListSelect, learningRunSelect, taskListSelect, toAvatar, toEmployeeListItem, toLearningRun, toPromptVersion, toTaskListItem,
} from "./views";

export const EmployeeListQuery = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  specialty: z.enum(SPECIALTIES).optional(),
});

async function requireEmployee(companyId: string, employeeId: string) {
  const e = await prisma.employee.findFirst({ where: { id: employeeId, companyId } });
  if (!e) throw notFound("Employee");
  return e;
}

async function assertInCompany(companyId: string, refs: { providerConnectionId?: string | null; reportsToId?: string | null; roomId?: string; deskId?: string | null }) {
  if (refs.providerConnectionId) {
    const pc = await prisma.providerConnection.findFirst({ where: { id: refs.providerConnectionId, companyId }, select: { status: true } });
    if (!pc) throw badRequest("providerConnectionId does not belong to this company");
    if (pc.status === "REVOKED") throw conflict("Provider connection is revoked");
  }
  if (refs.reportsToId) {
    const m = await prisma.employee.findFirst({ where: { id: refs.reportsToId, companyId }, select: { id: true } });
    if (!m) throw badRequest("reportsToId does not belong to this company");
  }
  if (refs.roomId) {
    const r = await prisma.room.findFirst({ where: { id: refs.roomId, companyId }, select: { id: true } });
    if (!r) throw badRequest("roomId does not belong to this company");
  }
  if (refs.deskId) {
    const d = await prisma.desk.findFirst({ where: { id: refs.deskId, room: { companyId } }, select: { id: true } });
    if (!d) throw badRequest("deskId does not belong to this company");
  }
}

export async function listEmployees(companyId: string, q: z.infer<typeof EmployeeListQuery>): Promise<EmployeeListItemRaw[]> {
  const rows = await prisma.employee.findMany({
    where: { companyId, ...(q.status ? { status: q.status } : { status: { not: "ARCHIVED" } }), ...(q.specialty ? { specialty: q.specialty } : {}) },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: employeeListSelect,
  });
  return rows.map(toEmployeeListItem);
}

export async function hireEmployee(companyId: string, userId: string, input: z.infer<typeof HireEmployeeInput>) {
  await assertInCompany(companyId, input);
  const tpl = ROLE_TEMPLATES[input.specialty];
  const prompt = input.initializeFromTemplate ? { ...tpl.prompt, ...(input.prompt ?? {}) } : PromptFieldsSchema.parse(input.prompt ?? {});
  const manager = await prisma.employee.findFirst({ where: { companyId, role: "MANAGER", status: { not: "ARCHIVED" } }, select: { id: true } });

  const employee = await prisma.$transaction(
    async (tx) => {
      await ensureGlobalSkills(tx);
      const slugs = input.skillSlugs ?? (input.initializeFromTemplate ? tpl.skills : []);
      const skillIds = await resolveSkillSlugs(tx, companyId, slugs);
      const deskId =
        (await findFreeDesk(tx, companyId, input.roomId ? { roomId: input.roomId } : { kind: specialtyRoom(input.specialty) })) ??
        (input.roomId ? null : await findFreeDesk(tx, companyId, {}));
      return createEmployeeTx(tx, {
        companyId, name: input.name, specialty: input.specialty, role: "EMPLOYEE", rank: input.rank,
        title: input.title ?? tpl.title, department: input.department ?? tpl.department, avatar: input.avatar,
        prompt, skillIds, topics: input.initializeFromTemplate ? tpl.topics : [],
        providerConnectionId: input.providerConnectionId ?? null, model: input.model ?? null,
        reportsToId: input.reportsToId ?? manager?.id ?? null, deskId, createdById: userId,
      });
    },
    { timeout: 15000 },
  );

  if (input.initializeFromTemplate) {
    const handled = await ensureDefaultSources(companyId, employee.id, input.specialty).catch((err) => {
      console.error("[employees] ensureDefaultSources failed", err instanceof Error ? err.message : err);
      return "failed";
    });
    if (handled === null && tpl.sources.length) {
      // Core helper not available: create the template allowlist directly.
      await prisma.learningSource.createMany({
        data: tpl.sources.map((s) => ({ companyId, employeeId: employee.id, kind: s.kind, url: s.url, title: s.title, specialty: input.specialty, topics: tpl.topics })),
        skipDuplicates: true,
      });
    }
  }
  await emitEvent({ companyId, employeeId: employee.id, type: "employee.hired", payload: { name: employee.name, specialty: employee.specialty, rank: employee.rank } });
  await audit(companyId, userId, "employee.hire", "Employee", employee.id, { name: input.name, specialty: input.specialty, rank: input.rank });
  return getEmployeeDetail(companyId, employee.id);
}

export async function getEmployeeDetail(companyId: string, employeeId: string): Promise<EmployeeDetailRaw> {
  const e = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      ...employeeListSelect,
      specializationTopics: true, currentPromptVersion: true, updatedAt: true,
      reportsTo: { select: { id: true, name: true } },
      providerConnection: { select: { id: true, label: true, provider: true, mode: true, status: true } },
      desk: { select: { id: true, roomId: true, room: { select: { name: true, kind: true } } } },
      skills: { orderBy: { assignedAt: "asc" }, select: { skillId: true, proficiency: true, enabled: true, assignedAt: true, skill: true } },
      careerEvidence: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!e) throw notFound("Employee");
  const [prompt, runs, sourcesCount, knowledge, usage, schedule] = await Promise.all([
    prisma.promptVersion.findUnique({ where: { employeeId_version: { employeeId, version: e.currentPromptVersion } } }),
    prisma.learningRun.findMany({ where: { companyId, employeeId }, orderBy: { createdAt: "desc" }, take: 5, select: learningRunSelect }),
    prisma.learningSource.count({ where: { companyId, OR: [{ employeeId }, { employeeId: null, specialty: e.specialty as DbSpecialty }] } }),
    prisma.knowledgeEntry.groupBy({ by: ["status"], where: { companyId, employeeId }, _count: { _all: true } }),
    prisma.usageRecord.groupBy({
      by: ["source"], where: { companyId, employeeId }, _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true, costUsd: true },
    }),
    getEffectiveSchedule(companyId, employeeId),
  ]);
  const list = toEmployeeListItem({ ...e, providerConnection: e.providerConnection ? { provider: e.providerConnection.provider } : null, desk: e.desk ? { id: e.desk.id } : null });
  const providerReported = emptyTotals();
  const estimated = emptyTotals();
  for (const u of usage) addTotals(u.source === "PROVIDER_REPORTED" ? providerReported : estimated, u);
  const knowledgeCounts: Partial<Record<KnowledgeStatus, number>> = {};
  for (const k of knowledge) knowledgeCounts[k.status] = k._count._all;
  return {
    ...list,
    specializationTopics: e.specializationTopics,
    currentPromptVersion: e.currentPromptVersion,
    prompt: prompt ? toPromptVersion(prompt) : null,
    skills: e.skills,
    evidence: e.careerEvidence,
    reportsTo: e.reportsTo,
    providerConnection: e.providerConnection,
    desk: e.desk ? { id: e.desk.id, roomId: e.desk.roomId, roomName: e.desk.room.name, roomKind: e.desk.room.kind } : null,
    learning: { schedule, recentRuns: runs.map(toLearningRun), sourcesCount, knowledgeCounts },
    usage: { providerReported, estimated },
    updatedAt: e.updatedAt,
  };
}

export async function updateEmployee(companyId: string, userId: string, employeeId: string, input: z.infer<typeof UpdateEmployeeInput>) {
  const e = await requireEmployee(companyId, employeeId);
  await assertInCompany(companyId, input);
  if (input.reportsToId === employeeId) throw badRequest("An employee cannot report to themselves");
  if (input.status === "ARCHIVED" && e.role === "MANAGER") throw conflict("The manager cannot be archived");

  const statusChanged = input.status !== undefined && input.status !== e.status;
  let visualState = e.visualState;
  if (statusChanged) visualState = input.status === "ACTIVE" ? "IDLE" : "OFFLINE";

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.avatar !== undefined ? { avatar: input.avatar as Prisma.InputJsonValue } : {}),
        ...(input.providerConnectionId !== undefined ? { providerConnectionId: input.providerConnectionId } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.reportsToId !== undefined ? { reportsToId: input.reportsToId } : {}),
        ...(input.specializationTopics !== undefined ? { specializationTopics: input.specializationTopics } : {}),
        ...(statusChanged ? { status: input.status, visualState } : {}),
      },
    });
    if (input.status === "ARCHIVED" || input.deskId !== undefined) {
      await tx.desk.updateMany({ where: { employeeId }, data: { employeeId: null } });
    }
    if (input.deskId && input.status !== "ARCHIVED") {
      const claimed = await tx.desk.updateMany({ where: { id: input.deskId, employeeId: null, room: { companyId } }, data: { employeeId } });
      if (claimed.count !== 1) throw conflict("Desk is not available");
    }
  });

  if (statusChanged) {
    await emitEvent({ companyId, employeeId, type: "employee.state", payload: { state: visualState, reason: `status:${input.status}` } });
  }
  await emitEvent({ companyId, employeeId, type: "employee.updated", payload: { fields: Object.keys(input) } });
  await audit(companyId, userId, "employee.update", "Employee", employeeId, input);
  return getEmployeeDetail(companyId, employeeId);
}

// --- Prompt versions ------------------------------------------------------------------------
export async function listPromptVersions(companyId: string, employeeId: string) {
  await requireEmployee(companyId, employeeId);
  const rows = await prisma.promptVersion.findMany({ where: { employeeId }, orderBy: { version: "desc" } });
  return rows.map(toPromptVersion);
}

async function appendPromptVersion(employeeId: string, fields: unknown, note: string | undefined, userId: string) {
  const parsed = PromptFieldsSchema.parse(fields);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const max = await tx.promptVersion.aggregate({ where: { employeeId }, _max: { version: true } });
        const version = (max._max.version ?? 0) + 1;
        const pv = await tx.promptVersion.create({ data: { employeeId, version, fields: parsed, compiled: compilePrompt(parsed), note: note ?? null, createdById: userId } });
        await tx.employee.update({ where: { id: employeeId }, data: { currentPromptVersion: version } });
        return pv;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  throw conflict("Could not allocate a prompt version");
}

export async function createPromptVersion(companyId: string, userId: string, employeeId: string, input: z.infer<typeof CreatePromptVersionInput>) {
  await requireEmployee(companyId, employeeId);
  const pv = await appendPromptVersion(employeeId, input.fields, input.note, userId);
  await audit(companyId, userId, "employee.prompt.create", "PromptVersion", pv.id, { employeeId, version: pv.version });
  return toPromptVersion(pv);
}

export async function rollbackPromptVersion(companyId: string, userId: string, employeeId: string, version: number) {
  await requireEmployee(companyId, employeeId);
  const src = await prisma.promptVersion.findUnique({ where: { employeeId_version: { employeeId, version } } });
  if (!src) throw notFound("Prompt version");
  const pv = await appendPromptVersion(employeeId, src.fields, `Rollback to v${version}`, userId);
  await audit(companyId, userId, "employee.prompt.rollback", "PromptVersion", pv.id, { employeeId, from: version, version: pv.version });
  return toPromptVersion(pv);
}

// --- Skills / evidence / rank / tasks --------------------------------------------------------
export async function setEmployeeSkills(companyId: string, userId: string, employeeId: string, input: z.infer<typeof SetEmployeeSkillsInput>) {
  await requireEmployee(companyId, employeeId);
  const ids = [...new Set(input.skills.map((s) => s.skillId))];
  const valid = await prisma.skill.count({ where: { id: { in: ids }, OR: [{ companyId }, { companyId: null }] } });
  if (valid !== ids.length) throw badRequest("One or more skills do not exist in this company");
  const seen = new Set<string>();
  const rows = input.skills.filter((s) => (seen.has(s.skillId) ? false : (seen.add(s.skillId), true)));
  await prisma.$transaction([
    prisma.employeeSkill.deleteMany({ where: { employeeId } }),
    prisma.employeeSkill.createMany({ data: rows.map((s) => ({ employeeId, skillId: s.skillId, proficiency: s.proficiency, enabled: s.enabled })) }),
  ]);
  await audit(companyId, userId, "employee.skills.set", "Employee", employeeId, { skills: rows });
  return prisma.employeeSkill.findMany({ where: { employeeId }, select: { skillId: true, proficiency: true, enabled: true, assignedAt: true, skill: true } });
}

export async function listEvidence(companyId: string, employeeId: string) {
  await requireEmployee(companyId, employeeId);
  return prisma.employeeCareerEvidence.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });
}

export async function overrideRank(companyId: string, userId: string, employeeId: string, input: z.infer<typeof OverrideRankInput>) {
  const e = await requireEmployee(companyId, employeeId);
  if (e.rank === input.rank) throw conflict(`Employee is already ${input.rank}`);
  // Core writes OWNER_OVERRIDE + RANK_CHANGE evidence, the audit row and the event.
  const handled = await coreOverrideRank(companyId, employeeId, input.rank, input.reason, userId);
  if (!handled) {
    await prisma.$transaction([
      prisma.employee.update({ where: { id: employeeId }, data: { rank: input.rank } }),
      prisma.employeeCareerEvidence.create({
        data: { employeeId, kind: "OWNER_OVERRIDE", summary: input.reason, fromRank: e.rank, toRank: input.rank, createdById: userId },
      }),
    ]);
    await emitEvent({ companyId, employeeId, type: "employee.updated", payload: { rank: input.rank, fromRank: e.rank, reason: "owner_override" } });
    await audit(companyId, userId, "employee.rank.override", "Employee", employeeId, { fromRank: e.rank, toRank: input.rank, reason: input.reason });
  }
  return getEmployeeDetail(companyId, employeeId);
}

export async function listEmployeeTasks(companyId: string, employeeId: string, q: { cursor?: string; limit: number }) {
  await requireEmployee(companyId, employeeId);
  const rows = await prisma.task.findMany({
    where: { companyId, OR: [{ assigneeId: employeeId }, { assignments: { some: { employeeId } } }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: taskListSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q.limit);
  return { items: page.items.map(toTaskListItem), nextCursor: page.nextCursor };
}

export { toAvatar };
