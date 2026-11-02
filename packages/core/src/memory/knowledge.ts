/** Knowledge lifecycle: owner-authored entries, approvals, deletion, expiry, listing. */
import { prisma, type Db, type KnowledgeEntry, type KnowledgeKind, type KnowledgeStatus } from "@agentopia/db";
import { CreateKnowledgeInput } from "@agentopia/shared";
import type { z } from "zod";
import { emit } from "../learning/deps";

/** Domain error with a code the web layer maps to HTTP (NOT_FOUND→404, INVALID_STATE→409, INVALID_INPUT→400). */
export class KnowledgeError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_STATE" | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}

export type CreateOwnerKnowledgeInput = z.input<typeof CreateKnowledgeInput>;

/**
 * Create an OWNER_INSTRUCTION or PROJECT_DOC entry. Owner-authored knowledge
 * is VERIFIED immediately (provenance OWNER, confidence 1). Employee/project
 * ids must belong to the company.
 */
export async function createOwnerKnowledge(
  companyId: string,
  actorUserId: string,
  input: CreateOwnerKnowledgeInput,
  db: Db = prisma,
): Promise<KnowledgeEntry> {
  const parsed = CreateKnowledgeInput.safeParse(input);
  if (!parsed.success) throw new KnowledgeError("INVALID_INPUT", parsed.error.message);
  const data = parsed.data;
  if (data.employeeId) {
    const e = await db.employee.findFirst({ where: { id: data.employeeId, companyId }, select: { id: true } });
    if (!e) throw new KnowledgeError("INVALID_INPUT", "employee not in company");
  }
  if (data.projectId) {
    const p = await db.project.findFirst({ where: { id: data.projectId, companyId }, select: { id: true } });
    if (!p) throw new KnowledgeError("INVALID_INPUT", "project not in company");
  }
  const now = new Date();
  return db.knowledgeEntry.create({
    data: {
      companyId,
      employeeId: data.employeeId ?? null,
      projectId: data.projectId ?? null,
      kind: data.kind,
      provenance: "OWNER",
      status: "VERIFIED",
      title: data.title,
      content: data.content,
      sourceUrl: data.sourceUrl ?? null,
      retrievedAt: now,
      confidence: 1,
      tags: data.tags,
      verifiedAt: now,
      verifiedById: actorUserId,
    },
  });
}

/**
 * Approve or reject a DRAFT entry. Writes a KnowledgeApproval, emits
 * `knowledge.decided`, and on approval of an employee-scoped entry records
 * KNOWLEDGE_VERIFIED career evidence.
 */
export async function decideKnowledge(
  companyId: string,
  entryId: string,
  decision: "APPROVED" | "REJECTED",
  actorUserId: string,
  note?: string | null,
  db: Db = prisma,
): Promise<KnowledgeEntry> {
  const entry = await db.knowledgeEntry.findFirst({ where: { id: entryId, companyId } });
  if (!entry) throw new KnowledgeError("NOT_FOUND", "knowledge entry not found");
  if (entry.status !== "DRAFT") throw new KnowledgeError("INVALID_STATE", `entry is ${entry.status}, only DRAFT can be decided`);
  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    // Conditional update guards against a concurrent decision.
    const res = await tx.knowledgeEntry.updateMany({
      where: { id: entryId, companyId, status: "DRAFT" },
      data:
        decision === "APPROVED"
          ? { status: "VERIFIED", verifiedAt: now, verifiedById: actorUserId }
          : { status: "REJECTED", verifiedAt: null, verifiedById: actorUserId },
    });
    if (res.count === 0) throw new KnowledgeError("INVALID_STATE", "entry was decided concurrently");
    await tx.knowledgeApproval.create({ data: { knowledgeEntryId: entryId, decision, decidedById: actorUserId, note: note ?? null } });
    if (decision === "APPROVED" && entry.employeeId) {
      await tx.employeeCareerEvidence.create({
        data: {
          employeeId: entry.employeeId,
          kind: "KNOWLEDGE_VERIFIED",
          summary: `Knowledge verified: ${entry.title}`.slice(0, 300),
          taskId: entry.taskId,
          createdById: actorUserId,
        },
      });
    }
    return tx.knowledgeEntry.findUniqueOrThrow({ where: { id: entryId } });
  });
  await emit(
    {
      companyId,
      employeeId: entry.employeeId,
      taskId: entry.taskId,
      type: "knowledge.decided",
      payload: { entryId, decision, status: updated.status, title: updated.title, note: note ?? null },
    },
    db,
  );
  return updated;
}

/**
 * Delete an entry. Chosen semantics: HARD delete: the row, its content and
 * approvals are removed so nothing is retained or retrievable afterwards.
 * (The DELETED status is reserved and never written by this module.)
 * Returns false when the entry does not exist in the company.
 */
export async function deleteKnowledge(companyId: string, entryId: string, db: Db = prisma): Promise<boolean> {
  const res = await db.knowledgeEntry.deleteMany({ where: { id: entryId, companyId } });
  return res.count > 0;
}

/**
 * Maintenance: entries past `expiresAt` → EXPIRED; VERIFIED/DRAFT learned
 * notes whose source changed after the note was retrieved → STALE.
 */
export async function expireStaleKnowledge(companyId: string, now: Date = new Date(), db: Db = prisma): Promise<{ expired: number; stale: number }> {
  const expired = await db.knowledgeEntry.updateMany({
    where: { companyId, status: { in: ["DRAFT", "VERIFIED"] }, expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  const candidates = await db.knowledgeEntry.findMany({
    where: { companyId, status: { in: ["DRAFT", "VERIFIED"] }, sourceDocumentId: { not: null } },
    select: { id: true, retrievedAt: true, commitSha: true, sourceDocument: { select: { source: { select: { lastChangedAt: true, lastCommitSha: true } } } } },
  });
  const staleIds = candidates
    .filter((c) => {
      const src = c.sourceDocument?.source;
      if (!src) return false;
      if (c.commitSha && src.lastCommitSha && c.commitSha !== src.lastCommitSha) return true;
      return !!(src.lastChangedAt && c.retrievedAt && src.lastChangedAt.getTime() > c.retrievedAt.getTime());
    })
    .map((c) => c.id);
  const stale = staleIds.length
    ? await db.knowledgeEntry.updateMany({ where: { id: { in: staleIds }, companyId }, data: { status: "STALE" } })
    : { count: 0 };
  return { expired: expired.count, stale: stale.count };
}

export type KnowledgeFilters = {
  status?: KnowledgeStatus;
  employeeId?: string;
  projectId?: string;
  kind?: KnowledgeKind;
  learningRunId?: string;
};
export type Pagination = { cursor?: string; take?: number };

/** List entries (newest first) with cursor pagination. `take` is clamped to 1..100 (default 50). */
export async function listKnowledge(
  companyId: string,
  filters: KnowledgeFilters = {},
  pagination: Pagination = {},
  db: Db = prisma,
): Promise<{ items: KnowledgeEntry[]; nextCursor: string | null }> {
  const take = Math.min(100, Math.max(1, pagination.take ?? 50));
  const rows = await db.knowledgeEntry.findMany({
    where: {
      companyId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.learningRunId ? { learningRunId: filters.learningRunId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}
