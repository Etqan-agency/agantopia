import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CodexOptions, ThreadEvent } from "@openai/codex-sdk";
import { ProviderSettingsSchema } from "@agentopia/shared";
import { codexUsage, createCodexAdapter, type CodexLike } from "../openai-codex";
import type { ExecutionHooks, ExecutionRequest } from "../types";

function fakeCodex(events: ThreadEvent[], seen: { options?: CodexOptions }): (o: CodexOptions) => CodexLike {
  return (options) => {
    seen.options = options;
    const thread = {
      id: "th-1",
      async runStreamed() {
        return { events: (async function* () { for (const e of events) yield e; })() };
      },
    };
    return { startThread: () => thread, resumeThread: () => thread };
  };
}

const hooks: ExecutionHooks = { onEvent: () => undefined, onUsage: () => undefined, requestApproval: async () => ({ approved: true }) };

function req(over: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    executionSessionId: "es1",
    companyId: "c1",
    taskId: "t1",
    employeeId: "e1",
    systemPrompt: "S",
    taskBrief: "B",
    memoryContext: "",
    workspacePath: mkdtempSync(path.join(tmpdir(), "agentopia-codex-")),
    settings: ProviderSettingsSchema.parse({}),
    signal: new AbortController().signal,
    ...over,
  };
}

const START: ThreadEvent[] = [{ type: "thread.started", thread_id: "th-1" }, { type: "turn.started" }];
const saved = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, CODEX_API_KEY: process.env.CODEX_API_KEY };
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("codex adapter: subscription mode (user's own `codex login`)", () => {
  it("injects no key, strips OPENAI_API_KEY / CODEX_API_KEY, uses the detected binary", async () => {
    process.env.OPENAI_API_KEY = "sk-should-not-leak";
    process.env.CODEX_API_KEY = "sk-should-not-leak-2";
    const seen: { options?: CodexOptions } = {};
    const events: ThreadEvent[] = [...START, { type: "item.completed", item: { id: "m1", type: "agent_message", text: "ok" } }, { type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 } as never }];
    const r = await createCodexAdapter({ codexFactory: fakeCodex(events, seen) }).run(req({ authMode: "SUBSCRIPTION_CLI", binaryPath: "/opt/homebrew/bin/codex" }), hooks);
    expect(r.status).toBe("SUCCEEDED");
    expect(seen.options?.apiKey).toBeUndefined();
    expect(seen.options?.codexPathOverride).toBe("/opt/homebrew/bin/codex");
    expect(seen.options?.env?.OPENAI_API_KEY).toBeUndefined();
    expect(seen.options?.env?.CODEX_API_KEY).toBeUndefined();
    expect(seen.options?.env?.PATH).toBe(process.env.PATH);
  });

  it("subscription runs record tokens but no cost (plans are not billed per token); API-key runs keep the estimate", async () => {
    const usage = { input_tokens: 1000, cached_input_tokens: 100, output_tokens: 500 } as never;
    const events: ThreadEvent[] = [...START, { type: "turn.completed", usage }, { type: "turn.completed", usage }];
    const seenUsage: Array<{ costUsd: number | null; costSource: string }> = [];
    const h: ExecutionHooks = { ...hooks, onUsage: (u) => void seenUsage.push(u) };
    const sub = await createCodexAdapter({ codexFactory: fakeCodex(events, {}) }).run(req({ authMode: "SUBSCRIPTION_CLI", model: "gpt-5-codex" }), h);
    expect(sub.usage).toMatchObject({ inputTokens: 2000, outputTokens: 1000, costUsd: null, costSource: "unavailable", tokenSource: "provider_reported" });
    expect(seenUsage.every((u) => u.costUsd === null && u.costSource === "unavailable")).toBe(true);
    expect(codexUsage({ input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 }, "gpt-5-codex", "subscription")).toMatchObject({ costUsd: null, costSource: "unavailable" });
    const api = codexUsage({ input_tokens: 1000, cached_input_tokens: 0, output_tokens: 500 }, "gpt-5-codex", "api");
    if (api.costUsd !== null) expect(api.costSource).toBe("estimated");
  });

  it("truncates long agent messages and todo progress to the wire limits", async () => {
    const events: ThreadEvent[] = [
      ...START,
      { type: "item.completed", item: { id: "m1", type: "agent_message", text: "z".repeat(30_000) } },
      { type: "item.completed", item: { id: "t1", type: "todo_list", items: Array.from({ length: 500 }, (_, i) => ({ text: `step ${i} ${"w".repeat(20)}`, completed: false })) } } as ThreadEvent,
    ];
    const seen: Array<{ type: string; text?: string }> = [];
    await createCodexAdapter({ codexFactory: fakeCodex(events, {}) }).run(req({ authMode: "SUBSCRIPTION_CLI" }), { ...hooks, onEvent: (e) => void seen.push(e as never) });
    expect(seen.find((e) => e.type === "message")!.text!.length).toBeLessThanOrEqual(20_000);
    expect(seen.find((e) => e.type === "progress")!.text!.length).toBeLessThanOrEqual(5_000);
  });

  it("API_KEY mode keeps the existing behaviour (explicit key)", async () => {
    const seen: { options?: CodexOptions } = {};
    await createCodexAdapter({ codexFactory: fakeCodex(START, seen) }).run(req({ authMode: "API_KEY", secret: "sk-explicit" }), hooks);
    expect(seen.options?.apiKey).toBe("sk-explicit");
    expect(seen.options?.codexPathOverride).toBeUndefined();
  });

  it("classifies a usage-limit turn.failed as USAGE_LIMIT", async () => {
    const r = await createCodexAdapter({ codexFactory: fakeCodex([...START, { type: "turn.failed", error: { message: "You've hit your usage limit. Upgrade to Pro or try again later." } }], {}) }).run(req({ authMode: "SUBSCRIPTION_CLI" }), hooks);
    expect(r).toMatchObject({ status: "FAILED", errorKind: "USAGE_LIMIT" });
    expect(r.limit?.resetAt).toBeUndefined();
    expect(r.limit?.source).toBe("classified");
  });

  it("classifies a rate-limit error with Retry-After as RATE_LIMIT", async () => {
    const r = await createCodexAdapter({ codexFactory: fakeCodex([...START, { type: "error", message: "unexpected status 429 Too Many Requests; Retry-After: 45" }], {}) }).run(req({ authMode: "SUBSCRIPTION_CLI" }), hooks);
    expect(r).toMatchObject({ status: "FAILED", errorKind: "RATE_LIMIT" });
    expect(r.limit?.source).toBe("provider_reported");
    expect(new Date(r.limit!.retryAfterAt!).getTime()).toBeGreaterThan(Date.now() + 40_000);
  });

  it("classifies not-logged-in as AUTH_EXPIRED and other failures as OTHER", async () => {
    const a = await createCodexAdapter({ codexFactory: fakeCodex([...START, { type: "turn.failed", error: { message: "Not logged in. Please run `codex login`." } }], {}) }).run(req({ authMode: "SUBSCRIPTION_CLI" }), hooks);
    expect(a).toMatchObject({ status: "FAILED", errorKind: "AUTH_EXPIRED" });
    const b = await createCodexAdapter({ codexFactory: fakeCodex([...START, { type: "turn.failed", error: { message: "sandbox denied write to /etc" } }], {}) }).run(req({ authMode: "SUBSCRIPTION_CLI" }), hooks);
    expect(b).toMatchObject({ status: "FAILED", errorKind: "OTHER", error: "sandbox denied write to /etc" });
  });
});
