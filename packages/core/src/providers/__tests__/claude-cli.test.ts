import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { ProviderSettingsSchema } from "@agentopia/shared";
import { buildClaudeArgs, claudeChildEnv, createClaudeCliAdapter, type ChildLike, type SpawnLike } from "../claude-cli";
import type { ExecutionHooks, ExecutionRequest, ProviderEvent, UsageReport } from "../types";

/** Recorded stream-json shapes from Claude Code 2.0.x headless mode (`claude -p --output-format stream-json --verbose`). */
const INIT = { type: "system", subtype: "init", session_id: "sess-1", model: "claude-sonnet-4-5", apiKeySource: "none", tools: ["Read", "Edit"], cwd: "/w", permissionMode: "acceptEdits" };
const ASSISTANT_TOOL = { type: "assistant", session_id: "sess-1", message: { content: [{ type: "text", text: "Reading the file." }, { type: "tool_use", id: "tu1", name: "Read", input: { file_path: "a.ts" } }] } };
const USER_RESULT = { type: "user", session_id: "sess-1", message: { content: [{ type: "tool_result", tool_use_id: "tu1", content: "export const a = 1;", is_error: false }] } };
const ASSISTANT_DONE = { type: "assistant", session_id: "sess-1", message: { content: [{ type: "text", text: "Done: added the form." }] } };
const RESULT_OK = {
  type: "result",
  subtype: "success",
  is_error: false,
  result: "Done: added the form.",
  session_id: "sess-1",
  num_turns: 3,
  total_cost_usd: 0.0123,
  usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 },
};

type Script = {
  lines: unknown[];
  stderr?: string;
  /** Exit code when the script finishes on its own. */
  code?: number;
  /** When true the process keeps running after its lines until killed. */
  hang?: boolean;
};

class FakeChild extends EventEmitter implements ChildLike {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  signals: string[] = [];
  stdinText = "";
  private closed = false;
  constructor(private script: Script) {
    super();
    this.stdin.on("data", (d) => (this.stdinText += String(d)));
    setImmediate(() => void this.play());
  }
  private async play() {
    for (const l of this.script.lines) {
      if (this.closed) return;
      this.stdout.write(`${typeof l === "string" ? l : JSON.stringify(l)}\n`);
      await new Promise((r) => setImmediate(r));
    }
    if (this.script.stderr) this.stderr.write(this.script.stderr);
    if (!this.script.hang) this.finish(this.script.code ?? 0, null);
  }
  private finish(code: number | null, signal: NodeJS.Signals | null) {
    if (this.closed) return;
    this.closed = true;
    this.stdout.end();
    this.stderr.end();
    setImmediate(() => this.emit("close", code, signal));
  }
  kill(signal?: NodeJS.Signals | number): boolean {
    this.signals.push(String(signal));
    // Claude Code ends the turn on SIGINT (exit 130 here); SIGTERM kills (143).
    if (signal === "SIGINT") this.finish(130, null);
    if (signal === "SIGTERM") this.finish(143, "SIGTERM");
    return true;
  }
}

function fakeSpawn(script: Script) {
  const calls: Array<{ command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv; child: FakeChild }> = [];
  const spawnImpl: SpawnLike = (command, args, o) => {
    const child = new FakeChild(script);
    calls.push({ command, args, cwd: o.cwd, env: o.env, child });
    return child;
  };
  return { spawnImpl, calls };
}

function makeReq(over: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    executionSessionId: "es1",
    companyId: "c1",
    taskId: "t1",
    employeeId: "e1",
    systemPrompt: "You are a frontend engineer.",
    taskBrief: "Build the signup form",
    memoryContext: "",
    workspacePath: mkdtempSync(path.join(tmpdir(), "agentopia-cli-")),
    settings: ProviderSettingsSchema.parse({}),
    signal: new AbortController().signal,
    authMode: "SUBSCRIPTION_CLI",
    ...over,
  };
}

function makeHooks(approve = true) {
  const events: ProviderEvent[] = [];
  const usages: UsageReport[] = [];
  const approvals: string[] = [];
  const hooks: ExecutionHooks = {
    onEvent: (e) => void events.push(e),
    onUsage: (u) => void usages.push(u),
    requestApproval: async (r) => {
      approvals.push(r.title);
      return { approved: approve };
    },
  };
  return { hooks, events, usages, approvals };
}

