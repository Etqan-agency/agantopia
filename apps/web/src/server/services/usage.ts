import { prisma, Prisma } from "@agentopia/db";
import { z } from "zod";
import type { UsageSummary, UsageTotals } from "../../lib/api-types";
import { badRequest } from "../errors";
import { getProviderLimits, isLimitActive, PROVIDER_DISPLAY_NAME, SUBSCRIPTION_PROVIDERS } from "./provider-status";
import { addTotals, emptyTotals } from "./views";

export const UsageQuery = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
});

const SUM = { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true, costUsd: true } as const;

export async function usageSummary(companyId: string, q: z.infer<typeof UsageQuery>): Promise<UsageSummary> {
  const from = q.from ? new Date(q.from) : null;
  const to = q.to ? new Date(q.to) : null;
  if (from && to && from > to) throw badRequest("`from` must be before `to`");
  const where: Prisma.UsageRecordWhereInput = {
    companyId,
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [bySource, byEmp, byProv, limits] = await Promise.all([
    prisma.usageRecord.groupBy({ by: ["source"], where, _count: { _all: true }, _sum: SUM }),
    prisma.usageRecord.groupBy({ by: ["employeeId", "source"], where, _count: { _all: true }, _sum: SUM }),
    prisma.usageRecord.groupBy({ by: ["provider", "model", "source"], where, _count: { _all: true }, _sum: SUM }),
    getProviderLimits(companyId),
  ]);
  const providerReported = emptyTotals();
  const estimated = emptyTotals();
  for (const r of bySource) addTotals(r.source === "PROVIDER_REPORTED" ? providerReported : estimated, r);

  const empIds = [...new Set(byEmp.map((r) => r.employeeId).filter((x): x is string => !!x))];
  const names = new Map((await prisma.employee.findMany({ where: { id: { in: empIds }, companyId }, select: { id: true, name: true } })).map((e) => [e.id, e.name]));
  const empMap = new Map<string, { employeeId: string | null; name: string | null; providerReported: UsageTotals; estimated: UsageTotals }>();
  for (const r of byEmp) {
    const key = r.employeeId ?? "_none";
    let row = empMap.get(key);
    if (!row) empMap.set(key, (row = { employeeId: r.employeeId, name: r.employeeId ? (names.get(r.employeeId) ?? null) : null, providerReported: emptyTotals(), estimated: emptyTotals() }));
    addTotals(r.source === "PROVIDER_REPORTED" ? row.providerReported : row.estimated, r);
  }
  const provMap = new Map<string, { provider: string; model: string | null; providerReported: UsageTotals; estimated: UsageTotals }>();
  for (const r of byProv) {
    const key = `${r.provider}::${r.model ?? ""}`;
    let row = provMap.get(key);
    if (!row) provMap.set(key, (row = { provider: r.provider, model: r.model, providerReported: emptyTotals(), estimated: emptyTotals() }));
    addTotals(r.source === "PROVIDER_REPORTED" ? row.providerReported : row.estimated, r);
  }
  return {
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    providerReported,
    estimated,
    subscriptionQuota: "unavailable",
    subscription: { note: "Usage details unavailable from provider." },
    providerLimits: SUBSCRIPTION_PROVIDERS.map((provider) => ({
      provider,
      displayName: PROVIDER_DISPLAY_NAME[provider],
      limit: limits[provider],
      limited: isLimitActive(limits[provider]),
    })),
    byEmployee: [...empMap.values()],
    byProvider: [...provMap.values()],
  };
}
