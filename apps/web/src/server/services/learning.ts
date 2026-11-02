import { prisma, Prisma } from "@agentopia/db";
import {
  KNOWLEDGE_KINDS, KNOWLEDGE_STATUSES, LearningConfigSchema, isValidTimeZone,
  type CreateKnowledgeInput, type CreateLearningSourceInput, type DecideKnowledgeInput, type MemorySearchQuery, type UpsertLearningScheduleInput, type Weekday,
} from "@agentopia/shared";
import { z } from "zod";
import type { LearningScheduleRaw } from "../../lib/api-types";
import { audit } from "../audit";
import {
  cancelLearningRun, computeNextRuns, createOwnerKnowledge, decideKnowledge as coreDecideKnowledge, deleteKnowledge as coreDeleteKnowledge,
  searchMemory, startScheduledLearningRun, syncScheduleToQueue,
} from "../core";
import { badRequest, notFound } from "../errors";
import { pageArgs, toPage } from "../http";
import { knowledgeSelect, learningRunSelect, learningSourceSelect, toKnowledge, toLearningRun, toLearningSource } from "./views";

type ScheduleRow = Prisma.LearningScheduleGetPayload<{ include: { employee: { select: { id: true; name: true } } } }>;

export function scheduleConfig(s: ScheduleRow) {
  return LearningConfigSchema.parse({
    enabled: s.enabled, days: s.days, time: s.time, timezone: isValidTimeZone(s.timezone) ? s.timezone : "UTC", maxDurationMinutes: s.maxDurationMinutes, tokenStrategy: s.tokenStrategy,
    sourceDocs: s.sourceDocs, sourceGithub: s.sourceGithub, specializationOnly: s.specializationOnly, approvalRequired: s.approvalRequired,
    skipUnchanged: s.skipUnchanged, pauseOnBudgetExhaustion: s.pauseOnBudgetExhaustion, perRunTokenBudget: s.perRunTokenBudget,
    weeklyTokenBudget: s.weeklyTokenBudget, weeklyCostBudgetUsd: s.weeklyCostBudgetUsd,
  });
}

export async function toScheduleView(s: ScheduleRow, from = new Date()): Promise<LearningScheduleRaw> {
  const active = s.enabled && !s.pausedAt;
  const nextRuns = active ? await computeNextRuns(scheduleConfig(s), from, 4) : [];
  return {
    id: s.id, employeeId: s.employeeId, employee: s.employee, enabled: s.enabled, days: s.days as Weekday[], time: s.time, timezone: s.timezone,
    maxDurationMinutes: s.maxDurationMinutes, tokenStrategy: s.tokenStrategy, sourceDocs: s.sourceDocs, sourceGithub: s.sourceGithub,
    specializationOnly: s.specializationOnly, approvalRequired: s.approvalRequired, skipUnchanged: s.skipUnchanged,
    pauseOnBudgetExhaustion: s.pauseOnBudgetExhaustion, perRunTokenBudget: s.perRunTokenBudget, weeklyTokenBudget: s.weeklyTokenBudget,
    weeklyCostBudgetUsd: s.weeklyCostBudgetUsd, paused: !!s.pausedAt, pausedAt: s.pausedAt, pauseReason: s.pauseReason, lastRunAt: s.lastRunAt,
    nextRuns, createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}

const scheduleInclude = { employee: { select: { id: true, name: true } } } as const;

/** Employee override schedule if present, else the company default. */
export async function getEffectiveSchedule(companyId: string, employeeId: string): Promise<LearningScheduleRaw | null> {
  const rows = await prisma.learningSchedule.findMany({ where: { companyId, OR: [{ employeeId }, { employeeId: null }] }, include: scheduleInclude });
  const s = rows.find((r) => r.employeeId === employeeId) ?? rows.find((r) => r.employeeId === null);
  return s ? toScheduleView(s) : null;
}

export async function listSchedules(companyId: string) {
  const rows = await prisma.learningSchedule.findMany({ where: { companyId }, include: scheduleInclude, orderBy: { createdAt: "asc" } });
  const from = new Date();
  return Promise.all(rows.map((r) => toScheduleView(r, from)));
}

export async function upsertSchedule(companyId: string, userId: string, input: z.infer<typeof UpsertLearningScheduleInput>) {
  const employeeId = input.employeeId ?? null;
  if (employeeId) {
    const e = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
    if (!e) throw badRequest("employeeId does not belong to this company");
  }
  const { employeeId: _e, paused, ...fields } = input;
  const pauseData = paused === undefined ? {} : paused ? { pausedAt: new Date(), pauseReason: "Paused by owner" } : { pausedAt: null, pauseReason: null };
  const existing = await prisma.learningSchedule.findFirst({ where: { companyId, employeeId }, select: { id: true } });
  let id: string;
  if (existing) {
    id = (await prisma.learningSchedule.update({ where: { id: existing.id }, data: { ...fields, ...pauseData } })).id;
  } else {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { timezone: true } });
    const defaults = LearningConfigSchema.parse({ timezone: isValidTimeZone(company.timezone) ? company.timezone : "UTC" });
    id = (await prisma.learningSchedule.create({ data: { companyId, employeeId, ...defaults, ...fields, ...pauseData } })).id;
  }
  await syncScheduleToQueue(id);
  await audit(companyId, userId, existing ? "learning.schedule.update" : "learning.schedule.create", "LearningSchedule", id, input);
  const row = await prisma.learningSchedule.findUniqueOrThrow({ where: { id }, include: scheduleInclude });
  return toScheduleView(row);
}

