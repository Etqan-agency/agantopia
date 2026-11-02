/**
 * Subscription-first provider status: one truthful view per provider (Claude
 * Code, OpenAI Codex) derived from the connection, the latest runner heartbeat
 * capabilities and the ProviderLimitState row. Nothing is invented: no usage
 * percentages, no countdowns, no balances.
 *
 * The status itself is derived by core (`@agentopia/core/providers/status`);
 * this module holds the web-side helpers (labels, capability sanitizing,
 * limit views for task detail / usage, clearing through core).
 */
import { prisma } from "@agentopia/db";
import {
  PROVIDER_AUTH_MODE_LABEL,
  PROVIDER_UI_STATUS_LABEL,
  type ProviderAuthMode,
  type ProviderLimitKind,
  type ProviderLimitView,
  type ProviderStatusView,
  type RunnerCapabilitiesView,
  type RunnerToolInfo,
} from "@agentopia/shared";
import { clearProviderLimitCore, emitEvent, getProviderStatusesCore } from "../core";

export const SUBSCRIPTION_PROVIDERS = ["ANTHROPIC", "OPENAI"] as const;
export type SubscriptionProvider = (typeof SUBSCRIPTION_PROVIDERS)[number];

export const PROVIDER_DISPLAY_NAME: Record<SubscriptionProvider, ProviderStatusView["displayName"]> = {
  ANTHROPIC: "Claude Code",
  OPENAI: "OpenAI Codex",
};

export const SUBSCRIPTION_METHOD_LABEL: Record<SubscriptionProvider, string> = {
  ANTHROPIC: "Your Claude plan via the unmodified Claude Code CLI on your machine",
  OPENAI: "Your ChatGPT plan via the Codex CLI on your machine",
};

/** What the person has to do themselves; Agentopia never performs a vendor login. */
export const RECONNECT_INSTRUCTIONS: Record<SubscriptionProvider, string> = {
  ANTHROPIC: "On your machine run `claude` and `/login`, then start the runner.",
  OPENAI: "On your machine run `codex login`, then start the runner.",
};

/** A runner is considered online only with a recent heartbeat (runner heartbeats every 30 s). */
const ONLINE_WINDOW_MS = 120_000;

export function isSubscriptionProvider(p: string | null | undefined): p is SubscriptionProvider {
  return p === "ANTHROPIC" || p === "OPENAI";
}

export function providerFromString(p: string | null | undefined): SubscriptionProvider | null {
  const up = (p ?? "").toUpperCase();
  return isSubscriptionProvider(up) ? up : null;
}

export function authMethodLabel(provider: string, authMode: ProviderAuthMode | null | undefined, mode?: string | null): string {
  if (provider === "SIMULATED" || mode === "SIMULATED") return "Simulated (no model is called)";
  if (!authMode) return "Not connected";
  if (authMode === "API_KEY") return PROVIDER_AUTH_MODE_LABEL.API_KEY;
  return isSubscriptionProvider(provider) ? SUBSCRIPTION_METHOD_LABEL[provider] : PROVIDER_AUTH_MODE_LABEL.SUBSCRIPTION_CLI;
}

// --- Runner capabilities (untrusted JSON from the runner; keep only known, bounded fields) ---
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.slice(0, max) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);

export function parseToolInfo(raw: unknown): RunnerToolInfo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const auth = r.auth === "logged_in" || r.auth === "not_logged_in" ? r.auth : "unknown";
  const out: RunnerToolInfo = { installed: r.installed === true, auth, executionAvailable: r.executionAvailable === true };
  const path = str(r.path, 500);
  const version = str(r.version, 80);
  const bundled = bool(r.bundled);
  const authMethod = str(r.authMethod, 80);
  const reason = str(r.reason, 300);
  if (path) out.path = path;
  if (version) out.version = version;
  if (bundled !== undefined) out.bundled = bundled;
  if (authMethod) out.authMethod = authMethod;
  if (reason) out.reason = reason;
  return out;
}

/** Display-safe capability summary. Old runners (no `tools`) still parse; missing fields are omitted. */
export type RunnerCapabilitiesSummary = Partial<Omit<RunnerCapabilitiesView, "tools" | "auth">> & {
  auth?: string;
  providers?: string[];
  tools?: { claude?: RunnerToolInfo; codex?: RunnerToolInfo };
};

export function parseCapabilities(raw: unknown): RunnerCapabilitiesSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: RunnerCapabilitiesSummary = {};
  const version = str(r.version, 40);
  const hostname = str(r.hostname, 120);
  const auth = str(r.auth, 20);
  const detectedAt = str(r.detectedAt, 40);
  if (version) out.version = version;
  if (hostname) out.hostname = hostname;
  if (auth) out.auth = auth;
  if (detectedAt && !Number.isNaN(Date.parse(detectedAt))) out.detectedAt = new Date(detectedAt).toISOString();
  if (Array.isArray(r.providers)) out.providers = r.providers.filter((p): p is string => typeof p === "string").slice(0, 5).map((p) => p.slice(0, 20));
  if (r.tools && typeof r.tools === "object" && !Array.isArray(r.tools)) {
    const t = r.tools as Record<string, unknown>;
    const claude = parseToolInfo(t.claude);
    const codex = parseToolInfo(t.codex);
    out.tools = { ...(claude ? { claude } : {}), ...(codex ? { codex } : {}) };
  }
  return out;
}

