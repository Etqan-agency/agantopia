import { z } from "zod";
import { TOKEN_STRATEGIES, WEEKDAYS } from "./enums";
import { TimeZone } from "./schema-utils";

export const CompanySettingsSchema = z.object({
  maxConcurrentExecutions: z.number().int().min(1).max(10).default(2),
  requireApprovalForPaidExecution: z.boolean().default(false),
  requireApprovalForShell: z.boolean().default(true),
  requireApprovalForNetwork: z.boolean().default(true),
  defaultMaxCostUsd: z.number().min(0).max(100).default(1),
  defaultTimeoutSec: z.number().int().min(30).max(7200).default(900),
  retentionDays: z.number().int().min(1).max(3650).default(365),
  allowCrossCompanyCollaboration: z.boolean().default(false),
  /** Learning LOW mode may call an explicit API_KEY connection (billed separately) only when true. Default: zero-token notes. */
  allowPaidLearning: z.boolean().default(false),
});
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;

/** Stored on ProviderConnection.settings. Mirrors official SDK surfaces only. */
export const ProviderSettingsSchema = z.object({
  /** Claude Agent SDK permissionMode / Codex approvalPolicy mapping */
  permissionMode: z.enum(["default", "acceptEdits", "dontAsk", "plan"]).default("acceptEdits"),
  allowedTools: z.array(z.string()).default(["Read", "Edit", "Write", "Glob", "Grep"]),
  disallowedTools: z.array(z.string()).default(["Bash(rm -rf *)", "WebFetch", "WebSearch"]),
  maxTurns: z.number().int().min(1).max(200).default(30),
  maxCostUsd: z.number().min(0).max(100).default(1),
  timeoutSec: z.number().int().min(30).max(7200).default(900),
  concurrency: z.number().int().min(1).max(5).default(1),
  /** Codex sandboxMode */
  sandboxMode: z.enum(["read-only", "workspace-write"]).default("workspace-write"),
  /** Provider-specific reasoning option. Claude: effort; Codex: modelReasoningEffort. */
  reasoning: z.enum(["low", "medium", "high"]).optional(),
  autoApprove: z.boolean().default(false),
  retryLimit: z.number().int().min(0).max(3).default(1),
});
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;

export const LearningConfigSchema = z.object({
  enabled: z.boolean().default(true),
  days: z.array(z.enum(WEEKDAYS)).min(1).max(7).default(["monday", "thursday"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  timezone: TimeZone.default("Africa/Cairo"),
  maxDurationMinutes: z.number().int().min(5).max(20).default(10),
  tokenStrategy: z.enum(TOKEN_STRATEGIES).default("LOW"),
  sourceDocs: z.boolean().default(true),
  sourceGithub: z.boolean().default(true),
  specializationOnly: z.boolean().default(true),
  approvalRequired: z.boolean().default(true),
  skipUnchanged: z.boolean().default(true),
  pauseOnBudgetExhaustion: z.boolean().default(true),
  perRunTokenBudget: z.number().int().min(0).max(200000).default(20000),
  weeklyTokenBudget: z.number().int().min(0).max(1000000).default(60000),
  weeklyCostBudgetUsd: z.number().min(0).max(50).default(0.5),
});
export type LearningConfig = z.infer<typeof LearningConfigSchema>;