export const RunScheduleNowInput = z.object({ employeeId: z.string().min(1).max(64).optional() });

export async function runScheduleNow(companyId: string, userId: string, scheduleId: string, input: z.infer<typeof RunScheduleNowInput> = {}) {
  const s = await prisma.learningSchedule.findFirst({ where: { id: scheduleId, companyId }, select: { id: true } });
  if (!s) throw notFound("Learning schedule");
  const employeeId = input.employeeId;
  if (employeeId) {
    const e = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
    if (!e) throw badRequest("employeeId does not belong to this company");
  }
  const runId = await startScheduledLearningRun(scheduleId, { trigger: "manual", ...(employeeId ? { employeeId } : {}) });
  await audit(companyId, userId, "learning.run_now", "LearningSchedule", scheduleId, { runId, employeeId: employeeId ?? null });
  return { ok: true, runId, skipped: runId === null };
}

// --- Sources -------------------------------------------------------------------------------
export const SourceListQuery = z.object({ employeeId: z.string().optional() });

export async function listSources(companyId: string, q: z.infer<typeof SourceListQuery>) {
  const rows = await prisma.learningSource.findMany({
    where: { companyId, ...(q.employeeId ? { OR: [{ employeeId: q.employeeId }, { employeeId: null }] } : {}) },
    orderBy: [{ specialty: "asc" }, { createdAt: "asc" }],
    select: learningSourceSelect,
  });
  return rows.map(toLearningSource);
}

export async function createSource(companyId: string, userId: string, input: z.infer<typeof CreateLearningSourceInput>) {
  if (input.employeeId) {
    const e = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId }, select: { id: true } });
    if (!e) throw badRequest("employeeId does not belong to this company");
  }
  const url = new URL(input.url);
  if (url.protocol !== "https:") throw badRequest("Only https sources are allowed");
  if (input.kind === "GITHUB" && url.hostname !== "github.com") throw badRequest("GitHub sources must be github.com repository URLs");
  const s = await prisma.learningSource.create({
    data: { companyId, employeeId: input.employeeId ?? null, kind: input.kind, url: input.url, title: input.title, specialty: input.specialty, topics: input.topics },
    select: learningSourceSelect,
  });
  await audit(companyId, userId, "learning.source.create", "LearningSource", s.id, { url: s.url, kind: s.kind });
  return toLearningSource(s);
}

export async function deleteSource(companyId: string, userId: string, sourceId: string) {
  const r = await prisma.learningSource.deleteMany({ where: { id: sourceId, companyId } });
  if (!r.count) throw notFound("Learning source");
  await audit(companyId, userId, "learning.source.delete", "LearningSource", sourceId, {});
  return { ok: true };
}

// --- Runs ------------------------------------------------------------------------------------
export const RunListQuery = z.object({ employeeId: z.string().optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) });