// --- Limits -------------------------------------------------------------------------------------
type LimitRow = { kind: ProviderLimitKind; message: string | null; retryAfterAt: Date | null; resetAt: Date | null; source: string | null; lastErrorAt: Date | null };

export const OK_LIMIT: ProviderLimitView = { kind: "OK", message: null, retryAfterAt: null, resetAt: null, source: null, lastErrorAt: null };

export function toLimitView(row: LimitRow | null | undefined): ProviderLimitView {
  if (!row) return { ...OK_LIMIT };
  return {
    kind: row.kind,
    message: row.message,
    retryAfterAt: row.retryAfterAt?.toISOString() ?? null,
    resetAt: row.resetAt?.toISOString() ?? null,
    source: row.source === "provider_reported" || row.source === "classified" ? row.source : null,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
  };
}

/**
 * True while the provider should not be used (same rule as core's
 * `availabilityOf`): AUTH_EXPIRED until cleared; usage/rate limits until the
 * later of resetAt / retryAfterAt has passed.
 */
export function isLimitActive(limit: ProviderLimitView, now = Date.now()): boolean {
  if (limit.kind === "OK") return false;
  if (limit.kind === "AUTH_EXPIRED") return true;
  const until = Math.max(...[limit.resetAt, limit.retryAfterAt].map((t) => (t ? Date.parse(t) : 0)));
  return until > now;
}

/**
 * Truthful reset sentence: a time is called provider-reported only when the
 * provider reported it; a classified retry time is Agentopia's own backoff.
 */
export function limitResetSentence(limit: Pick<ProviderLimitView, "resetAt" | "retryAfterAt" | "source">): string {
  const reported = limit.source === "provider_reported";
  if (limit.resetAt && reported) return `Resets at ${limit.resetAt} (reported by the provider).`;
  if (limit.retryAfterAt && reported) return `The provider asked to retry after ${limit.retryAfterAt}.`;
  const retry = limit.retryAfterAt ? ` Agentopia retries automatically after ${limit.retryAfterAt}.` : "";
  return `Reset time not reported by provider.${retry}`;
}

const limitSelect = { provider: true, kind: true, message: true, retryAfterAt: true, resetAt: true, source: true, lastErrorAt: true } as const;

export async function getProviderLimits(companyId: string): Promise<Record<SubscriptionProvider, ProviderLimitView>> {
  const rows = await prisma.providerLimitState.findMany({ where: { companyId, provider: { in: [...SUBSCRIPTION_PROVIDERS] } }, select: limitSelect });
  const out = { ANTHROPIC: { ...OK_LIMIT }, OPENAI: { ...OK_LIMIT } } as Record<SubscriptionProvider, ProviderLimitView>;
  for (const r of rows) if (isSubscriptionProvider(r.provider)) out[r.provider] = toLimitView(r);
  return out;
}

export async function getProviderLimitView(companyId: string, provider: SubscriptionProvider): Promise<ProviderLimitView> {
  const row = await prisma.providerLimitState.findUnique({ where: { companyId_provider: { companyId, provider } }, select: limitSelect });
  return toLimitView(row);
}

/** Clears a provider limit through core's Usage Limit Manager, or locally (row → OK + event) when core is not available. */
export async function clearLimit(companyId: string, provider: SubscriptionProvider, reason: string): Promise<boolean> {
  const viaCore = await clearProviderLimitCore(companyId, provider, reason);
  if (viaCore !== null) return viaCore;
  const res = await prisma.providerLimitState.updateMany({
    where: { companyId, provider, kind: { not: "OK" } },
    data: { kind: "OK", message: null, retryAfterAt: null, resetAt: null, source: null },
  });
  if (res.count > 0) await emitEvent({ companyId, type: "provider.limit_cleared", payload: { provider, kind: "OK", message: reason } });
  return res.count > 0;
}

