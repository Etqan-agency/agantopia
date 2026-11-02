import { prisma, type EvidenceKind, type Rank } from "@agentopia/db";
import { RANKS } from "@agentopia/shared";
import { DomainError } from "../errors";
import { emitEvent, type DbClient } from "../events/emit";

export interface EvidenceInput {
  employeeId: string;
  kind: EvidenceKind;
  summary: string;
  taskId?: string | null;
  score?: number | null;
  createdById?: string | null;
  fromRank?: Rank | null;
  toRank?: Rank | null;
}

/** Appends a career evidence row (the only input to rank changes). */
export async function recordEvidence(db: DbClient, e: EvidenceInput) {
  return db.employeeCareerEvidence.create({
    data: {
      employeeId: e.employeeId,
      kind: e.kind,
      summary: e.summary.slice(0, 1000),
      taskId: e.taskId ?? null,
      score: e.score ?? null,
      createdById: e.createdById ?? null,
      fromRank: e.fromRank ?? null,
      toRank: e.toRank ?? null,
    },
  });
}

/** Evidence thresholds for automatic promotion from a rank (counted since the last rank change). */
export const PROMOTION_RULES: Record<Exclude<Rank, "EXPERT">, { approved: number; knowledge: number; maxRejectRatio: number; requiresAssessment: boolean }> = {
  TRAINEE: { approved: 2, knowledge: 0, maxRejectRatio: 0.5, requiresAssessment: false },
  JUNIOR: { approved: 5, knowledge: 1, maxRejectRatio: 0.4, requiresAssessment: false },
  MID_LEVEL: { approved: 10, knowledge: 2, maxRejectRatio: 0.3, requiresAssessment: false },
  // Past SENIOR never happens automatically without an ASSESSMENT (score ≥ 0.8) or an OWNER_OVERRIDE.
  SENIOR: { approved: 15, knowledge: 3, maxRejectRatio: 0.2, requiresAssessment: true },
};

/** Pure decision: the next rank given evidence counts since the last change, or null. */
export function nextRankFor(
  rank: Rank,
  c: { approved: number; rejected: number; knowledge: number; passedAssessment: boolean; ownerOverride: boolean },
): Rank | null {
  if (rank === "EXPERT") return null;
  const rule = PROMOTION_RULES[rank];
  const total = c.approved + c.rejected;
  const ratio = total ? c.rejected / total : 0;
  if (c.approved < rule.approved || c.knowledge < rule.knowledge || ratio > rule.maxRejectRatio) return null;
  if (rule.requiresAssessment && !c.passedAssessment && !c.ownerOverride) return null;
  return RANKS[RANKS.indexOf(rank) + 1] ?? null;
}

/**
 * Re-evaluates an employee's rank from evidence since the last RANK_CHANGE and
 * promotes at most one level. Returns the new rank or null if unchanged.
 */
export async function evaluateProgression(employeeId: string): Promise<Rank | null> {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return null;
  const last = await prisma.employeeCareerEvidence.findFirst({ where: { employeeId, kind: "RANK_CHANGE" }, orderBy: { createdAt: "desc" } });
  const since = last?.createdAt ?? new Date(0);
  const rows = await prisma.employeeCareerEvidence.findMany({ where: { employeeId, createdAt: { gt: since } }, select: { kind: true, score: true } });
  const count = (k: EvidenceKind) => rows.filter((r) => r.kind === k).length;
  const next = nextRankFor(emp.rank, {
    approved: count("REVIEW_APPROVED"),
    rejected: count("REVIEW_REJECTED"),
    knowledge: count("KNOWLEDGE_VERIFIED"),
    passedAssessment: rows.some((r) => r.kind === "ASSESSMENT" && (r.score ?? 0) >= 0.8),
    ownerOverride: rows.some((r) => r.kind === "OWNER_OVERRIDE"),
  });
  if (!next) return null;
  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { rank: next } });
    await recordEvidence(tx, { employeeId, kind: "RANK_CHANGE", summary: `Promoted from ${emp.rank} to ${next} based on recorded evidence`, fromRank: emp.rank, toRank: next });
  });
  await emitEvent(prisma, { companyId: emp.companyId, employeeId, type: "employee.updated", payload: { rank: next, fromRank: emp.rank, reason: "evidence" } });
  return next;
}

/** Owner rank override: records OWNER_OVERRIDE + RANK_CHANGE evidence and an audit log entry. */
export async function overrideRank(companyId: string, employeeId: string, rank: Rank, reason: string, userId: string): Promise<void> {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, companyId } });
  if (!emp) throw new DomainError("NOT_FOUND", "Employee not found");
  if (emp.rank === rank) return;
  await prisma.$transaction(async (tx) => {
    await recordEvidence(tx, { employeeId, kind: "OWNER_OVERRIDE", summary: reason, createdById: userId, fromRank: emp.rank, toRank: rank });
    await recordEvidence(tx, { employeeId, kind: "RANK_CHANGE", summary: `Owner override: ${reason}`, createdById: userId, fromRank: emp.rank, toRank: rank });
    await tx.employee.update({ where: { id: employeeId }, data: { rank } });
    await tx.auditLog.create({ data: { companyId, userId, action: "employee.rank_override", entityType: "Employee", entityId: employeeId, metadata: { from: emp.rank, to: rank, reason } } });
  });
  await emitEvent(prisma, { companyId, employeeId, type: "employee.updated", payload: { rank, fromRank: emp.rank, reason: "owner_override" } });
}
