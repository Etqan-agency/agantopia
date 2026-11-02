/** Token / cost budgets for learning runs (per run + per ISO week per company). */
import { DateTime } from "luxon";
import { prisma, type Db } from "@agentopia/db";
import type { LearningConfig, TokenStrategy } from "@agentopia/shared";

/** Thrown when anything tries to spend LLM tokens under the ZERO strategy. */
export class ZeroTokenViolation extends Error {
  constructor(message = "LLM spend attempted in zero-token mode") {
    super(message);
    this.name = "ZeroTokenViolation";
  }
}

export type BudgetUsage = { inputTokens: number; outputTokens: number; costUsd?: number | null };

export type LearningBudgetInit = {
  strategy: TokenStrategy;
  perRunTokenBudget: number;
  weeklyTokenBudget: number;
  weeklyCostBudgetUsd: number;
  /** Tokens / USD already spent this ISO week by the company (excluding this run). */
  weeklyTokensUsed?: number;
  weeklyCostUsed?: number;
};

/** Start of the current ISO week (Monday 00:00) in `tz`, as a JS Date. */
export function isoWeekStart(now: Date, tz: string): Date {
  return DateTime.fromJSDate(now).setZone(tz).startOf("week").toJSDate();
}

/** Sum of tokens and cost of the company's learning runs in the current ISO week. */
export async function weeklyLearningUsage(
  companyId: string,
  now: Date,
  tz: string,
  db: Db = prisma,
  excludeRunId?: string,
): Promise<{ tokens: number; costUsd: number }> {
  const agg = await db.learningRun.aggregate({
    where: { companyId, createdAt: { gte: isoWeekStart(now, tz) }, ...(excludeRunId ? { id: { not: excludeRunId } } : {}) },
    _sum: { tokensUsed: true, costUsd: true },
  });
  return { tokens: agg._sum.tokensUsed ?? 0, costUsd: agg._sum.costUsd ?? 0 };
}

/**
 * Tracks spending of one learning run. `canSpend` is checked before an LLM
 * call with an upper-bound estimate; `record` is called with the provider's
 * reported usage afterwards. Once any cap is reached, `exhausted` is true.
 */
export class LearningBudget {
  readonly strategy: TokenStrategy;
  readonly perRunTokenBudget: number;
  readonly weeklyTokenBudget: number;
  readonly weeklyCostBudgetUsd: number;
  runTokens = 0;
  runCostUsd = 0;
  weeklyTokens: number;
  weeklyCostUsd: number;
  exhausted = false;
  exhaustedReason: string | null = null;

  constructor(init: LearningBudgetInit) {
    this.strategy = init.strategy;
    this.perRunTokenBudget = init.perRunTokenBudget;
    this.weeklyTokenBudget = init.weeklyTokenBudget;
    this.weeklyCostBudgetUsd = init.weeklyCostBudgetUsd;
    this.weeklyTokens = init.weeklyTokensUsed ?? 0;
    this.weeklyCostUsd = init.weeklyCostUsed ?? 0;
    if (this.strategy === "LOW") this.checkCaps();
  }

  /** Build a budget for a run from config + the company's spend this week. */
  static async load(
    companyId: string,
    config: LearningConfig,
    opts: { now?: Date; db?: Db; excludeRunId?: string } = {},
  ): Promise<LearningBudget> {
    const weekly = await weeklyLearningUsage(companyId, opts.now ?? new Date(), config.timezone, opts.db, opts.excludeRunId);
    return new LearningBudget({
      strategy: config.tokenStrategy,
      perRunTokenBudget: config.perRunTokenBudget,
      weeklyTokenBudget: config.weeklyTokenBudget,
      weeklyCostBudgetUsd: config.weeklyCostBudgetUsd,
      weeklyTokensUsed: weekly.tokens,
      weeklyCostUsed: weekly.costUsd,
    });
  }

  /** True when a weekly (company-wide) token or cost cap has been reached. */
  get weeklyExhausted(): boolean {
    return this.strategy === "LOW" && (this.weeklyTokens >= this.weeklyTokenBudget || this.weeklyCostUsd >= this.weeklyCostBudgetUsd);
  }

  /** Remaining tokens allowed for this run (min of run and weekly headroom). */
  get remainingTokens(): number {
    if (this.strategy === "ZERO") return 0;
    return Math.max(0, Math.min(this.perRunTokenBudget - this.runTokens, this.weeklyTokenBudget - this.weeklyTokens));
  }

  /**
   * True when `tokens` more can be spent without crossing any cap.
   * Throws ZeroTokenViolation under the ZERO strategy for any positive spend.
   */
  canSpend(tokens: number): boolean {
    if (this.strategy === "ZERO") {
      if (tokens > 0) throw new ZeroTokenViolation();
      return true;
    }
    if (this.exhausted) return false;
    if (this.weeklyCostUsd >= this.weeklyCostBudgetUsd) return false;
    return tokens <= this.remainingTokens;
  }

  /** Record actual usage; marks the budget exhausted when a cap is reached. */
  record(usage: BudgetUsage): void {
    const tokens = Math.max(0, usage.inputTokens) + Math.max(0, usage.outputTokens);
    if (this.strategy === "ZERO" && (tokens > 0 || (usage.costUsd ?? 0) > 0)) throw new ZeroTokenViolation();
    this.runTokens += tokens;
    this.weeklyTokens += tokens;
    if (usage.costUsd != null) {
      this.runCostUsd += usage.costUsd;
      this.weeklyCostUsd += usage.costUsd;
    }
    this.checkCaps();
  }

  /** Mark exhausted explicitly (e.g. the next call would not fit). */
  markExhausted(reason: string): void {
    this.exhausted = true;
    this.exhaustedReason ??= reason;
  }

  private checkCaps(): void {
    if (this.runTokens >= this.perRunTokenBudget) this.markExhausted("per-run token budget reached");
    else if (this.weeklyTokens >= this.weeklyTokenBudget) this.markExhausted("weekly token budget reached");
    else if (this.weeklyCostUsd >= this.weeklyCostBudgetUsd) this.markExhausted("weekly cost budget reached");
  }
}
