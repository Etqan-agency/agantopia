import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Options, PermissionResult, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ThreadEvent } from "@openai/codex-sdk";
import { ProviderSettingsSchema } from "@agentopia/shared";
import { createAnthropicAdapter, type QueryFn } from "../anthropic";
import { createCodexAdapter, type CodexLike } from "../openai-codex";
import { createSimulatedAdapter } from "../simulated";
import type { ExecutionHooks, ExecutionRequest, ProviderEvent, UsageReport } from "../types";

function makeReq(over: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    executionSessionId: "es1",
    companyId: "c1",
    taskId: "t1",
    employeeId: "e1",
    systemPrompt: "SYSTEM",
    taskBrief: "Build the thing",
    memoryContext: "",
    workspacePath: mkdtempSync(path.join(tmpdir(), "agentopia-adapter-")),
    settings: ProviderSettingsSchema.parse({}),
    signal: new AbortController().signal,
    ...over,
  };
}

function makeHooks(decide: (kind: string) => boolean = () => true) {
  const events: ProviderEvent[] = [];
  const usages: UsageReport[] = [];
  const approvals: Array<{ kind: string; title: string }> = [];
  const hooks: ExecutionHooks = {
    onEvent: (e) => void events.push(e),
    onUsage: (u) => void usages.push(u),
    requestApproval: async (r) => {
      approvals.push({ kind: r.kind, title: r.title });
      return { approved: decide(r.kind), note: decide(r.kind) ? undefined : "no" };
    },
  };
  return { hooks, events, usages, approvals };
}

// Recorded (trimmed) Agent SDK message sequence. Casts: fixtures only carry the fields the adapter reads.
const RECORDED: SDKMessage[] = [
  { type: "system", subtype: "init", session_id: "sess-123", model: "claude-opus-5-5", cwd: "/w", tools: [], mcp_servers: [], apiKeySource: "ANTHROPIC_API_KEY", permissionMode: "acceptEdits", slash_commands: [], claude_code_version: "x", uuid: "u0" } as unknown as SDKMessage,
  { type: "assistant", session_id: "sess-123", parent_tool_use_id: null, uuid: "u1", message: { content: [{ type: "text", text: "I'll inspect the repo." }, { type: "tool_use", id: "tu1", name: "Bash", input: { command: "rm -rf build" } }] } } as unknown as SDKMessage,
  { type: "user", session_id: "sess-123", parent_tool_use_id: null, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "Denied by the owner", is_error: true }] } } as unknown as SDKMessage,
  { type: "assistant", session_id: "sess-123", parent_tool_use_id: null, uuid: "u2", message: { content: [{ type: "text", text: "Done: updated README." }] } } as unknown as SDKMessage,
  { type: "result", subtype: "success", is_error: false, result: "Done: updated README.", num_turns: 3, session_id: "sess-123", total_cost_usd: 0.0123, duration_ms: 1, duration_api_ms: 1, stop_reason: "end_turn", permission_denials: [], modelUsage: {}, uuid: "u3", usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 } } as unknown as SDKMessage,
];

