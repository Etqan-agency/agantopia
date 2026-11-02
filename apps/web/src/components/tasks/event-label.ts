/** Readable labels for persisted task/office events (EVENT_TYPES in @agentopia/shared). */
export const EVENT_LABEL: Record<string, string> = {
  "task.created": "Task created",
  "task.planned": "Manager planned the work",
  "task.assigned": "Assigned",
  "task.started": "Work started",
  "task.progress": "Progress update",
  "task.waiting_approval": "Waiting for approval",
  "task.waiting_provider_limit": "Waiting for provider limit",
  "task.approval_decided": "Approval decided",
  "task.handoff": "Handed off",
  "task.review_started": "Review started",
  "task.review_decided": "Review decided",
  "task.completed": "Completed",
  "task.failed": "Failed",
  "task.blocked": "Blocked",
  "task.cancelled": "Cancelled",
  "task.retry_scheduled": "Retry scheduled",
  "execution.started": "Execution started",
  "execution.message": "Message",
  "execution.tool_use": "Tool use",
  "execution.usage": "Usage reported",
  "execution.ended": "Execution ended",
  "employee.state": "Employee state changed",
  "employee.hired": "Employee hired",
  "employee.updated": "Employee updated",
  "learning.run_started": "Learning run started",
  "learning.run_ended": "Learning run ended",
  "knowledge.drafted": "Knowledge drafted",
  "knowledge.decided": "Knowledge decided",
  "runner.status": "Runner status",
  "runner.capabilities": "Runner tools detected",
  "provider.limit": "Provider limit reached",
  "provider.limit_cleared": "Provider limit cleared",
  "demo.note": "Demo note",
};

export function eventLabel(type: string) {
  return EVENT_LABEL[type] ?? type;
}

const PROVIDER_NAME: Record<string, string> = { ANTHROPIC: "Claude Code", OPENAI: "OpenAI Codex", anthropic: "Claude Code", openai: "OpenAI Codex" };

export function providerDisplayName(p: unknown): string {
  return (typeof p === "string" && PROVIDER_NAME[p]) || "The provider";
}

function fmt(at: unknown): string | null {
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Reset sentence for limit event payloads; only provider-reported times are called that. */
export function resetSentence(payload: Record<string, unknown>): string {
  const reported = payload.source === "provider_reported";
  const reset = fmt(payload.resetAt);
  const retry = fmt(payload.retryAfterAt);
  if (reset && reported) return `Resets at ${reset} (reported by the provider).`;
  if (retry && reported) return `The provider asked to retry after ${retry}.`;
  return `Reset time not reported by provider.${retry ? ` Agentopia retries automatically after ${retry}.` : ""}`;
}

/** Human sentences for provider-limit events; null for every other type. */
export function limitEventSentence(type: string, payload: Record<string, unknown> | null | undefined): string | null {
  const p = payload ?? {};
  const name = providerDisplayName(p.provider);
  const kind = p.kind ?? p.errorKind;
  const what = kind === "AUTH_EXPIRED" ? "sign-in" : kind === "RATE_LIMITED" || kind === "RATE_LIMIT" ? "rate limit" : "usage limit";
  switch (type) {
    case "task.waiting_provider_limit":
      return kind === "AUTH_EXPIRED"
        ? `Waiting until ${name} is signed in again on your machine.`
        : `Waiting for the ${name} ${what} to reset. ${resetSentence(p)}`;
    case "provider.limit":
      return kind === "AUTH_EXPIRED"
        ? `${name} reported that you are signed out. Tasks wait until you sign in again.`
        : `${name} ${what} reached; tasks are waiting. ${resetSentence(p)}`;
    case "provider.limit_cleared":
      return `${name} is available again; waiting tasks can resume.`;
    default:
      return null;
  }
}

/** Picks the most useful human sentence out of an event payload. */
export function eventDetail(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;
  for (const key of ["message", "summary", "text", "reason", "note", "tool", "decision"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export const COST_SOURCE_LABEL: Record<string, string> = {
  provider_reported: "Provider-reported",
  estimated: "Estimated",
  unavailable: "Unavailable",
};
