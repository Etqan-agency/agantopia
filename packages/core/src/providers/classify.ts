/**
 * Pure provider-error classification for the Usage Limit Manager
 * (docs/integrations-research.md §7). No I/O, no database: safe to import from
 * the local runner. Reset times are only ever taken from provider data
 * (Claude `rate_limit_event.resetsAt`, a provider-printed epoch, an explicit
 * `resetAt`); a Retry-After / retry delay becomes `retryAfterAt`. Nothing is
 * invented: when the provider gives no time, both stay undefined and the
 * manager applies its bounded backoff.
 */
import type { ProviderErrorKind } from "@agentopia/shared";

export type ClassifyProvider = "ANTHROPIC" | "OPENAI" | "SIMULATED";

export interface ClassifyInput {
  text?: string;
  /** Machine code, e.g. Claude `api_retry.error` ("rate_limit", "authentication_failed", …) or an HTTP-ish code. */
  code?: string;
  httpStatus?: number;
  /** Seconds from a Retry-After header / retry delay reported by the provider. */
  retryAfterSec?: number;
  /** Provider-reported reset time. */
  resetAt?: Date;
  /** Claude `rate_limit_event.rate_limit_info`. */
  rateLimitInfo?: unknown;
}

export interface ClassifiedProviderError {
  kind: ProviderErrorKind;
  message: string;
  retryAfterAt?: Date;
  resetAt?: Date;
  source: "provider_reported" | "classified";
  /** Provider-reported utilization (0..1) and window, when present (Claude rate_limit_info). */
  utilization?: number;
  windowLabel?: string;
}

/** Kinds that park a task in WAITING_FOR_PROVIDER_LIMIT (no attempt consumed). */
export const LIMIT_ERROR_KINDS: readonly ProviderErrorKind[] = ["USAGE_LIMIT", "RATE_LIMIT", "AUTH_EXPIRED"];

export function isLimitErrorKind(k: ProviderErrorKind | null | undefined): k is "USAGE_LIMIT" | "RATE_LIMIT" | "AUTH_EXPIRED" {
  return !!k && LIMIT_ERROR_KINDS.includes(k);
}

/** Epoch seconds or milliseconds → Date (values below 1e12 are seconds). Invalid → undefined. */
export function epochToDate(v: unknown): Date | undefined {
  const n = typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  const d = new Date(n < 1e12 ? n * 1000 : n);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type RateLimitInfo = { status?: string; resetsAt?: unknown; rateLimitType?: string; utilization?: unknown; overageStatus?: string; isUsingOverage?: boolean };

function asRateLimitInfo(v: unknown): RateLimitInfo | null {
  if (!v || typeof v !== "object") return null;
  return v as RateLimitInfo;
}

const WINDOW_LABEL: Record<string, string> = { five_hour: "5-hour window", seven_day: "weekly window", seven_day_opus: "weekly Opus window", seven_day_sonnet: "weekly Sonnet window" };

/** Human label for a Claude `rateLimitType` (falls back to the raw value). */
export function windowLabelFor(type: string | undefined): string | undefined {
  if (!type) return undefined;
  return WINDOW_LABEL[type] ?? type.replace(/_/g, " ");
}

const RE = {
  usage: /(usage limit|hit your (usage )?limit|you.ve hit your limit|quota|insufficient_quota|exceeded your current quota|out of (credits|usage)|plan limit|weekly limit|5-hour limit|credit balance is too low|billing_error)/i,
  rate: /(\b429\b|rate[ _-]?limit|too many requests|retry-after|overloaded|\b529\b)/i,
  auth: /(not logged in|please run \/login|\/login|login required|invalid api key|invalid x-api-key|authentication[_ ]failed|\b401\b|unauthori[sz]ed|token (has )?expired|oauth token|session expired|re-?authenticate|codex login|sign in again|account_on_hold|oauth_org_not_allowed)/i,
  retryAfter: /retry[- ]after[:= ]\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seconds)?/i,
  tryAgainIn: /try again in\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seconds|m|min|mins|minutes|h|hours?)\b/i,
  /** Legacy Claude Code result text: "Claude AI usage limit reached|1761300000" (epoch printed by the CLI). */
  pipeEpoch: /limit reached\|(\d{10,13})/i,
};

function secondsFromTryAgain(n: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "ms") return n / 1000;
  if (u.startsWith("h")) return n * 3600;
  if (u === "m" || u.startsWith("min")) return n * 60;
  return n;
}