describe("anthropic adapter (contract, recorded stream)", () => {
  it("maps messages, tool use, usage, and routes canUseTool through approvals", async () => {
    let seenOptions: Options | undefined;
    const permission: Array<PermissionResult | null> = [];
    const queryImpl: QueryFn = (params) => {
      seenOptions = params.options;
      return (async function* () {
        yield RECORDED[0]!;
        permission.push(await params.options!.canUseTool!("Bash", { command: "rm -rf build" }, { signal: new AbortController().signal, toolUseID: "tu1" } as never));
        permission.push(await params.options!.canUseTool!("Edit", { file_path: "README.md" }, { signal: new AbortController().signal, toolUseID: "tu2" } as never));
        for (const m of RECORDED.slice(1)) yield m;
      })();
    };
    const adapter = createAnthropicAdapter({ queryImpl });
    const { hooks, events, usages, approvals } = makeHooks((k) => k !== "DESTRUCTIVE");
    const res = await adapter.run(makeReq({ secret: "sk-ant-test", resumeSessionId: "prev", settings: ProviderSettingsSchema.parse({ reasoning: "low" }) }), hooks);

    expect(seenOptions?.permissionMode).toBe("acceptEdits");
    expect(seenOptions?.permissionMode).not.toBe("bypassPermissions");
    expect(seenOptions?.settingSources).toEqual([]);
    expect(seenOptions?.resume).toBe("prev");
    expect(seenOptions?.effort).toBe("low");
    expect(seenOptions?.env?.ANTHROPIC_API_KEY).toBe("sk-ant-test");
    expect(seenOptions?.maxBudgetUsd).toBe(1);

    expect(approvals.map((a) => a.kind)).toEqual(["DESTRUCTIVE", "TOOL_USE"]);
    expect(permission[0]).toMatchObject({ behavior: "deny" });
    expect(permission[1]).toEqual({ behavior: "allow", updatedInput: { file_path: "README.md" } });

    expect(events.map((e) => e.type)).toEqual(["session", "message", "tool_use", "tool_result", "message"]);
    expect(events[3]).toMatchObject({ tool: "Bash", isError: true });
    expect(usages).toHaveLength(1);
    expect(res.usage).toMatchObject({ inputTokens: 1000, outputTokens: 200, cacheReadTokens: 50, cacheWriteTokens: 10, costUsd: 0.0123, costSource: "provider_reported", model: "claude-opus-5-5" });
    expect(res.status).toBe("SUCCEEDED");
    expect(res.providerSessionId).toBe("sess-123");
    expect(res.numTurns).toBe(3);
    expect(res.artifacts[0]).toMatchObject({ name: "summary.md", kind: "TEXT", content: "Done: updated README." });
  });

  it("does not set ANTHROPIC_API_KEY when no secret is given, and maps error results to FAILED", async () => {
    let env: Options["env"];
    const queryImpl: QueryFn = (params) => {
      env = params.options?.env;
      return (async function* () {
        yield { ...(RECORDED[4] as object), subtype: "error_max_budget_usd", is_error: true, errors: [] } as unknown as SDKMessage;
      })();
    };
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await createAnthropicAdapter({ queryImpl }).run(makeReq(), makeHooks().hooks);
    process.env.ANTHROPIC_API_KEY = prev;
    expect(env && "ANTHROPIC_API_KEY" in env && env.ANTHROPIC_API_KEY).toBeFalsy();
    expect(res.status).toBe("FAILED");
    expect(res.error).toMatch(/budget/);
  });

  it("verify maps auth errors to INVALID and lists models otherwise", async () => {
    const ok = createAnthropicAdapter({ clientFactory: () => ({ models: { list: async () => ({ data: [{ id: "claude-opus-5-5" }] }) } }) });
    expect(await ok.verify("k")).toEqual({ ok: true, status: "VERIFIED", models: ["claude-opus-5-5"] });
    const bad = createAnthropicAdapter({ clientFactory: () => ({ models: { list: async () => { throw Object.assign(new Error("401"), { status: 401 }); } } }) });
    expect(await bad.verify("k")).toMatchObject({ ok: false, status: "INVALID" });
  });
});

const CODEX_EVENTS: ThreadEvent[] = [
  { type: "thread.started", thread_id: "th-1" },
  { type: "turn.started" },
  { type: "item.completed", item: { id: "r1", type: "reasoning", text: "Plan the change" } },
  { type: "item.completed", item: { id: "c1", type: "command_execution", command: "ls", aggregated_output: "README.md", exit_code: 0, status: "completed" } },
  { type: "item.completed", item: { id: "f1", type: "file_change", changes: [{ path: "README.md", kind: "update" }], status: "completed" } },
  { type: "item.completed", item: { id: "m1", type: "agent_message", text: "Updated README." } },
  { type: "turn.completed", usage: { input_tokens: 2000, cached_input_tokens: 500, cache_write_input_tokens: 0, output_tokens: 300, reasoning_output_tokens: 100 } },
];