describe("claude-cli adapter (fake spawn, recorded stream-json)", () => {
  it("builds headless args without --bare or bypassPermissions and strips API keys in subscription mode", () => {
    const args = buildClaudeArgs({ settings: ProviderSettingsSchema.parse({ maxTurns: 12 }), model: "claude-sonnet-4-5", resumeSessionId: "prev", systemPrompt: "SYS" });
    expect(args.slice(0, 4)).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
    expect(args).toContain("--permission-mode");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
    expect(args[args.indexOf("--max-turns") + 1]).toBe("12");
    expect(args.slice(args.indexOf("--allowedTools") + 1, args.indexOf("--allowedTools") + 6)).toEqual(["Read", "Edit", "Write", "Glob", "Grep"]);
    expect(args[args.indexOf("--disallowedTools") + 1]).toBe("Bash(rm -rf *)");
    expect(args[args.indexOf("--resume") + 1]).toBe("prev");
    expect(args[args.indexOf("--append-system-prompt") + 1]).toBe("SYS");
    expect(args.join(" ")).not.toMatch(/--bare|bypassPermissions|--no-session-persistence|--max-budget-usd/);
    const env = claudeChildEnv({ ANTHROPIC_API_KEY: "sk-ant", ANTHROPIC_AUTH_TOKEN: "tok", HOME: "/h" }, "subscription");
    expect(env).toEqual({ HOME: "/h" });
  });

  it("success: streams events, usage (tokens provider_reported, no charge under subscription), summary artifact", async () => {
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT, ASSISTANT_TOOL, USER_RESULT, ASSISTANT_DONE, RESULT_OK] });
    const adapter = createClaudeCliAdapter({ spawnImpl, binaryPath: "/usr/local/bin/claude", env: { ANTHROPIC_API_KEY: "leak", PATH: "/usr/bin" } });
    const { hooks, events, usages, approvals } = makeHooks();
    const req = makeReq({ memoryContext: "<untrusted>notes</untrusted>" });
    const r = await adapter.run(req, hooks);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.command).toBe("/usr/local/bin/claude");
    expect(calls[0]!.cwd).toBe(req.workspacePath);
    expect(calls[0]!.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(calls[0]!.child.stdinText).toContain("Build the signup form");
    expect(calls[0]!.child.stdinText).toContain("<untrusted>notes</untrusted>");
    expect(approvals).toEqual([]); // no risky tool in the default allowedTools
    expect(events.map((e) => e.type)).toEqual(["session", "message", "tool_use", "tool_result", "message"]);
    expect(events[3]).toMatchObject({ type: "tool_result", tool: "Read", output: "export const a = 1;" });
    expect(usages).toHaveLength(1);
    expect(r).toMatchObject({ status: "SUCCEEDED", summary: "Done: added the form.", providerSessionId: "sess-1", numTurns: 3 });
    expect(r.usage).toMatchObject({ inputTokens: 1200, outputTokens: 300, cacheReadTokens: 50, cacheWriteTokens: 10, costUsd: null, costSource: "unavailable", tokenSource: "provider_reported" });
    expect(r.metadata).toMatchObject({ apiKeySource: "none", authMode: "subscription" });
    expect(r.artifacts.map((a) => a.name)).toEqual(["summary.md"]);
    expect(r.errorKind).toBeUndefined();
  });

  it("rate_limit_event rejected → USAGE_LIMIT (provider_reported resetAt), stops the CLI with SIGINT", async () => {
    const resetsAt = 1762106400;
    const RL = { type: "rate_limit_event", rate_limit_info: { status: "rejected", resetsAt, rateLimitType: "five_hour", utilization: 1 }, session_id: "sess-1" };
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT, ASSISTANT_DONE, RL], hang: true });
    const { hooks, events } = makeHooks();
    const r = await createClaudeCliAdapter({ spawnImpl, killGraceMs: 50 }).run(makeReq(), hooks);
    expect(calls[0]!.child.signals[0]).toBe("SIGINT");
    expect(r.status).toBe("FAILED");
    expect(r.errorKind).toBe("USAGE_LIMIT");
    expect(r.limit).toEqual({ resetAt: new Date(resetsAt * 1000).toISOString(), retryAfterAt: undefined, source: "provider_reported" });
    expect(events.find((e) => e.type === "provider_status")).toMatchObject({ status: "rejected", utilization: 1, windowLabel: "5-hour window" });
    // partial output is kept
    expect(r.artifacts.map((a) => a.name)).toContain("summary.md");
  });

  it("api_retry rate_limit until max_retries → RATE_LIMIT with the reported retry delay", async () => {
    const retry = (attempt: number) => ({ type: "system", subtype: "api_retry", attempt, max_retries: 3, retry_delay_ms: 20000, error_status: 429, error: "rate_limit", session_id: "sess-1" });
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT, retry(1), retry(2), retry(3)], hang: true });
    const { hooks, events } = makeHooks();
    const before = Date.now();
    const r = await createClaudeCliAdapter({ spawnImpl, killGraceMs: 50 }).run(makeReq(), hooks);
    expect(calls[0]!.child.signals).toContain("SIGINT");
    expect(events.filter((e) => e.type === "progress")).toHaveLength(2);
    expect(r).toMatchObject({ status: "FAILED", errorKind: "RATE_LIMIT" });
    const at = new Date(r.limit!.retryAfterAt!).getTime();
    expect(at).toBeGreaterThanOrEqual(before + 19_000);
    expect(at).toBeLessThanOrEqual(Date.now() + 21_000);
    expect(r.limit!.resetAt).toBeUndefined();
  });

  it("authentication failure: 'Not logged in' result → AUTH_EXPIRED; api_retry authentication_failed → AUTH_EXPIRED", async () => {
    const notLogged = { type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login", session_id: "sess-1", num_turns: 0, total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 } };
    const a = fakeSpawn({ lines: [INIT, notLogged], code: 1 });
    const r1 = await createClaudeCliAdapter({ spawnImpl: a.spawnImpl }).run(makeReq(), makeHooks().hooks);
    expect(r1).toMatchObject({ status: "FAILED", errorKind: "AUTH_EXPIRED" });
    expect(r1.error).toMatch(/Not logged in/);

    const b = fakeSpawn({ lines: [INIT, { type: "system", subtype: "api_retry", attempt: 1, max_retries: 10, retry_delay_ms: 500, error_status: 401, error: "authentication_failed" }], hang: true });
    const r2 = await createClaudeCliAdapter({ spawnImpl: b.spawnImpl, killGraceMs: 50 }).run(makeReq(), makeHooks().hooks);
    expect(r2).toMatchObject({ status: "FAILED", errorKind: "AUTH_EXPIRED" });
    expect(b.calls[0]!.child.signals[0]).toBe("SIGINT");

    const c = fakeSpawn({ lines: [], stderr: "Invalid API key · Please run /login\n", code: 1 });
    const r3 = await createClaudeCliAdapter({ spawnImpl: c.spawnImpl }).run(makeReq(), makeHooks().hooks);
    expect(r3).toMatchObject({ status: "FAILED", errorKind: "AUTH_EXPIRED" });
  });

  it("an API key in the environment (apiKeySource ANTHROPIC_API_KEY) is refused in subscription mode", async () => {
    const { spawnImpl } = fakeSpawn({ lines: [{ ...INIT, apiKeySource: "ANTHROPIC_API_KEY" }], hang: true });
    const r = await createClaudeCliAdapter({ spawnImpl, killGraceMs: 50 }).run(makeReq(), makeHooks().hooks);
    expect(r).toMatchObject({ status: "FAILED", errorKind: "UNSUPPORTED" });
    expect(r.error).toMatch(/API key/);
    expect(r.metadata).toMatchObject({ apiKeySource: "ANTHROPIC_API_KEY" });
  });

  it("cancel via signal: SIGINT, then SIGTERM after the grace period if still running", async () => {
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT], hang: true });
    const ac = new AbortController();
    // SIGINT is ignored by this fake so the SIGTERM escalation is exercised.
    const stubborn: SpawnLike = (c, a, o) => {
      const child = spawnImpl(c, a, o) as FakeChild;
      const orig = child.kill.bind(child);
      child.kill = (sig) => (sig === "SIGINT" ? (child.signals.push("SIGINT"), true) : orig(sig));
      return child;
    };
    const p = createClaudeCliAdapter({ spawnImpl: stubborn, killGraceMs: 30 }).run(makeReq({ signal: ac.signal }), makeHooks().hooks);
    await new Promise((r) => setTimeout(r, 20));
    ac.abort("cancel");
    const r = await p;
    expect(calls[0]!.child.signals).toEqual(["SIGINT", "SIGTERM"]);
    expect(r.status).toBe("CANCELLED");
    expect(r.errorKind).toBeUndefined();
  });

  it("non-zero exit without result → FAILED/OTHER with stderr tail; missing binary → UNSUPPORTED", async () => {
    const { spawnImpl } = fakeSpawn({ lines: [INIT, "not json at all"], stderr: "segfault in renderer\n", code: 2 });
    const r = await createClaudeCliAdapter({ spawnImpl }).run(makeReq(), makeHooks().hooks);
    expect(r).toMatchObject({ status: "FAILED", errorKind: "OTHER" });
    expect(r.error).toMatch(/exit code 2/);
    expect(r.error).toMatch(/segfault in renderer/);

    const enoent: SpawnLike = () => {
      const child = new FakeChild({ lines: [], hang: true });
      setImmediate(() => child.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" })));
      setImmediate(() => child.stdout.end());
      return child;
    };
    const r2 = await createClaudeCliAdapter({ spawnImpl: enoent }).run(makeReq(), makeHooks().hooks);
    expect(r2).toMatchObject({ status: "FAILED", errorKind: "UNSUPPORTED" });
  });

  it("asks the owner once for risky allowed tools (no interactive prompts in -p mode); denial stops before spawning", async () => {
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT, RESULT_OK] });
    const settings = ProviderSettingsSchema.parse({ allowedTools: ["Read", "Bash(git status:*)", "WebFetch"], disallowedTools: [] });
    const { hooks, approvals } = makeHooks(false);
    const r = await createClaudeCliAdapter({ spawnImpl }).run(makeReq({ settings }), hooks);
    expect(approvals).toEqual(["Allow Claude Code to use Bash(git status:*), WebFetch in this run"]);
    expect(r.status).toBe("FAILED");
    expect(calls).toHaveLength(0);
  });
});

