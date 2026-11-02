/**
 * Local runner (apps/runner): detection without reading secrets or running a
 * model, and adapter planning (subscription by default, never a silent paid switch).
 * All commands are faked: nothing here executes `claude` / `codex`.
 */
import { describe, expect, it } from "vitest";
import { ProviderSettingsSchema } from "../../packages/shared/src/settings";
import { RunnerCapabilitiesSchema, type RunnerJob } from "../../packages/core/src/runner/protocol";
import { detectTools, parseCodexLoginStatus, type ExecFn } from "../../apps/runner/src/detect";
import { planExecution } from "../../apps/runner/src/execute";

type Call = { cmd: string; args: string[]; env?: NodeJS.ProcessEnv };

function fakeExec(answers: Record<string, { code: number | null; stdout?: string; stderr?: string; error?: string }>) {
  const calls: Call[] = [];
  const exec: ExecFn = async (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts?.env });
    const key = `${cmd} ${args.join(" ")}`;
    const a = answers[key] ?? { code: 127, error: "not found" };
    return { code: a.code, stdout: a.stdout ?? "", stderr: a.stderr ?? "", error: a.error };
  };
  return { exec, calls };
}

describe("runner detection", () => {
  it("subscription mode on macOS: keychain item existence (no -w), codex login status; keys stripped from detection env", async () => {
    const { exec, calls } = fakeExec({
      "/usr/local/bin/claude --version": { code: 0, stdout: "2.0.65 (Claude Code)\n" },
      "security find-generic-password -s Claude Code-credentials": { code: 0, stdout: 'keychain: "/Users/x/Library/Keychains/login.keychain-db"\n' },
      "/opt/homebrew/bin/codex --version": { code: 0, stdout: "codex-cli 0.166.0\n" },
      "/opt/homebrew/bin/codex login status": { code: 0, stderr: "Logged in using ChatGPT\n" },
    });
    const tools = await detectTools("subscription", {
      exec,
      env: { PATH: "/usr/bin", OPENAI_API_KEY: "sk-x", ANTHROPIC_API_KEY: "sk-y" },
      platform: "darwin",
      home: "/Users/x",
      exists: () => false,
      which: (n) => (n === "claude" ? "/usr/local/bin/claude" : "/opt/homebrew/bin/codex"),
    });
    expect(tools.claude).toMatchObject({ installed: true, path: "/usr/local/bin/claude", version: "2.0.65 (Claude Code)", bundled: false, auth: "logged_in", authMethod: "keychain", executionAvailable: true });
    expect(tools.codex).toMatchObject({ installed: true, version: "codex-cli 0.166.0", auth: "logged_in", authMethod: "ChatGPT", executionAvailable: true });
    const sec = calls.find((c) => c.cmd === "security")!;
    expect(sec.args).not.toContain("-w");
    expect(sec.args).not.toContain("-g");
    // Nothing that could run a model or print a secret.
    for (const c of calls) expect(`${c.cmd} ${c.args.join(" ")}`).not.toMatch(/ -p\b| exec\b|-w\b|cat |credentials\.json/);
    const codexStatus = calls.find((c) => c.args.join(" ") === "login status")!;
    expect(codexStatus.env?.OPENAI_API_KEY).toBeUndefined();
    expect(codexStatus.env?.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("falls back to the bundled binaries, the credentials file, and reports not-signed-in truthfully", async () => {
    const { exec } = fakeExec({
      "/repo/node_modules/claude --version": { code: 0, stdout: "2.0.65 (Claude Code)" },
      "security find-generic-password -s Claude Code-credentials": { code: 44, stderr: "The specified item could not be found in the keychain." },
      "/repo/node_modules/codex --version": { code: 0, stdout: "codex-cli 0.166.0" },
      "/repo/node_modules/codex login status": { code: 1, stdout: "Not logged in" },
    });
    const base = { exec, env: { PATH: "" }, home: "/home/u", which: () => null, bundled: { claude: () => "/repo/node_modules/claude", codex: () => "/repo/node_modules/codex" } };
    const mac = await detectTools("subscription", { ...base, platform: "darwin", exists: () => false });
    expect(mac.claude).toMatchObject({ bundled: true, auth: "not_logged_in", executionAvailable: false });
    expect(mac.claude.reason).toMatch(/\/login/);
    expect(mac.codex).toMatchObject({ bundled: true, auth: "not_logged_in", executionAvailable: false });
    expect(mac.codex.reason).toMatch(/codex login/);
    const linux = await detectTools("subscription", { ...base, platform: "linux", exists: (p) => p === "/home/u/.claude/.credentials.json" });
    expect(linux.claude).toMatchObject({ auth: "logged_in", authMethod: "credentials file", executionAvailable: true });
    const none = await detectTools("subscription", { ...base, platform: "linux", exists: () => false, bundled: { claude: () => null, codex: () => null } });
    expect(none.claude).toMatchObject({ installed: false, executionAvailable: false });
    expect(none.codex).toMatchObject({ installed: false, executionAvailable: false });
  });

  it("env mode is available only with an env key", async () => {
    const { exec } = fakeExec({ "/b/claude --version": { code: 0, stdout: "2.0.65" }, "/b/codex --version": { code: 0, stdout: "codex-cli 0.166.0" } });
    const t = await detectTools("env", { exec, env: { ANTHROPIC_API_KEY: "sk" }, platform: "linux", home: "/h", exists: () => false, which: (n) => `/b/${n}` });
    expect(t.claude).toMatchObject({ executionAvailable: true, authMethod: "API key (env)" });
    expect(t.codex).toMatchObject({ executionAvailable: false });
  });

  it("parses codex login status", () => {
    expect(parseCodexLoginStatus("Logged in using ChatGPT")).toEqual({ auth: "logged_in", authMethod: "ChatGPT" });
    expect(parseCodexLoginStatus("Logged in using an API key - sk-proj-***")).toEqual({ auth: "logged_in", authMethod: "API key" });
    expect(parseCodexLoginStatus("Not logged in")).toEqual({ auth: "not_logged_in" });
    expect(parseCodexLoginStatus("???")).toEqual({ auth: "unknown" });
  });

  it("capabilities schema: legacy auth 'cli' is read as 'subscription'; tools optional", () => {
    expect(RunnerCapabilitiesSchema.parse({ providers: ["ANTHROPIC"], auth: "cli", version: "0.1.0" }).auth).toBe("subscription");
    expect(RunnerCapabilitiesSchema.parse({ providers: ["ANTHROPIC"], auth: "env", version: "0.1.0" }).auth).toBe("env");
  });
});

describe("runner execution plan (no silent paid switch)", () => {
  const job = (over: Partial<RunnerJob> = {}): RunnerJob => ({
    executionSessionId: "s",
    companyId: "c",
    taskId: "t",
    employeeId: "e",
    projectId: null,
    attempt: 1,
    provider: "ANTHROPIC",
    model: null,
    systemPrompt: "",
    taskBrief: "",
    memoryContext: "",
    settings: ProviderSettingsSchema.parse({}),
    secret: null,
    authMode: "SUBSCRIPTION_CLI",
    resumeSessionId: null,
    timeoutSec: 60,
    costCapUsd: 1,
    ...over,
  });
  const ok = { installed: true, path: "/usr/local/bin/claude", auth: "logged_in" as const, executionAvailable: true };
  const tools = { claude: ok, codex: { ...ok, path: "/opt/homebrew/bin/codex" } };

  it("subscription runner → the user's own CLI with its binary path", () => {
    expect(planExecution(job(), "subscription", tools)).toEqual({ kind: "subscription", authMode: "SUBSCRIPTION_CLI", binaryPath: "/usr/local/bin/claude" });
    expect(planExecution(job({ provider: "OPENAI" }), "cli", tools)).toEqual({ kind: "subscription", authMode: "SUBSCRIPTION_CLI", binaryPath: "/opt/homebrew/bin/codex" });
  });
  it("refuses (no fallback) when the CLI is missing or signed out", () => {
    expect(planExecution(job(), "subscription", { ...tools, claude: { ...ok, auth: "not_logged_in", executionAvailable: false } })).toMatchObject({ kind: "refuse", errorKind: "AUTH_EXPIRED" });
    expect(planExecution(job(), "subscription", { ...tools, claude: { installed: false, auth: "unknown", executionAvailable: false } })).toMatchObject({ kind: "refuse", errorKind: "UNSUPPORTED" });
  });
  it("explicit keys only: server-sent key for API_KEY connections, env key only with --auth env", () => {
    expect(planExecution(job({ secret: "sk-explicit", authMode: "API_KEY" }), "subscription", tools)).toEqual({ kind: "key", authMode: "API_KEY", secret: "sk-explicit" });
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(planExecution(job(), "env", tools)).toMatchObject({ kind: "refuse", errorKind: "UNSUPPORTED" });
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  });
});
