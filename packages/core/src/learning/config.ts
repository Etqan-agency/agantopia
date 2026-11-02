/** Mapping between LearningSchedule rows and the shared LearningConfig contract. */
import { prisma, type Db, type LearningSchedule } from "@agentopia/db";
import { LearningConfigSchema, type LearningConfig } from "@agentopia/shared";

/** Convert a LearningSchedule row into a validated LearningConfig. */
export function scheduleToConfig(s: LearningSchedule): LearningConfig {
  return LearningConfigSchema.parse({
    enabled: s.enabled,
    days: s.days,
    time: s.time,
    timezone: s.timezone,
    maxDurationMinutes: s.maxDurationMinutes,
    tokenStrategy: s.tokenStrategy,
    sourceDocs: s.sourceDocs,
    sourceGithub: s.sourceGithub,
    specializationOnly: s.specializationOnly,
    approvalRequired: s.approvalRequired,
    skipUnchanged: s.skipUnchanged,
    pauseOnBudgetExhaustion: s.pauseOnBudgetExhaustion,
    perRunTokenBudget: s.perRunTokenBudget,
    weeklyTokenBudget: s.weeklyTokenBudget,
    weeklyCostBudgetUsd: s.weeklyCostBudgetUsd,
  });
}

/**
 * Effective schedule for an employee: the employee-specific schedule overrides
 * the company default (employeeId = null). Returns null config when neither exists.
 */
export async function resolveEffectiveSchedule(
  companyId: string,
  employeeId: string,
  db: Db = prisma,
): Promise<{ schedule: LearningSchedule | null; config: LearningConfig }> {
  const rows = await db.learningSchedule.findMany({
    where: { companyId, OR: [{ employeeId }, { employeeId: null }] },
  });
  const schedule = rows.find((r) => r.employeeId === employeeId) ?? rows.find((r) => r.employeeId === null) ?? null;
  return { schedule, config: schedule ? scheduleToConfig(schedule) : LearningConfigSchema.parse({}) };
}
