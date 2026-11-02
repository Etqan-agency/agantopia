import { prisma, Prisma } from "@agentopia/db";

/** Append an audit row. Never throws: audit failure must not break the mutation it records. */
export async function audit(
  companyId: string | null,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  ip?: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { companyId, userId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue, ip: ip ?? null },
    });
  } catch (err) {
    console.error("[audit] failed to write", action, err instanceof Error ? err.message : err);
  }
}
