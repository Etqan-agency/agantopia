import type { ProviderAuthMode, ProviderErrorKind, ProviderSettings } from "@agentopia/shared";

export type ProviderKind = "ANTHROPIC" | "OPENAI" | "SIMULATED";

export interface VerifyResult {
  ok: boolean;
  status: "VERIFIED" | "INVALID";
  message?: string;
  models?: string[];
}

export interface ExecutionRequest {
  executionSessionId: string;
  companyId: string;
  taskId: string;
  employeeId: string;
  systemPrompt: string;
  taskBrief: string;
  /** Already wrapped as untrusted data (see prompt/assemble.wrapUntrusted). */
  memoryContext: string;
  workspacePath: string;
  model?: string;
  settings: ProviderSettings;
  secret?: string;
  signal: AbortSignal;
  resumeSessionId?: string | null;
  /**
   * SUBSCRIPTION_CLI: run the user's own, unmodified CLI with its own sign-in
   * (local runner only; provider API keys are stripped from the child env).
   * API_KEY / undefined: existing SDK behaviour with `secret` or env keys.
   */
  authMode?: ProviderAuthMode;
  /** Absolute path of the CLI binary to spawn (subscription mode). */
  binaryPath?: string;
}

export type ProviderEvent =
  | { type: "message"; role: "assistant"; text: string }
  | { type: "tool_use"; tool: string; input: unknown; toolUseId?: string }
  | { type: "tool_result"; tool?: string; output: string; isError?: boolean }
  | { type: "progress"; text: string }
  | { type: "session"; providerSessionId: string }
  /** Provider-reported plan/rate-limit status (Claude `rate_limit_event`). Never invented. */
  | { type: "provider_status"; status: "allowed" | "allowed_warning" | "rejected"; utilization?: number; windowLabel?: string; resetAt?: string };

export interface UsageReport {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  costSource: "provider_reported" | "estimated" | "unavailable";
  model?: string;
  /** Token counts' provenance when it differs from the cost's (subscription CLI: tokens provider_reported, cost estimated). */
  tokenSource?: "provider_reported" | "estimated";
}

export type ApprovalKindRequest = "TOOL_USE" | "DESTRUCTIVE" | "PUBLISH" | "COST";

export interface ExecutionHooks {
  onEvent(e: ProviderEvent): Promise<void> | void;
  onUsage(u: UsageReport): Promise<void> | void;
  requestApproval(req: { kind: ApprovalKindRequest; title: string; payload: unknown }): Promise<{ approved: boolean; note?: string }>;
}

export type ArtifactKindOut = "TEXT" | "FILE" | "DIFF" | "LOG";

export interface ExecutionArtifact {
  name: string;
  kind: ArtifactKindOut;
  content?: string;
  path?: string;
  mimeType?: string;
}

export interface ExecutionResult {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  summary: string;
  providerSessionId?: string | null;
  usage: UsageReport;
  artifacts: ExecutionArtifact[];
  error?: string;
  numTurns?: number;
  /** Set when the failure is a known provider condition (usage/rate limit, auth, unsupported setup). */
  errorKind?: ProviderErrorKind;
  /** Provider-reported limit timing (never invented). */
  limit?: { resetAt?: string; retryAfterAt?: string; source: "provider_reported" | "classified" };
  /**
   * A hard spending stop (Agentopia cost cap or the SDK's `error_max_budget_usd`):
   * the task fails once instead of being retried.
   */
  terminal?: boolean;
  /** Non-secret run metadata, e.g. Claude `apiKeySource`. */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ProviderAdapter {
  kind: ProviderKind;
  verify(secret?: string): Promise<VerifyResult>;
  listModels(secret?: string): Promise<string[]>;
  run(req: ExecutionRequest, hooks: ExecutionHooks): Promise<ExecutionResult>;
}

/** A zeroed usage report. */
export function emptyUsage(costSource: UsageReport["costSource"] = "unavailable", model?: string): UsageReport {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: costSource === "unavailable" ? null : 0, costSource, model };
}
