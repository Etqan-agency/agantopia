import { describe, expect, it } from "vitest";
import { classifyProviderError, epochToDate, isLimitErrorKind } from "../classify";

const NOW = new Date("2026-11-02T10:00:00.000Z");

describe("classifyProviderError: Claude", () => {
  it("rate_limit_event rejected → USAGE_LIMIT, provider_reported, resetAt from resetsAt (epoch seconds)", () => {
    const resetsAt = Math.floor(new Date("2026-11-02T15:00:00Z").getTime() / 1000);
    const c = classifyProviderError("ANTHROPIC", { rateLimitInfo: { status: "rejected", resetsAt, rateLimitType: "five_hour", utilization: 1 } }, NOW);
    expect(c).toMatchObject({ kind: "USAGE_LIMIT", source: "provider_reported", utilization: 1, windowLabel: "5-hour window" });
    expect(c.resetAt?.toISOString()).toBe("2026-11-02T15:00:00.000Z");
    expect(c.retryAfterAt).toBeUndefined();
  });

  it("accepts resetsAt in milliseconds too", () => {
    const ms = new Date("2026-11-09T00:00:00Z").getTime();
    expect(epochToDate(ms)?.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(epochToDate(ms / 1000)?.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(epochToDate("nope")).toBeUndefined();
  });

  it("rate_limit_event rejected without resetsAt never invents a reset", () => {
    const c = classifyProviderError("ANTHROPIC", { rateLimitInfo: { status: "rejected", rateLimitType: "seven_day" } }, NOW);
    expect(c.kind).toBe("USAGE_LIMIT");
    expect(c.resetAt).toBeUndefined();
    expect(c.retryAfterAt).toBeUndefined();
  });

  it("allowed_warning is not a limit", () => {
    expect(classifyProviderError("ANTHROPIC", { rateLimitInfo: { status: "allowed_warning", utilization: 0.85 } }, NOW).kind).toBe("OTHER");
  });

  it("api_retry rate_limit → RATE_LIMIT with retry delay", () => {
    const c = classifyProviderError("ANTHROPIC", { code: "rate_limit", retryAfterSec: 30 }, NOW);
    expect(c).toMatchObject({ kind: "RATE_LIMIT", source: "provider_reported" });
    expect(c.retryAfterAt?.toISOString()).toBe("2026-11-02T10:00:30.000Z");
    expect(c.resetAt).toBeUndefined();
  });

  it("authentication_failed / Not logged in / Invalid API key → AUTH_EXPIRED", () => {
    expect(classifyProviderError("ANTHROPIC", { code: "authentication_failed" }).kind).toBe("AUTH_EXPIRED");
    expect(classifyProviderError("ANTHROPIC", { text: "Not logged in · Please run /login" }).kind).toBe("AUTH_EXPIRED");
    expect(classifyProviderError("ANTHROPIC", { text: "Invalid API key · Please run /login" }).kind).toBe("AUTH_EXPIRED");
    expect(classifyProviderError("ANTHROPIC", { text: "OAuth token has expired. Please obtain a new token or refresh your existing token." }).kind).toBe("AUTH_EXPIRED");
  });

  it("legacy usage-limit result text with a printed epoch → USAGE_LIMIT with that reset", () => {
    const c = classifyProviderError("ANTHROPIC", { text: "Claude AI usage limit reached|1762106400" }, NOW);
    expect(c.kind).toBe("USAGE_LIMIT");
    expect(c.source).toBe("provider_reported");
    expect(c.resetAt?.toISOString()).toBe(new Date(1762106400 * 1000).toISOString());
    expect(c.message).not.toContain("|");
  });

  it("You've hit your limit text → USAGE_LIMIT without an invented time", () => {
    const c = classifyProviderError("ANTHROPIC", { text: "You've hit your limit · resets 3pm (Africa/Cairo)" }, NOW);
    expect(c).toMatchObject({ kind: "USAGE_LIMIT", source: "classified" });
    expect(c.resetAt).toBeUndefined();
    expect(c.retryAfterAt).toBeUndefined();
  });

  it("generic errors → OTHER", () => {
    expect(classifyProviderError("ANTHROPIC", { text: "TypeError: cannot read properties of undefined" }).kind).toBe("OTHER");
    expect(classifyProviderError("ANTHROPIC", { text: "Stopped: maximum turns reached" }).kind).toBe("OTHER");
  });
});

describe("classifyProviderError: Codex", () => {
  it("usage limit phrases → USAGE_LIMIT", () => {
    expect(classifyProviderError("OPENAI", { text: "You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing) or try again later." }).kind).toBe("USAGE_LIMIT");
    expect(classifyProviderError("OPENAI", { text: "stream error: exceeded retry limit, last status: 429 Too Many Requests; usage limit reached" }).kind).toBe("USAGE_LIMIT");
    expect(classifyProviderError("OPENAI", { text: "You exceeded your current quota, please check your plan and billing details." }).kind).toBe("USAGE_LIMIT");
  });

  it("429 / rate limit / Retry-After → RATE_LIMIT with parsed seconds", () => {
    const c = classifyProviderError("OPENAI", { text: "unexpected status 429 Too Many Requests: Rate limit reached for gpt-5-codex. Retry-After: 30" }, NOW);
    expect(c.kind).toBe("RATE_LIMIT");
    expect(c.retryAfterAt?.toISOString()).toBe("2026-11-02T10:00:30.000Z");
    expect(c.source).toBe("provider_reported");
    const d = classifyProviderError("OPENAI", { text: "Rate limit reached. Please try again in 2m" }, NOW);
    expect(d.kind).toBe("RATE_LIMIT");
    expect(d.retryAfterAt?.toISOString()).toBe("2026-11-02T10:02:00.000Z");
    const e = classifyProviderError("OPENAI", { text: "429 Too Many Requests" }, NOW);
    expect(e).toMatchObject({ kind: "RATE_LIMIT", source: "classified" });
    expect(e.retryAfterAt).toBeUndefined();
  });

  it("not logged in / 401 / unauthorized → AUTH_EXPIRED", () => {
    expect(classifyProviderError("OPENAI", { text: "Not logged in. Run `codex login`." }).kind).toBe("AUTH_EXPIRED");
    expect(classifyProviderError("OPENAI", { text: "unexpected status 401 Unauthorized: Your authentication token has expired. Please try signing in again." }).kind).toBe("AUTH_EXPIRED");
    expect(classifyProviderError("OPENAI", { httpStatus: 401 }).kind).toBe("AUTH_EXPIRED");
  });

  it("isLimitErrorKind", () => {
    expect(isLimitErrorKind("USAGE_LIMIT")).toBe(true);
    expect(isLimitErrorKind("AUTH_EXPIRED")).toBe(true);
    expect(isLimitErrorKind("RUNNER_OFFLINE")).toBe(false);
    expect(isLimitErrorKind(undefined)).toBe(false);
  });
});