function firstLine(s: string, max = 300): string {
  const t = s.trim().split(/\r?\n/).find((l) => l.trim()) ?? s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Classifies a provider error / signal into a ProviderErrorKind.
 *  - Claude `rate_limit_event` with status "rejected" → USAGE_LIMIT, provider_reported, resetAt from `resetsAt`.
 *  - Claude `api_retry` code "rate_limit" → RATE_LIMIT (retryAfterSec from retry_delay_ms); "authentication_failed" → AUTH_EXPIRED.
 *  - Text: usage-limit phrases → USAGE_LIMIT; 429 / rate limit / Retry-After → RATE_LIMIT; not logged in / 401 / unauthorized → AUTH_EXPIRED.
 *  - Anything else → OTHER.
 */
export function classifyProviderError(provider: ClassifyProvider, input: ClassifyInput, now: Date = new Date()): ClassifiedProviderError {
  const text = (input.text ?? "").trim();
  const code = (input.code ?? "").trim().toLowerCase();
  const pname = provider === "ANTHROPIC" ? "Claude" : provider === "OPENAI" ? "Codex" : "Provider";
  let retryAfterAt = typeof input.retryAfterSec === "number" && input.retryAfterSec > 0 ? new Date(now.getTime() + input.retryAfterSec * 1000) : undefined;
  let resetAt = input.resetAt && !Number.isNaN(input.resetAt.getTime()) ? input.resetAt : undefined;
  let source: ClassifiedProviderError["source"] = resetAt || retryAfterAt ? "provider_reported" : "classified";

  // 1) Structured Claude rate-limit info (the official subscription-limit signal).
  const info = asRateLimitInfo(input.rateLimitInfo);
  if (info) {
    const infoReset = epochToDate(info.resetsAt);
    const utilization = typeof info.utilization === "number" && Number.isFinite(info.utilization) ? info.utilization : undefined;
    const windowLabel = windowLabelFor(info.rateLimitType);
    if (info.status === "rejected") {
      const when = infoReset ?? resetAt;
      return {
        kind: "USAGE_LIMIT",
        message: text || `${pname} subscription usage limit reached${windowLabel ? ` (${windowLabel})` : ""}`,
        resetAt: when,
        retryAfterAt,
        source: "provider_reported",
        utilization,
        windowLabel,
      };
    }
  }

  // 2) Machine codes.
  if (code) {
    if (code === "rate_limit" || code === "rate_limit_error" || code === "429") {
      return { kind: "RATE_LIMIT", message: text || `${pname} rate limit (provider is throttling requests)`, retryAfterAt, resetAt, source };
    }
    if (code === "authentication_failed" || code === "authentication_error" || code === "oauth_org_not_allowed" || code === "account_on_hold" || code === "401") {
      return { kind: "AUTH_EXPIRED", message: text || `${pname} sign-in is missing or expired (${code})`, retryAfterAt: undefined, resetAt: undefined, source: "provider_reported" };
    }
    if (code === "billing_error" || code === "usage_limit" || code === "insufficient_quota") {
      return { kind: "USAGE_LIMIT", message: text || `${pname} usage limit or billing limit reached (${code})`, retryAfterAt, resetAt, source };
    }
  }
  if (input.httpStatus === 401 || input.httpStatus === 403) {
    if (!RE.usage.test(text)) return { kind: "AUTH_EXPIRED", message: text ? firstLine(text) : `${pname} rejected the credentials (HTTP ${input.httpStatus})`, source: "provider_reported" };
  }

  if (!text && input.httpStatus === 429) return { kind: "RATE_LIMIT", message: `${pname} rate limit (HTTP 429)`, retryAfterAt, resetAt, source };
  if (!text) return { kind: "OTHER", message: `${pname} error`, retryAfterAt, resetAt, source };

  // 3) Text classification. Times only when the provider printed them.
  const pipe = RE.pipeEpoch.exec(text);
  if (pipe && !resetAt) {
    resetAt = epochToDate(pipe[1]);
    if (resetAt) source = "provider_reported";
  }
  if (!retryAfterAt) {
    const ra = RE.retryAfter.exec(text);
    const ta = ra ? null : RE.tryAgainIn.exec(text);
    const secs = ra ? (ra[2]?.toLowerCase() === "ms" ? Number(ra[1]) / 1000 : Number(ra[1])) : ta ? secondsFromTryAgain(Number(ta[1]), ta[2]!) : NaN;
    if (Number.isFinite(secs) && secs > 0) {
      retryAfterAt = new Date(now.getTime() + secs * 1000);
      source = "provider_reported";
    }
  }
  const message = firstLine(text.replace(RE.pipeEpoch, "limit reached"));
  if (RE.auth.test(text) && !RE.usage.test(text)) return { kind: "AUTH_EXPIRED", message, source: "provider_reported" };
  if (RE.usage.test(text)) return { kind: "USAGE_LIMIT", message, retryAfterAt, resetAt, source };
  if (RE.rate.test(text) || input.httpStatus === 429) return { kind: "RATE_LIMIT", message, retryAfterAt, resetAt, source };
  return { kind: "OTHER", message, retryAfterAt, resetAt, source };
}
