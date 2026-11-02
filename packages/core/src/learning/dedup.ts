/** Content hashing and duplicate detection for fetched documents. */
import { createHash } from "node:crypto";
import { prisma, type Db } from "@agentopia/db";

/** Normalize text for hashing: NFC, unified newlines, collapsed whitespace. */
export function normalizeForHash(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** SHA-256 hex of the normalized text. */
export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text), "utf8").digest("hex");
}

/** True when this source already stored a document with this content hash. */
export async function alreadySeen(sourceId: string, hash: string, db: Db = prisma): Promise<boolean> {
  const row = await db.sourceDocument.findUnique({ where: { sourceId_contentHash: { sourceId, contentHash: hash } }, select: { id: true } });
  return row !== null;
}
