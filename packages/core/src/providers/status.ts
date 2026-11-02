/**
 * Server-side provider status for the UI (GET /api/companies/:cid/providers/status).
 * Derived only from stored facts: the connection (authMode), runner rows and
 * their detected tools, the Usage Limit Manager state, active executions and
 * waiting tasks. Usage percentages are shown only when the provider reported
 * them (Claude `rate_limit_event` utilization); otherwise "unavailable".
 */
import { prisma, type ProviderConnection, type ProviderLimitState, type Runner } from "@agentopia/db";
import { PROVIDER_UI_STATUS_LABEL, type ProviderErrorKind, type ProviderStatusView, type ProviderUiStatus, type RunnerToolInfo } from "@agentopia/shared";
import { runnerCanExecute, runnerToolFor } from "../orchestration/gate";
import { availabilityOf } from "./limits";

const PROVIDERS = [
  { provider: "ANTHROPIC", displayName: "Claude Code", label: "anthropic", tool: "Claude Code", signIn: "run `claude` and use /login" },
  { provider: "OPENAI", displayName: "OpenAI Codex", label: "openai", tool: "Codex CLI", signIn: "run `codex login`" },
] as const;

function pickConnection(rows: ProviderConnection[]): ProviderConnection | null {
  const live = rows.filter((c) => !c.revokedAt && c.status !== "REVOKED");
  live.sort((a, b) => (a.authMode === b.authMode ? b.updatedAt.getTime() - a.updatedAt.getTime() : a.authMode === "SUBSCRIPTION_CLI" ? -1 : 1));
  return live[0] ?? null;
}

function pickRunner(runners: Runner[], provider: "ANTHROPIC" | "OPENAI", authMode?: "SUBSCRIPTION_CLI" | "API_KEY" | null): Runner | null {
  const live = runners.filter((r) => r.status !== "REVOKED" && !r.revokedAt);
  const online = live.filter((r) => r.status === "ONLINE");
  return online.find((r) => runnerCanExecute(r.capabilities, provider, authMode)) ?? online[0] ?? [...live].sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0))[0] ?? null;
}

function limitView(s: ProviderLimitState | null): ProviderStatusView["limit"] {
  if (!s) return { kind: "OK", message: null, retryAfterAt: null, resetAt: null, source: null, lastErrorAt: null };
  return {
    kind: s.kind,
    message: s.message,
    retryAfterAt: s.retryAfterAt?.toISOString() ?? null,
    resetAt: s.kind === "OK" ? null : (s.resetAt?.toISOString() ?? null),
    source: s.source === "provider_reported" || s.source === "classified" ? s.source : null,
    lastErrorAt: s.lastErrorAt?.toISOString() ?? null,
  };
}

