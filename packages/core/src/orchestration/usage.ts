import { prisma } from "@agentopia/db";
import type { DbClient } from "../events/emit";
import type { UsageReport } from "../providers/types";

/** Persists a UsageRecord. `costSource` provider_reported → PROVIDER_REPORTED, otherwise ESTIMATED (costUsd null when unavailable). */
export async function recordUsage(
  input: { companyId: string; employeeId?: string | null; taskId?: string | null; executionSessionId?: string | null; learningRunId?: string | null; provider: string; usage: UsageReport },
  db: DbClient = prisma,
) {
  const u = input.usage;
  return db.usageRecord.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId ?? null,
      taskId: input.taskId ?? null,
      executionSessionId: input.executionSessionId ?? null,
      learningRunId: input.learningRunId ?? null,
      provider: input.provider.toLowerCase(),
      model: u.model ?? null,
      source: u.costSource === "provider_reported" ? "PROVIDER_REPORTED" : "ESTIMATED",
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cacheReadTokens: u.cacheReadTokens,
      cacheWriteTokens: u.cacheWriteTokens,
      costUsd: u.costUsd,
    },
  });
}