function fakeCodex(events: ThreadEvent[], seen: { options?: unknown; thread?: unknown; signal?: AbortSignal }): (o: unknown) => CodexLike {
  return (options) => {
    seen.options = options;
    const thread = {
      id: "th-1",
      async runStreamed(_input: string, turn?: { signal?: AbortSignal }) {
        seen.signal = turn?.signal;
        return { events: (async function* () { for (const e of events) yield e; })() };
      },
    };
    return {
      startThread: (o) => ((seen.thread = o), thread),
      resumeThread: (_id, o) => ((seen.thread = o), thread),
    };
  };
}

describe("codex adapter (contract, recorded stream)", () => {
  it("maps thread events, estimates usage, asks once for edit approval", async () => {
    const seen: { options?: unknown; thread?: unknown; signal?: AbortSignal } = {};
    const adapter = createCodexAdapter({ codexFactory: fakeCodex(CODEX_EVENTS, seen) });
    const { hooks, events, approvals } = makeHooks();
    const req = makeReq({ secret: "sk-openai", model: "gpt-5-codex", settings: ProviderSettingsSchema.parse({ permissionMode: "default", reasoning: "high" }) });
    const res = await adapter.run(req, hooks);
    expect(approvals).toEqual([{ kind: "TOOL_USE", title: "Allow Codex to edit the workspace" }]);
    expect(seen.thread).toMatchObject({ approvalPolicy: "never", networkAccessEnabled: false, skipGitRepoCheck: true, sandboxMode: "workspace-write", modelReasoningEffort: "high", workingDirectory: req.workspacePath });
    expect((seen.options as { apiKey?: string }).apiKey).toBe("sk-openai");
    expect(seen.signal).toBe(req.signal);
    expect(events.map((e) => e.type)).toEqual(["session", "progress", "tool_use", "tool_result", "tool_use", "message"]);
    expect(res.status).toBe("SUCCEEDED");
    expect(res.providerSessionId).toBe("th-1");
    expect(res.usage.costSource).toBe("estimated");
    // (1500*1.25 + 500*0.125 + 300*10) / 1e6
    expect(res.usage.costUsd).toBeCloseTo(0.0049375, 5);
  });

  it("unknown model → cost unavailable; error event → FAILED; denial short-circuits", async () => {
    const seen = {};
    const res = await createCodexAdapter({ codexFactory: fakeCodex([...CODEX_EVENTS.slice(0, 2), CODEX_EVENTS[6]!, { type: "error", message: "boom" }], seen) }).run(
      makeReq({ model: "mystery-model" }),
      makeHooks().hooks,
    );
    expect(res.usage).toMatchObject({ costUsd: null, costSource: "unavailable" });
    expect(res.status).toBe("FAILED");
    expect(res.error).toBe("boom");

    const denied = await createCodexAdapter({ codexFactory: fakeCodex(CODEX_EVENTS, {}) }).run(
      makeReq({ settings: ProviderSettingsSchema.parse({ permissionMode: "default" }) }),
      makeHooks(() => false).hooks,
    );
    expect(denied.status).toBe("FAILED");
    expect(denied.error).toMatch(/denied/i);
  });
});

describe("simulated adapter", () => {
  it("is clearly labelled, zero-usage, and honours markers and abort", async () => {
    const a = createSimulatedAdapter({ stepDelayMs: 1 });
    const ok = await a.run(makeReq(), makeHooks().hooks);
    expect(ok.status).toBe("SUCCEEDED");
    expect(ok.summary.startsWith("Simulated run (no provider was called)")).toBe(true);
    expect(ok.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, costUsd: null, costSource: "unavailable" });
    expect(ok.artifacts[0]?.kind).toBe("TEXT");

    expect((await a.run(makeReq({ taskBrief: "x [simulate:fail]" }), makeHooks().hooks)).status).toBe("FAILED");
    const h = makeHooks(() => false);
    const blocked = await a.run(makeReq({ taskBrief: "x [simulate:block]" }), h.hooks);
    expect(h.approvals).toHaveLength(1);
    expect(blocked.status).toBe("FAILED");

    const ac = new AbortController();
    const slow = createSimulatedAdapter({ stepDelayMs: 200 }).run(makeReq({ signal: ac.signal }), makeHooks().hooks);
    setTimeout(() => ac.abort("timeout"), 20);
    expect((await slow).status).toBe("TIMED_OUT");
  });
});