describe("claude-cli adapter hardening", () => {
  it("subscription mode refuses any apiKeySource other than none and strips backend-routing env", async () => {
    for (const source of ["apiKeyHelper", "/login managed key", "ANTHROPIC_API_KEY"]) {
      const { spawnImpl } = fakeSpawn({ lines: [{ ...INIT, apiKeySource: source }], hang: true });
      const r = await createClaudeCliAdapter({ spawnImpl, killGraceMs: 20 }).run(makeReq(), makeHooks().hooks);
      expect(r).toMatchObject({ status: "FAILED", errorKind: "UNSUPPORTED" });
      expect(r.error).toContain(source);
    }
    const env = claudeChildEnv({ CLAUDE_CODE_USE_BEDROCK: "1", CLAUDE_CODE_USE_VERTEX: "1", ANTHROPIC_BASE_URL: "https://proxy", HOME: "/h" }, "subscription");
    expect(env).toEqual({ HOME: "/h" });
    // env (API key) mode leaves routing settings alone
    expect(claudeChildEnv({ ANTHROPIC_BASE_URL: "https://proxy" }, "env", "sk")).toEqual({ ANTHROPIC_BASE_URL: "https://proxy", ANTHROPIC_API_KEY: "sk" });
  });

  it("truncates long assistant text to the wire limit", async () => {
    const long = { type: "assistant", session_id: "sess-1", message: { content: [{ type: "text", text: "y".repeat(25_000) }] } };
    const { spawnImpl } = fakeSpawn({ lines: [INIT, long, RESULT_OK] });
    const { hooks, events } = makeHooks();
    await createClaudeCliAdapter({ spawnImpl }).run(makeReq(), hooks);
    const msg = events.find((e) => e.type === "message") as { text: string };
    expect(msg.text.length).toBeLessThanOrEqual(20_000);
  });

  it("escalates to SIGKILL and stops waiting when the CLI ignores SIGINT and SIGTERM", async () => {
    const { spawnImpl, calls } = fakeSpawn({ lines: [INIT], hang: true });
    const deaf: SpawnLike = (c, a, o) => {
      const child = spawnImpl(c, a, o) as FakeChild;
      // Ignores every signal and never closes (e.g. a grandchild keeps stdout open).
      child.kill = (sig) => (child.signals.push(String(sig)), true);
      return child;
    };
    const ac = new AbortController();
    const p = createClaudeCliAdapter({ spawnImpl: deaf, killGraceMs: 20 }).run(makeReq({ signal: ac.signal }), makeHooks().hooks);
    await new Promise((r) => setTimeout(r, 20));
    ac.abort("cancel");
    const r = await p;
    expect(calls[0]!.child.signals).toEqual(["SIGINT", "SIGTERM", "SIGKILL"]);
    expect(r.status).toBe("CANCELLED");
  });

  it("error_max_budget_usd is a terminal (no-retry) failure", async () => {
    const budget = { ...RESULT_OK, subtype: "error_max_budget_usd", is_error: true, result: undefined, errors: [] };
    const { spawnImpl } = fakeSpawn({ lines: [INIT, budget], code: 1 });
    const r = await createClaudeCliAdapter({ spawnImpl }).run(makeReq(), makeHooks().hooks);
    expect(r).toMatchObject({ status: "FAILED", terminal: true, error: "Stopped: per-execution budget reached" });
  });
});

describe("claudeCliUsage cost reporting", () => {
  it("keeps the CLI's client-side estimate only for billed (env/API-key) runs", async () => {
    const { claudeCliUsage } = await import("../claude-cli");
    const msg = { usage: { input_tokens: 10, output_tokens: 5 }, total_cost_usd: 0.5 };
    expect(claudeCliUsage(msg, "sonnet", "env")).toMatchObject({ costUsd: 0.5, costSource: "estimated" });
    expect(claudeCliUsage(msg, "sonnet", "subscription")).toMatchObject({ costUsd: null, costSource: "unavailable" });
  });
});