// --- Status --------------------------------------------------------------------------------------------
/** A runner is considered online only with a recent heartbeat (runner heartbeats every 30 s). */
export function isRunnerOnline(r: { status: string; lastSeenAt: Date | string | null }, now = Date.now()): boolean {
  if (r.status !== "ONLINE" || !r.lastSeenAt) return false;
  return now - new Date(r.lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

/**
 * GET /providers/status: core's `getProviderStatuses` (`@agentopia/core/providers/status`).
 * Only when core cannot be loaded is a reduced local view derived from the same stored facts.
 */
export async function getProviderStatuses(companyId: string): Promise<ProviderStatusView[]> {
  const fromCore = await getProviderStatusesCore(companyId);
  if (fromCore) return fromCore as ProviderStatusView[];
  return deriveStatusesLocally(companyId);
}

const TOOL_NAME: Record<SubscriptionProvider, string> = { ANTHROPIC: "Claude Code", OPENAI: "Codex CLI" };

/** Fallback derivation (same precedence as core, without execution routing details). */
export async function deriveStatusesLocally(companyId: string, now = Date.now()): Promise<ProviderStatusView[]> {
  const [connections, runners, limits] = await Promise.all([
    prisma.providerConnection.findMany({
      where: { companyId, provider: { in: [...SUBSCRIPTION_PROVIDERS] }, status: { not: "REVOKED" }, revokedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, provider: true, mode: true, authMode: true, status: true, verifyError: true },
    }),
    prisma.runner.findMany({ where: { companyId, revokedAt: null, status: { not: "REVOKED" } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, name: true, status: true, lastSeenAt: true, capabilities: true } }),
    getProviderLimits(companyId),
  ]);
  const out: ProviderStatusView[] = [];
  for (const provider of SUBSCRIPTION_PROVIDERS) {
    const mine = connections.filter((c) => c.provider === provider);
    const conn = mine.find((c) => c.authMode === "SUBSCRIPTION_CLI") ?? mine[0] ?? null;
    const label = provider === "ANTHROPIC" ? "anthropic" : "openai";
    const [activeExecutions, waitingTasks] = await Promise.all([
      prisma.executionSession.count({ where: { companyId, provider: label, status: { in: ["RUNNING", "WAITING_APPROVAL"] } } }),
      prisma.task.count({ where: { companyId, status: "WAITING_FOR_PROVIDER_LIMIT", assignee: { providerConnection: { provider } } } }),
    ]);
    const usesRunner = !!conn && (conn.authMode === "SUBSCRIPTION_CLI" || conn.mode === "LOCAL_RUNNER");
    const runnerRow = usesRunner ? (runners.find((r) => isRunnerOnline(r, now)) ?? runners[0] ?? null) : null;
    const online = !!runnerRow && isRunnerOnline(runnerRow, now);
    const caps = runnerRow ? parseCapabilities(runnerRow.capabilities) : null;
    const tool = (provider === "ANTHROPIC" ? caps?.tools?.claude : caps?.tools?.codex) ?? null;
    const limit = limits[provider];
    const name = PROVIDER_DISPLAY_NAME[provider];
    let status: ProviderStatusView["status"];
    let detail: string;
    if (!conn) {
      status = "DISCONNECTED";
      detail = `${name} is not connected. Connect it on the Integrations page.`;
    } else if (limit.kind === "AUTH_EXPIRED") {
      status = "AUTHENTICATION_EXPIRED";
      detail = conn.authMode === "SUBSCRIPTION_CLI" ? RECONNECT_INSTRUCTIONS[provider] : "The provider rejected the API key. Update or re-verify it.";
    } else if (isLimitActive(limit, now)) {
      status = waitingTasks > 0 ? "WAITING_FOR_RESET" : "USAGE_LIMIT_REACHED";
      detail = `${limit.kind === "USAGE_LIMIT" ? "Usage limit reached" : "Rate limited"}. ${limitResetSentence(limit)}`;
    } else if (conn.status === "INVALID") {
      status = "AUTHENTICATION_EXPIRED";
      detail = conn.verifyError ?? "The connection failed verification.";
    } else if (usesRunner && !online) {
      status = "RUNNER_OFFLINE";
      detail = runnerRow ? `Runner "${runnerRow.name}" is offline. Start the local runner on your machine.` : "No local runner is registered. Create one and start it on your machine.";
    } else if (usesRunner && tool && !tool.installed) {
      status = "UNSUPPORTED";
      detail = tool.reason ?? `${TOOL_NAME[provider]} is not installed on the runner machine.`;
    } else if (usesRunner && tool?.auth === "not_logged_in") {
      status = "AUTHENTICATION_EXPIRED";
      detail = `${TOOL_NAME[provider]} is not signed in on the runner machine. ${RECONNECT_INSTRUCTIONS[provider]}`;
    } else if (activeExecutions > 0) {
      status = "RUNNING";
      detail = `${activeExecutions} execution(s) running.`;
    } else if (usesRunner) {
      status = "READY";
      detail = `Ready on runner "${runnerRow!.name}".`;
    } else {
      status = "CONNECTED";
      detail = "API key saved (billed separately by the provider).";
    }
    out.push({
      provider,
      displayName: name,
      status,
      statusLabel: PROVIDER_UI_STATUS_LABEL[status],
      detail,
      authMode: conn?.authMode ?? null,
      authMethodLabel: conn ? authMethodLabel(provider, conn.authMode, conn.mode) : "Not connected",
      connectionId: conn?.id ?? null,
      runner: runnerRow
        ? { id: runnerRow.id, name: runnerRow.name, status: online ? "ONLINE" : "OFFLINE", lastSeenAt: runnerRow.lastSeenAt?.toISOString() ?? null, tool }
        : null,
      limit,
      activeExecutions,
      waitingTasks,
      usage: { kind: "unavailable", note: "Usage details unavailable from provider." },
    });
  }
  return out;
}
