import type { ProviderAuthMode, ProviderErrorKind, ProviderLimitKind } from "./enums";

/** User-facing provider status (one per provider, derived server-side; never invented). */
export const PROVIDER_UI_STATUSES = [
  "CONNECTED",
  "DISCONNECTED",
  "READY",
  "RUNNING",
  "USAGE_LIMIT_REACHED",
  "WAITING_FOR_RESET",
  "AUTHENTICATION_EXPIRED",
  "RUNNER_OFFLINE",
  "UNSUPPORTED",
] as const;
export type ProviderUiStatus = (typeof PROVIDER_UI_STATUSES)[number];

export const PROVIDER_UI_STATUS_LABEL: Record<ProviderUiStatus, string> = {
  CONNECTED: "Connected",
  DISCONNECTED: "Disconnected",
  READY: "Ready",
  RUNNING: "Running",
  USAGE_LIMIT_REACHED: "Usage limit reached",
  WAITING_FOR_RESET: "Waiting for reset",
  AUTHENTICATION_EXPIRED: "Authentication expired",
  RUNNER_OFFLINE: "Runner offline",
  UNSUPPORTED: "Unsupported integration",
};

/** What the local runner detects about an installed provider CLI. No credentials are ever read. */
export type RunnerToolInfo = {
  installed: boolean;
  /** Absolute path of the binary the runner will spawn (user-installed preferred, bundled fallback). */
  path?: string;
  version?: string;
  /** Bundled = shipped with Agentopia's node_modules (unmodified vendor binary). */
  bundled?: boolean;
  /** Detected sign-in state. "logged_in" means a login artifact exists (keychain item / auth file / `codex login status`); contents are never read. */
  auth: "logged_in" | "not_logged_in" | "unknown";
  /** e.g. "ChatGPT" | "API key" | "keychain" | "credentials file" */
  authMethod?: string;
  /** Whether the runner will execute jobs for this tool in the current mode. */
  executionAvailable: boolean;
  reason?: string;
};

export type RunnerCapabilitiesView = {
  version: string;
  hostname?: string;
  auth: "subscription" | "env" | "cli";
  tools: { claude: RunnerToolInfo; codex: RunnerToolInfo };
  detectedAt: string;
};

export type ProviderLimitView = {
  kind: ProviderLimitKind;
  message?: string | null;
  retryAfterAt?: string | null;
  resetAt?: string | null;
  source?: "provider_reported" | "classified" | null;
  lastErrorAt?: string | null;
};

/** GET /api/companies/:cid/providers/status → one entry per provider. */
export type ProviderStatusView = {
  provider: "ANTHROPIC" | "OPENAI";
  displayName: "Claude Code" | "OpenAI Codex";
  status: ProviderUiStatus;
  statusLabel: string;
  /** Short, truthful explanation for the status. */
  detail: string;
  authMode: ProviderAuthMode | null;
  authMethodLabel: string;
  connectionId: string | null;
  runner: { id: string; name: string; status: "ONLINE" | "OFFLINE" | "REVOKED"; lastSeenAt: string | null; tool: RunnerToolInfo | null } | null;
  limit: ProviderLimitView;
  activeExecutions: number;
  waitingTasks: number;
  /** Always "unavailable" unless the provider reports usage; never an invented percentage. */
  usage: { kind: "unavailable"; note: "Usage details unavailable from provider." } | { kind: "reported"; utilization?: number; windowLabel?: string; resetAt?: string };
  errorKind?: ProviderErrorKind;
};
