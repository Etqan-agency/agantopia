import { prisma } from "@agentopia/db";
import type { CreateSkillInput, UpdateSkillInput } from "@agentopia/shared";
import type { z } from "zod";
import { audit } from "../audit";
import { forbidden, notFound } from "../errors";
import { ensureGlobalSkills } from "./employee-factory";

export async function listSkills(companyId: string) {
  let rows = await prisma.skill.findMany({ where: { OR: [{ companyId }, { companyId: null }] }, orderBy: [{ companyId: "asc" }, { name: "asc" }] });
  if (!rows.some((r) => r.companyId === null)) {
    await prisma.$transaction((tx) => ensureGlobalSkills(tx));
    rows = await prisma.skill.findMany({ where: { OR: [{ companyId }, { companyId: null }] }, orderBy: [{ companyId: "asc" }, { name: "asc" }] });
  }
  return rows;
}

export async function createSkill(companyId: string, userId: string, input: z.infer<typeof CreateSkillInput>) {
  const s = await prisma.skill.create({ data: { ...input, companyId, provenance: "owner" } });
  await audit(companyId, userId, "skill.create", "Skill", s.id, { slug: s.slug });
  return s;
}

async function ownedSkill(companyId: string, skillId: string) {
  const s = await prisma.skill.findFirst({ where: { id: skillId, OR: [{ companyId }, { companyId: null }] } });
  if (!s) throw notFound("Skill");
  if (s.companyId === null) throw forbidden("Template skills are read-only; create a company skill instead");
  return s;
}

export async function updateSkill(companyId: string, userId: string, skillId: string, input: z.infer<typeof UpdateSkillInput>) {
  const s = await ownedSkill(companyId, skillId);
  const contentChanged = input.instructions !== undefined || input.description !== undefined;
  const updated = await prisma.skill.update({ where: { id: s.id }, data: { ...input, ...(contentChanged ? { version: { increment: 1 } } : {}) } });
  await audit(companyId, userId, "skill.update", "Skill", s.id, input);
  return updated;
}

export async function deleteSkill(companyId: string, userId: string, skillId: string) {
  const s = await ownedSkill(companyId, skillId);
  await prisma.skill.delete({ where: { id: s.id } });
  await audit(companyId, userId, "skill.delete", "Skill", s.id, { slug: s.slug });
  return { ok: true };
}
