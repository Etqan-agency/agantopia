import { z } from "zod";
import { PROVIDER_AUTH_MODES, PROVIDER_ERROR_KINDS, PROVIDER_KINDS, ProviderSettingsSchema } from "@agentopia/shared";
import type { ProviderEvent } from "../providers/types";

/** Wire limits with headroom under the schema maxima below (a too-long field would reject the whole batch). */
export const MESSAGE_TEXT_MAX = 19_000;
export const TOOL_OUTPUT_MAX = 19_000;
export const PROGRESS_TEXT_MAX = 4_900;
export const APPROVAL_TITLE_MAX = 290;
/** Max items per POST /events batch (schema: 200). */
export const EVENT_BATCH_MAX = 200;

/** Truncates long text with a short marker (the result stays well under `max` + 40 chars). */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

/** Hard clip for short fields (no marker, so the result never exceeds `max`). */
export function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

/** Bounds a provider event to the wire schema (long text is truncated, never rejected). */
export function boundProviderEvent(e: ProviderEvent): ProviderEvent {
  switch (e.type) {
    case "message":
      return { ...e, text: truncate(e.text, MESSAGE_TEXT_MAX) };
    case "progress":
      return { ...e, text: truncate(e.text, PROGRESS_TEXT_MAX) };
    case "tool_use":
      return { ...e, tool: clip(e.tool, 200), ...(e.toolUseId !== undefined ? { toolUseId: clip(e.toolUseId, 200) } : {}) };
    case "tool_result":
      return { ...e, output: truncate(e.output, TOOL_OUTPUT_MAX), ...(e.tool !== undefined ? { tool: clip(e.tool, 200) } : {}) };
    case "session":
      return { ...e, providerSessionId: clip(e.providerSessionId, 200) };
    case "provider_status":
      return { ...e, ...(e.windowLabel !== undefined ? { windowLabel: clip(e.windowLabel, 100) } : {}) };
  }
}

/**
 * Local-runner wire protocol (bearer = runner token). Shared by the web route
 * handlers (`apps/web/src/app/api/runner/...`) and the runner CLI.
 */
/** What the runner detected for one CLI (see shared RunnerToolInfo). Never contains credentials. */
export const RunnerToolInfoSchema = z.object({
  installed: z.boolean(),
  path: z.string().max(1000).optional(),
  version: z.string().max(200).optional(),
  bundled: z.boolean().optional(),
  auth: z.enum(["logged_in", "not_logged_in", "unknown"]),
  authMethod: z.string().max(60).optional(),
  executionAvailable: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * Backward compatible: `auth` "cli" is the legacy name of "subscription"
 * (normalized on parse); `tools` / `detectedAt` are optional (older runners).
 */
export const RunnerCapabilitiesSchema = z.object({
  providers: z.array(z.enum(PROVIDER_KINDS)).min(1),
  auth: z.enum(["subscription", "env", "cli"]).transform((a) => (a === "cli" ? "subscription" : a)),
  version: z.string().max(40),
  hostname: z.string().max(120).optional(),
  tools: z.object({ claude: RunnerToolInfoSchema, codex: RunnerToolInfoSchema }).optional(),
  detectedAt: z.string().max(40).optional(),
});
export type RunnerCapabilities = z.input<typeof RunnerCapabilitiesSchema>;
export type RunnerCapabilitiesParsed = z.output<typeof RunnerCapabilitiesSchema>;

/** POST /api/runner/heartbeat */
export const RunnerHeartbeatInput = z.object({ capabilities: RunnerCapabilitiesSchema });
export type RunnerHeartbeatResponse = { runnerId: string; serverTime: string };

/** A job granted by POST /api/runner/jobs/claim (`{ job: null }` when nothing is queued). */
export const RunnerJobSchema = z.object({
  executionSessionId: z.string(),
  companyId: z.string(),
  taskId: z.string(),
  employeeId: z.string(),
  projectId: z.string().nullable(),
  attempt: z.number().int(),
  provider: z.enum(PROVIDER_KINDS),
  model: z.string().nullable(),
  systemPrompt: z.string(),
  taskBrief: z.string(),
  memoryContext: z.string(),
  settings: ProviderSettingsSchema,
  /** Present only for explicit API_KEY connections used through a runner; never for SUBSCRIPTION_CLI. */
  secret: z.string().nullable(),
  /** SUBSCRIPTION_CLI → run the user's own CLI with its own sign-in (keys stripped). Absent on old servers (treated per runner --auth). */
  authMode: z.enum(PROVIDER_AUTH_MODES).nullable().optional(),
  resumeSessionId: z.string().nullable(),
  timeoutSec: z.number().int(),
  costCapUsd: z.number(),
});
export type RunnerJob = z.infer<typeof RunnerJobSchema>;
export const RunnerClaimResponseSchema = z.object({ job: RunnerJobSchema.nullable() });

const ProviderEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), role: z.literal("assistant"), text: z.string().max(20000) }),
  z.object({ type: z.literal("tool_use"), tool: z.string().max(200), input: z.unknown(), toolUseId: z.string().max(200).optional() }),
  z.object({ type: z.literal("tool_result"), tool: z.string().max(200).optional(), output: z.string().max(20000), isError: z.boolean().optional() }),
  z.object({ type: z.literal("progress"), text: z.string().max(5000) }),
  z.object({ type: z.literal("session"), providerSessionId: z.string().max(200) }),
  z.object({
    type: z.literal("provider_status"),
    status: z.enum(["allowed", "allowed_warning", "rejected"]),
    utilization: z.number().min(0).max(100).optional(),
    windowLabel: z.string().max(100).optional(),
    resetAt: z.string().max(40).optional(),
  }),
]);