export async function listRuns(companyId: string, q: z.infer<typeof RunListQuery>) {
  const rows = await prisma.learningRun.findMany({
    where: { companyId, ...(q.employeeId ? { employeeId: q.employeeId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: learningRunSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q.limit);
  return { items: page.items.map(toLearningRun), nextCursor: page.nextCursor };
}

export async function getRun(companyId: string, runId: string) {
  const r = await prisma.learningRun.findFirst({
    where: { id: runId, companyId },
    select: { ...learningRunSelect, log: true, knowledge: { select: knowledgeSelect, orderBy: { createdAt: "asc" } } },
  });
  if (!r) throw notFound("Learning run");
  const { knowledge, log, ...run } = r;
  return { ...toLearningRun(run), log, knowledge: knowledge.map(toKnowledge) };
}

export async function cancelRun(companyId: string, userId: string, runId: string) {
  const r = await prisma.learningRun.findFirst({ where: { id: runId, companyId }, select: { id: true } });
  if (!r) throw notFound("Learning run");
  const result = await cancelLearningRun(runId, companyId);
  await audit(companyId, userId, "learning.run.cancel", "LearningRun", runId, {});
  return { ok: true, result };
}

// --- Knowledge ---------------------------------------------------------------------------------
export const KnowledgeListQuery = z.object({
  status: z.enum(KNOWLEDGE_STATUSES).optional(),
  employeeId: z.string().optional(),
  kind: z.enum(KNOWLEDGE_KINDS).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function listKnowledge(companyId: string, q: z.infer<typeof KnowledgeListQuery>) {
  const rows = await prisma.knowledgeEntry.findMany({
    where: {
      companyId,
      ...(q.status ? { status: q.status } : { status: { not: "DELETED" } }),
      ...(q.employeeId ? { employeeId: q.employeeId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: knowledgeSelect,
    ...pageArgs(q),
  });
  const page = toPage(rows, q.limit);
  return { items: page.items.map(toKnowledge), nextCursor: page.nextCursor };
}

async function knowledgeView(companyId: string, id: string) {
  const k = await prisma.knowledgeEntry.findFirst({ where: { id, companyId }, select: knowledgeSelect });
  if (!k) throw notFound("Knowledge entry");
  return toKnowledge(k);
}

export async function createKnowledge(companyId: string, userId: string, input: z.infer<typeof CreateKnowledgeInput>) {
  if (input.employeeId) {
    const e = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId }, select: { id: true } });
    if (!e) throw badRequest("employeeId does not belong to this company");
  }
  if (input.projectId) {
    const p = await prisma.project.findFirst({ where: { id: input.projectId, companyId }, select: { id: true } });
    if (!p) throw badRequest("projectId does not belong to this company");
  }
  const created = await createOwnerKnowledge(companyId, { userId }, input);
  await audit(companyId, userId, "knowledge.create", "KnowledgeEntry", created.id, { kind: input.kind, title: input.title });
  return knowledgeView(companyId, created.id);
}

export async function decideKnowledge(companyId: string, userId: string, knowledgeId: string, input: z.infer<typeof DecideKnowledgeInput>) {
  await knowledgeView(companyId, knowledgeId);
  await coreDecideKnowledge(companyId, knowledgeId, input.decision, { userId }, input.note);
  await audit(companyId, userId, "knowledge.decide", "KnowledgeEntry", knowledgeId, input);
  return knowledgeView(companyId, knowledgeId);
}

export async function deleteKnowledge(companyId: string, userId: string, knowledgeId: string) {
  await knowledgeView(companyId, knowledgeId);
  await coreDeleteKnowledge(companyId, knowledgeId);
  await audit(companyId, userId, "knowledge.delete", "KnowledgeEntry", knowledgeId, {});
  return { ok: true };
}

export async function memorySearch(companyId: string, q: z.infer<typeof MemorySearchQuery>) {
  if (q.employeeId && !(await prisma.employee.findFirst({ where: { id: q.employeeId, companyId }, select: { id: true } }))) throw notFound("Employee");
  if (q.projectId && !(await prisma.project.findFirst({ where: { id: q.projectId, companyId }, select: { id: true } }))) throw notFound("Project");
  const items = await searchMemory({ companyId, employeeId: q.employeeId, projectId: q.projectId, query: q.q, limit: q.limit });
  return { items };
}