/** One entry per real provider (Claude Code, OpenAI Codex). */
export async function getProviderStatuses(companyId: string, now: Date = new Date()): Promise<ProviderStatusView[]> {
  const [connections, runners, limits] = await Promise.all([
    prisma.providerConnection.findMany({ where: { companyId, provider: { in: ["ANTHROPIC", "OPENAI"] } } }),
    prisma.runner.findMany({ where: { companyId } }),
    prisma.providerLimitState.findMany({ where: { companyId } }),
  ]);
  const out: ProviderStatusView[] = [];
  for (const p of PROVIDERS) {
    const conn = pickConnection(connections.filter((c) => c.provider === p.provider));
    const limit = limits.find((l) => l.provider === p.provider) ?? null;
    const [activeExecutions, waitingTasks] = await Promise.all([
      prisma.executionSession.count({ where: { companyId, provider: p.label, status: { in: ["RUNNING", "WAITING_APPROVAL"] } } }),
      prisma.task.count({ where: { companyId, status: "WAITING_FOR_PROVIDER_LIMIT", assignee: { providerConnection: { provider: p.provider } } } }),
    ]);
    const usesRunner = !!conn && (conn.authMode === "SUBSCRIPTION_CLI" || conn.mode === "LOCAL_RUNNER");
    const runner = usesRunner ? pickRunner(runners, p.provider, conn.authMode) : null;
    const tool: RunnerToolInfo | null = runner ? (runnerToolFor(runner.capabilities, p.provider) ?? null) : null;

    let status: ProviderUiStatus;
    let detail: string;
    let errorKind: ProviderErrorKind | undefined;
    const avail = availabilityOf(limit, now);
    if (!conn) {
      status = "DISCONNECTED";
      detail = `${p.displayName} is not connected. Connect it on the Integrations page.`;
    } else if (limit?.kind === "AUTH_EXPIRED") {
      status = "AUTHENTICATION_EXPIRED";
      errorKind = "AUTH_EXPIRED";
      detail = conn.authMode === "SUBSCRIPTION_CLI" ? `Sign in again on your machine: ${p.signIn}.` : "The provider rejected the API key. Update or re-verify it.";
    } else if (!avail.available && (limit?.kind === "USAGE_LIMIT" || limit?.kind === "RATE_LIMITED")) {
      status = waitingTasks > 0 ? "WAITING_FOR_RESET" : "USAGE_LIMIT_REACHED";
      errorKind = limit.kind === "USAGE_LIMIT" ? "USAGE_LIMIT" : "RATE_LIMIT";
      const when = limit.resetAt ?? limit.retryAfterAt;
      const whenText = when ? (limit.resetAt && limit.source === "provider_reported" ? `resets at ${when.toISOString()} (reported by the provider)` : `next retry after ${when.toISOString()}`) : "reset time not reported by the provider";
      detail = `${limit.kind === "USAGE_LIMIT" ? "Usage limit reached" : "Rate limited"}; ${whenText}.${waitingTasks ? ` ${waitingTasks} task(s) will resume automatically.` : ""}`;
    } else if (conn.status === "INVALID") {
      status = "AUTHENTICATION_EXPIRED";
      errorKind = "AUTH_EXPIRED";
      detail = conn.verifyError ?? "The connection failed verification.";
    } else if (usesRunner && (!runner || runner.status !== "ONLINE")) {
      status = "RUNNER_OFFLINE";
      errorKind = "RUNNER_OFFLINE";
      detail = runner ? `Runner "${runner.name}" is offline. Start the local runner on your machine.` : "No local runner is registered. Create one and start it on your machine.";
    } else if (usesRunner && conn.authMode === "SUBSCRIPTION_CLI" && !runnerCanExecute(runner!.capabilities, p.provider, conn.authMode) && (runner!.capabilities as { auth?: string } | null)?.auth === "env") {
      status = "UNSUPPORTED";
      errorKind = "UNSUPPORTED";
      detail = `Runner "${runner!.name}" uses API keys from its environment (--auth env). Subscription connection: start the runner with --auth subscription.`;
    } else if (usesRunner && tool && !tool.installed) {
      status = "UNSUPPORTED";
      errorKind = "UNSUPPORTED";
      detail = tool.reason ?? `${p.tool} is not installed on the runner machine.`;
    } else if (usesRunner && tool && tool.auth === "not_logged_in") {
      status = "AUTHENTICATION_EXPIRED";
      errorKind = "AUTH_EXPIRED";
      detail = `${p.tool} is not signed in on the runner machine: ${p.signIn}.`;
    } else if (usesRunner && tool && !tool.executionAvailable) {
      status = "UNSUPPORTED";
      errorKind = "UNSUPPORTED";
      detail = tool.reason ?? `The runner cannot execute ${p.tool} in its current mode.`;
    } else if (activeExecutions > 0) {
      status = "RUNNING";
      detail = `${activeExecutions} execution(s) running.`;
    } else if (conn.authMode === "SUBSCRIPTION_CLI") {
      status = "READY";
      detail = tool ? `Ready: ${p.tool}${tool.version ? ` ${tool.version}` : ""} on "${runner!.name}" with your own sign-in.` : `Ready on runner "${runner!.name}".`;
    } else {
      status = "CONNECTED";
      detail = conn.status === "VERIFIED" ? "API key verified (billed separately by the provider)." : "API key saved but not verified yet (billed separately by the provider).";
    }

    const authMethodLabel = !conn
      ? "Not connected"
      : conn.authMode === "API_KEY"
        ? "API key (billed separately)"
        : `Your ${p.provider === "ANTHROPIC" ? "Claude" : "ChatGPT"} plan via ${p.tool} on your machine${tool?.authMethod ? ` (${tool.authMethod})` : ""}`;

    out.push({
      provider: p.provider,
      displayName: p.displayName,
      status,
      statusLabel: PROVIDER_UI_STATUS_LABEL[status],
      detail,
      authMode: conn?.authMode ?? null,
      authMethodLabel,
      connectionId: conn?.id ?? null,
      runner: runner ? { id: runner.id, name: runner.name, status: runner.status, lastSeenAt: runner.lastSeenAt?.toISOString() ?? null, tool } : null,
      limit: limitView(limit),
      activeExecutions,
      waitingTasks,
      usage:
        limit && typeof limit.utilization === "number"
          ? { kind: "reported", utilization: limit.utilization, windowLabel: limit.windowLabel ?? undefined, resetAt: limit.resetAt?.toISOString() }
          : { kind: "unavailable", note: "Usage details unavailable from provider." },
      ...(errorKind ? { errorKind } : {}),
    });
  }
  return out;
}