/** Provider limit timing reported by the runner (never invented). */
export const ProviderLimitInfoSchema = z.object({
  resetAt: z.string().max(40).optional(),
  retryAfterAt: z.string().max(40).optional(),
  source: z.enum(["provider_reported", "classified"]),
});

export const UsageReportSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cacheReadTokens: z.number().int().min(0),
  cacheWriteTokens: z.number().int().min(0),
  costUsd: z.number().min(0).nullable(),
  costSource: z.enum(["provider_reported", "estimated", "unavailable"]),
  model: z.string().max(200).optional(),
  tokenSource: z.enum(["provider_reported", "estimated"]).optional(),
});

export const RunnerEventItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), event: ProviderEventSchema }),
  z.object({ type: z.literal("usage"), usage: UsageReportSchema }),
  z.object({
    type: z.literal("approval_request"),
    clientRequestId: z.string().max(100),
    approvalKind: z.enum(["TOOL_USE", "DESTRUCTIVE", "PUBLISH", "COST"]),
    title: z.string().max(300),
    payload: z.unknown(),
  }),
  /** Early limit report (the job's `complete` still carries errorKind and parks the task). */
  z.object({
    type: z.literal("provider_limit"),
    errorKind: z.enum(["USAGE_LIMIT", "RATE_LIMIT", "AUTH_EXPIRED"]),
    message: z.string().max(1000),
    limit: ProviderLimitInfoSchema.optional(),
  }),
]);
export type RunnerEventItem = z.infer<typeof RunnerEventItemSchema>;

/** POST /api/runner/jobs/:sid/events */
export const RunnerEventsInput = z.object({ items: z.array(RunnerEventItemSchema).max(200) });
export type RunnerEventsResponse = { ok: true; cancel: boolean; approvals: Record<string, string> };

/** GET /api/runner/jobs/:sid/control */
export type RunnerControlResponse = {
  cancel: boolean;
  approvals: Array<{ id: string; status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED"; note: string | null }>;
};

/** POST /api/runner/jobs/:sid/complete */
export const RunnerCompleteInput = z.object({
  status: z.enum(["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"]),
  summary: z.string().max(50000),
  providerSessionId: z.string().max(200).nullable().optional(),
  usage: UsageReportSchema,
  artifacts: z
    .array(
      z.object({
        name: z.string().max(200),
        kind: z.enum(["TEXT", "FILE", "DIFF", "LOG"]),
        content: z.string().max(256 * 1024).optional(),
        mimeType: z.string().max(100).optional(),
      }),
    )
    .max(20),
  error: z.string().max(5000).optional(),
  numTurns: z.number().int().optional(),
  /** Optional (older runners omit it): USAGE_LIMIT / RATE_LIMIT / AUTH_EXPIRED park the task without consuming an attempt. */
  errorKind: z.enum(PROVIDER_ERROR_KINDS).optional(),
  limit: ProviderLimitInfoSchema.optional(),
  /** Optional: a hard spending stop (cost cap / budget); the task fails once instead of being retried. */
  terminal: z.boolean().optional(),
});
export type RunnerCompleteInputT = z.infer<typeof RunnerCompleteInput>;
