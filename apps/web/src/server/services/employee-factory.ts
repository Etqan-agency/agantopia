/** Transaction helpers shared by company creation and hiring. */
import { Prisma } from "@agentopia/db";
import {
  AvatarSchema, compilePrompt, PromptFieldsSchema, SKILL_TEMPLATES, SPECIALTY_ROOM,
  type PromptFields, type Rank, type RoomKind, type Specialty,
} from "@agentopia/shared";
import { conflict } from "../errors";

type Tx = Prisma.TransactionClient;

const PALETTES = ["teal", "brick", "sky", "saffron", "moss", "plum"];

export function defaultAvatar(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AvatarSchema.parse({ palette: PALETTES[h % PALETTES.length], hair: h % 6, skin: (h >>> 3) % 4 });
}

/** Make sure global template skills exist (serialized with an advisory lock: NULL companyId defeats the unique index). */
export async function ensureGlobalSkills(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('agentopia_global_skills'))`;
  const existing = await tx.skill.findMany({ where: { companyId: null }, select: { slug: true } });
  const have = new Set(existing.map((s) => s.slug));
  const missing = SKILL_TEMPLATES.filter((s) => !have.has(s.slug));
  if (missing.length) {
    await tx.skill.createMany({ data: missing.map((s) => ({ ...s, companyId: null, provenance: "template" })) });
  }
}

/** Resolve skill slugs to ids; company-owned skills win over global templates with the same slug. */
export async function resolveSkillSlugs(tx: Tx, companyId: string, slugs: string[]): Promise<string[]> {
  if (!slugs.length) return [];
  const rows = await tx.skill.findMany({
    where: { slug: { in: slugs }, enabled: true, OR: [{ companyId }, { companyId: null }] },
    select: { id: true, slug: true, companyId: true },
  });
  const bySlug = new Map<string, string>();
  for (const r of rows) if (r.companyId || !bySlug.has(r.slug)) bySlug.set(r.slug, r.id);
  return slugs.map((s) => bySlug.get(s)).filter((x): x is string => !!x);
}

/** First free desk in the company's room of the given kind (or a specific room). */
export async function findFreeDesk(tx: Tx, companyId: string, where: { roomId?: string; kind?: RoomKind }): Promise<string | null> {
  const desk = await tx.desk.findFirst({
    where: {
      employeeId: null,
      room: { companyId, ...(where.roomId ? { id: where.roomId } : {}), ...(where.kind ? { kind: where.kind } : {}) },
    },
    orderBy: [{ y: "asc" }, { x: "asc" }],
    select: { id: true },
  });
  return desk?.id ?? null;
}

export function specialtyRoom(specialty: Specialty): RoomKind {
  return SPECIALTY_ROOM[specialty];
}

export type NewEmployee = {
  companyId: string;
  name: string;
  specialty: Specialty;
  role: "MANAGER" | "EMPLOYEE";
  rank: Rank;
  title: string;
  department: string;
  avatar?: unknown;
  prompt: Partial<PromptFields>;
  skillIds: string[];
  topics: string[];
  providerConnectionId?: string | null;
  model?: string | null;
  reportsToId?: string | null;
  deskId?: string | null;
  createdById?: string | null;
  initializedSummary?: string;
};

/** Create employee + prompt v1 + skills + INITIALIZED_AS evidence + desk claim. */
export async function createEmployeeTx(tx: Tx, e: NewEmployee) {
  const fields = PromptFieldsSchema.parse(e.prompt);
  const employee = await tx.employee.create({
    data: {
      companyId: e.companyId,
      name: e.name,
      avatar: (e.avatar ?? defaultAvatar(e.name)) as Prisma.InputJsonValue,
      title: e.title,
      department: e.department,
      specialty: e.specialty,
      role: e.role,
      rank: e.rank,
      reportsToId: e.reportsToId ?? null,
      providerConnectionId: e.providerConnectionId ?? null,
      model: e.model ?? null,
      specializationTopics: e.topics,
      currentPromptVersion: 1,
      visualState: "IDLE",
      promptVersions: { create: { version: 1, fields, compiled: compilePrompt(fields), note: "Initial version", createdById: e.createdById ?? null } },
      skills: { create: e.skillIds.map((skillId) => ({ skillId, proficiency: "PROFICIENT" as const })) },
      careerEvidence: {
        create: {
          kind: "INITIALIZED_AS",
          summary: e.initializedSummary ?? `Initialized as ${e.rank} by the owner (assigned rank, not demonstrated experience).`,
          toRank: e.rank,
          createdById: e.createdById ?? null,
        },
      },
    },
  });
  if (e.deskId) {
    const claimed = await tx.desk.updateMany({ where: { id: e.deskId, employeeId: null, room: { companyId: e.companyId } }, data: { employeeId: employee.id } });
    if (claimed.count !== 1) throw conflict("Desk is not available");
  }
  return employee;
}
