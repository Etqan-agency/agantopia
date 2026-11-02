/**
 * Claude Code CLI adapter (local runner only). Spawns the user's own,
 * unmodified `claude` binary in headless mode and parses its stream-json
 * output. In subscription mode the child environment has provider API keys
 * removed so the CLI uses the user's own `/login` (Pro/Max) sign-in; Agentopia
 * never reads, copies or forwards those credentials. `--bare` is never passed
 * (it disables the subscription login). `bypassPermissions` is never used.
 *
 * Interactive tool prompts are not available in `-p` mode (there is no
 * `canUseTool` round-trip), so the owner approves risky allowed tools
 * (Bash / WebFetch / WebSearch) once before the run, mirroring the Codex path.
 * See docs/local-runner.md and docs/integrations-research.md §7.
 */
import { spawn as nodeSpawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { classifyProviderError, epochToDate, windowLabelFor, type ClassifiedProviderError } from "./classify";
import type { ExecutionArtifact, ExecutionHooks, ExecutionRequest, ExecutionResult, ProviderAdapter, UsageReport, VerifyResult } from "./types";
import { emptyUsage } from "./types";
import { abortStatus, composeUserPrompt, truncate, workspaceDiff } from "./util";

/** Wire-safe bounds (runner protocol: message text max 20000, approval title max 300). */
const MESSAGE_TEXT_MAX = 19_000;
const APPROVAL_TITLE_MAX = 290;
const clipTitle = (s: string) => (s.length <= APPROVAL_TITLE_MAX ? s : `${s.slice(0, APPROVAL_TITLE_MAX - 1)}…`);

/** Minimal child-process surface (injectable for contract tests). */
export interface ChildLike {
  /** OS pid (real processes); used to signal the whole process group. */
  pid?: number;
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
}
export type SpawnLike = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdio: ["pipe", "pipe", "pipe"]; detached?: boolean }) => ChildLike;

export interface ClaudeCliAdapterOptions {
  /** Binary to spawn. Default "claude" (resolved on PATH by the OS). */
  binaryPath?: string;
  spawnImpl?: SpawnLike;
  /** "subscription" (default) strips ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN from the child env. */
  auth?: "subscription" | "env";
  /** Base environment (default process.env). */
  env?: NodeJS.ProcessEnv;
  /**
   * Stop escalation (ms after the stop): SIGINT, SIGTERM after `killGraceMs`,
   * SIGKILL after 2x, and the run stops waiting for the process after 3x.
   * Default 5000.
   */
  killGraceMs?: number;
}

const RISKY_TOOL = /^(Bash|WebFetch|WebSearch)\b/;

/** Model alias used when the employee/connection sets none (resolved by the CLI to the current Sonnet). */
export const DEFAULT_SUBSCRIPTION_MODEL = "sonnet";

/** Builds the `claude` argv for a request (exported for tests). Never includes --bare or bypassPermissions. */
export function buildClaudeArgs(req: Pick<ExecutionRequest, "settings" | "model" | "resumeSessionId" | "systemPrompt">): string[] {
  const s = req.settings;
  const permissionMode = (s.permissionMode as string) === "bypassPermissions" ? "default" : s.permissionMode;
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", permissionMode, "--max-turns", String(s.maxTurns)];
  if (s.allowedTools.length) args.push("--allowedTools", ...s.allowedTools);
  if (s.disallowedTools.length) args.push("--disallowedTools", ...s.disallowedTools);
  // Always pass a model: the user's global Claude Code default may be an alias this CLI
  // version cannot resolve (seen locally: "model: fable" → 404), which would fail every run.
  args.push("--model", req.model?.trim() || DEFAULT_SUBSCRIPTION_MODEL);
  if (req.resumeSessionId) args.push("--resume", req.resumeSessionId);
  if (req.systemPrompt.trim()) args.push("--append-system-prompt", req.systemPrompt);
  return args;
}

/**
 * Child env for the CLI. Subscription mode removes provider keys and the
 * settings that route Claude Code to another (paid) backend: Bedrock, Vertex
 * or a custom ANTHROPIC_BASE_URL.
 */
export function claudeChildEnv(base: NodeJS.ProcessEnv, auth: "subscription" | "env", secret?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  if (auth === "subscription") {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDE_CODE_USE_BEDROCK;
    delete env.CLAUDE_CODE_USE_VERTEX;
    delete env.ANTHROPIC_BASE_URL;
  } else if (secret) {
    env.ANTHROPIC_API_KEY = secret;
  }
  return env;
}

type Json = Record<string, unknown>;

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === "object" && typeof (b as Json).text === "string" ? ((b as Json).text as string) : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Usage from a stream-json `result` message. `total_cost_usd` is the CLI's client-side estimate. */
export function claudeCliUsage(msg: Json, model?: string, mode: "subscription" | "env" = "env"): UsageReport {
  const u = (msg.usage ?? {}) as Json;
  const cost = typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null;
  // Under the user's own subscription nothing is billed per token: the CLI's `total_cost_usd` is only
  // its client-side estimate of the API-equivalent price, so it must not be shown as a charge.
  const billed = mode !== "subscription";
  return {
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
    cacheReadTokens: num(u.cache_read_input_tokens),
    cacheWriteTokens: num(u.cache_creation_input_tokens),
    costUsd: billed ? cost : null,
    costSource: billed && cost !== null ? "estimated" : "unavailable",
    tokenSource: "provider_reported",
    model,
  };
}

export function createClaudeCliAdapter(opts: ClaudeCliAdapterOptions = {}): ProviderAdapter {
  const spawnImpl: SpawnLike = opts.spawnImpl ?? ((c, a, o) => nodeSpawn(c, a, o) as unknown as ChildLike);
  // Own process group (POSIX) so a stop also reaches tool children (Bash commands) of the CLI.
  const detached = process.platform !== "win32";
  const killGraceMs = opts.killGraceMs ?? 5000;
  const auth = opts.auth ?? "subscription";

  return {
    kind: "ANTHROPIC",
    async listModels(): Promise<string[]> {
      return [];
    },
    async verify(): Promise<VerifyResult> {
      // Sign-in is verified by the runner's detection (no execution, no credential read).
      return { ok: true, status: "VERIFIED", message: "Claude Code sign-in is detected by the local runner" };
    },
    async run(req: ExecutionRequest, hooks: ExecutionHooks): Promise<ExecutionResult> {
      const s = req.settings;
      let usage = emptyUsage("unavailable", req.model);
      const artifacts: ExecutionArtifact[] = [];
      let providerSessionId: string | null = req.resumeSessionId ?? null;
      const mode = req.authMode === "API_KEY" ? "env" : auth;

      const risky = s.allowedTools.filter((t) => RISKY_TOOL.test(t));
      if (risky.length && !s.autoApprove) {
        const d = await hooks.requestApproval({
          kind: "TOOL_USE",
          title: clipTitle(`Allow Claude Code to use ${risky.join(", ")} in this run`),
          payload: { tools: risky, workspace: req.workspacePath, note: "Interactive tool prompts are unavailable in Claude Code headless mode; this approval covers the whole run." },
        });
        if (!d.approved) return { status: "FAILED", summary: "", usage, artifacts, error: `Approval denied${d.note ? `: ${d.note}` : ""}`, providerSessionId };
      }
      if (req.signal.aborted) return { status: abortStatus(req.signal), summary: "", usage, artifacts, error: String(req.signal.reason ?? "aborted"), providerSessionId };

      const args = buildClaudeArgs(req);
      const env = claudeChildEnv(opts.env ?? process.env, mode, req.secret);
      const binary = req.binaryPath ?? opts.binaryPath ?? "claude";

      let child: ChildLike;
      try {
        child = spawnImpl(binary, args, { cwd: req.workspacePath, env, stdio: ["pipe", "pipe", "pipe"], detached });
      } catch (e) {
        return { status: "FAILED", summary: "", usage, artifacts, error: `Could not start Claude Code (${binary}): ${(e as Error).message}`, errorKind: "UNSUPPORTED", providerSessionId };
      }

      let stopping = false;
      const stopTimers: NodeJS.Timeout[] = [];
      /** Signals the CLI's whole process group when it has one, else the child itself. */
      const signalChild = (sig: NodeJS.Signals) => {
        try {
          if (detached && child.pid) process.kill(-child.pid, sig);
          else child.kill(sig);
        } catch {
          try {
            child.kill(sig);
          } catch {
            // already gone
          }
        }
      };
      let hardStop: () => void = () => undefined;
      let rl: Interface | null = null;
      const hardDeadline = new Promise<void>((resolve) => (hardStop = resolve));
      const stop = () => {
        if (stopping) return;
        stopping = true;
        signalChild("SIGINT");
        const later = (ms: number, fn: () => void) => {
          const t = setTimeout(fn, ms);
          t.unref?.();
          stopTimers.push(t);
        };
        later(killGraceMs, () => signalChild("SIGTERM"));
        later(killGraceMs * 2, () => signalChild("SIGKILL"));
        // A grandchild can keep stdout open after the CLI died: stop waiting for it.
        later(killGraceMs * 3, () => {
          rl?.close();
          child.stdout?.destroy();
          hardStop();
        });
      };
      const onAbort = () => stop();
      req.signal.addEventListener("abort", onAbort, { once: true });
      // If the runner process exits mid-run, do not leave the CLI (or its tools) running.
      const onProcessExit = () => signalChild("SIGKILL");
      process.once("exit", onProcessExit);

      let stderrTail = "";
      child.stderr?.on("data", (d: Buffer | string) => {
        stderrTail = (stderrTail + String(d)).slice(-4000);
      });
      let spawnError: Error | null = null;
      const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        child.on("error", (err) => {
          spawnError = err;
          resolve({ code: null, signal: null });
        });
        child.on("close", (code, signal) => resolve({ code, signal }));
      });

      try {
        child.stdin?.on("error", () => undefined);
        child.stdin?.end(composeUserPrompt(req.taskBrief, req.memoryContext));
      } catch {
        // reported through close/error
      }

      const toolNames = new Map<string, string>();
      let model = req.model;
      let lastText = "";
      let result: Json | null = null;
      let limited: ClassifiedProviderError | null = null;
      let unsupported: string | null = null;
      let apiKeySource: string | null = null;
      let lastRetry: { delayMs?: number; error?: string } | null = null;

      const handle = async (msg: Json) => {
        const type = msg.type;
        if (type === "system" && msg.subtype === "init") {
          if (typeof msg.session_id === "string") {
            providerSessionId = msg.session_id;
            await hooks.onEvent({ type: "session", providerSessionId: msg.session_id });
          }
          if (typeof msg.model === "string" && msg.model) model = msg.model;
          apiKeySource = typeof msg.apiKeySource === "string" ? msg.apiKeySource : null;
          // Under the user's own plan the CLI must report no API key source at all. Anything else (an env key,
          // an apiKeyHelper, a key stored by `claude` itself, ...) would bill per token.
          if (mode === "subscription" && apiKeySource !== null && apiKeySource !== "none") {
            unsupported = `Claude Code on the runner uses an API key (apiKeySource: ${apiKeySource}) instead of your subscription sign-in; remove it (e.g. unset ANTHROPIC_API_KEY, apiKeyHelper) or use API mode`;
            stop();
          }
        } else if (type === "system" && msg.subtype === "api_retry") {
          const code = typeof msg.error === "string" ? msg.error : "";
          const attempt = num(msg.attempt);
          const max = num(msg.max_retries);
          lastRetry = { delayMs: typeof msg.retry_delay_ms === "number" ? msg.retry_delay_ms : undefined, error: code };
          if (code === "authentication_failed" || code === "oauth_org_not_allowed" || code === "account_on_hold") {
            limited = classifyProviderError("ANTHROPIC", { code });
            stop();
          } else if (code === "rate_limit" && max > 0 && attempt >= max) {
            limited = classifyProviderError("ANTHROPIC", { code, retryAfterSec: lastRetry.delayMs ? lastRetry.delayMs / 1000 : undefined });
            stop();
          } else {
            await hooks.onEvent({ type: "progress", text: `Claude API retry ${attempt}/${max}${code ? ` (${code})` : ""}` });
          }
        } else if (type === "rate_limit_event") {
          const info = (msg.rate_limit_info ?? {}) as Json;
          const status = info.status === "rejected" || info.status === "allowed_warning" || info.status === "allowed" ? info.status : null;
          if (status) {
            const resetAt = epochToDate(info.resetsAt);
            await hooks.onEvent({
              type: "provider_status",
              status,
              utilization: typeof info.utilization === "number" ? info.utilization : undefined,
              windowLabel: windowLabelFor(typeof info.rateLimitType === "string" ? info.rateLimitType : undefined),
              resetAt: resetAt?.toISOString(),
            });
          }
          if (status === "rejected") {
            limited = classifyProviderError("ANTHROPIC", { rateLimitInfo: info });
            stop();
          }
        } else if (type === "auth_status") {
          if (typeof msg.error === "string" && msg.error) {
            limited = classifyProviderError("ANTHROPIC", { code: "authentication_failed", text: msg.error });
            stop();
          }
        } else if (type === "assistant") {
          const content = ((msg.message as Json | undefined)?.content ?? []) as Json[];
          for (const block of Array.isArray(content) ? content : []) {
            if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
              lastText = block.text;
              await hooks.onEvent({ type: "message", role: "assistant", text: truncate(block.text, MESSAGE_TEXT_MAX) });
            } else if (block.type === "tool_use" && typeof block.name === "string") {
              const id = typeof block.id === "string" ? block.id : undefined;
              if (id) toolNames.set(id, block.name);
              await hooks.onEvent({ type: "tool_use", tool: block.name, input: block.input, toolUseId: id });
            }
          }
        } else if (type === "user") {
          const content = (msg.message as Json | undefined)?.content;
          for (const block of Array.isArray(content) ? (content as Json[]) : []) {
            if (block.type === "tool_result") {
              await hooks.onEvent({
                type: "tool_result",
                tool: typeof block.tool_use_id === "string" ? toolNames.get(block.tool_use_id) : undefined,
                output: truncate(toolResultText(block.content), 4000),
                isError: block.is_error === true,
              });
            }
          }
        } else if (type === "result") {
          result = msg;
          if (typeof msg.session_id === "string" && msg.session_id) providerSessionId = msg.session_id;
          usage = claudeCliUsage(msg, model, mode);
          await hooks.onUsage(usage);
        }
      };

      let parseError: string | null = null;
      if (child.stdout) {
        rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
        try {
          for await (const line of rl) {
            const t = line.trim();
            if (!t) continue;
            let msg: Json;
            try {
              msg = JSON.parse(t) as Json;
            } catch {
              stderrTail = (stderrTail + `\n${t}`).slice(-4000);
              continue;
            }
            try {
              await handle(msg);
            } catch (e) {
              parseError = (e as Error).message;
            }
          }
        } catch (e) {
          // stdout destroyed by the hard stop
          parseError = parseError ?? (e as Error).message;
        }
      }
      const exit = await Promise.race([closed, hardDeadline.then(() => ({ code: null, signal: "SIGKILL" as NodeJS.Signals }))]);
      for (const t of stopTimers) clearTimeout(t);
      // A stopped run must not leave tool processes (Bash children) behind in its process group.
      if (stopping && detached && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // group already gone
        }
      }
      req.signal.removeEventListener("abort", onAbort);
      process.removeListener("exit", onProcessExit);

      const res = result as Json | null;
      const resultText = res && typeof res.result === "string" ? res.result : "";
      const summaryText = (res && res.subtype === "success" && !res.is_error ? resultText : "") || lastText;
      if (summaryText.trim()) artifacts.push({ name: "summary.md", kind: "TEXT", content: summaryText, mimeType: "text/markdown" });
      const diff = await workspaceDiff(req.workspacePath).catch(() => null);
      if (diff) artifacts.push({ name: "workspace.diff", kind: "DIFF", content: diff, mimeType: "text/x-diff" });

      const metadata = { apiKeySource: apiKeySource as string | null, exitCode: exit.code, authMode: mode };
      const base = { providerSessionId, usage, artifacts, numTurns: res && typeof res.num_turns === "number" ? res.num_turns : undefined, metadata };
      const limitOf = (c: ClassifiedProviderError) => ({ resetAt: c.resetAt?.toISOString(), retryAfterAt: c.retryAfterAt?.toISOString(), source: c.source });

      if (unsupported as string | null) return { ...base, status: "FAILED", summary: summaryText, error: unsupported as unknown as string, errorKind: "UNSUPPORTED" };
      const lim = limited as ClassifiedProviderError | null;
      if (lim) return { ...base, status: "FAILED", summary: summaryText, error: lim.message, errorKind: lim.kind, limit: limitOf(lim) };
      if (req.signal.aborted) return { ...base, status: abortStatus(req.signal), summary: summaryText || "Stopped before completion", error: String(req.signal.reason ?? "aborted") };
      if (spawnError) {
        const err = spawnError as NodeJS.ErrnoException;
        return { ...base, status: "FAILED", summary: "", error: `Could not start Claude Code (${binary}): ${err.message}`, errorKind: err.code === "ENOENT" ? "UNSUPPORTED" : "OTHER" };
      }
      if (res) {
        if (res.subtype !== "success" || res.is_error) {
          const errs = Array.isArray(res.errors) ? (res.errors as unknown[]).map(String).join("; ") : "";
          const text = resultText || errs || String(res.subtype ?? "error");
          const retry = lastRetry as { delayMs?: number; error?: string } | null;
          const c = classifyProviderError("ANTHROPIC", { text, retryAfterSec: retry?.error === "rate_limit" && retry.delayMs ? retry.delayMs / 1000 : undefined });
          if (c.kind !== "OTHER") return { ...base, status: "FAILED", summary: summaryText, error: c.message, errorKind: c.kind, limit: limitOf(c) };
          const err =
            res.subtype === "error_max_budget_usd" ? "Stopped: per-execution budget reached" : res.subtype === "error_max_turns" ? "Stopped: maximum turns reached" : truncate(text, 2000);
          return { ...base, status: "FAILED", summary: summaryText, error: err, errorKind: "OTHER", ...(res.subtype === "error_max_budget_usd" ? { terminal: true } : {}) };
        }
        return { ...base, status: "SUCCEEDED", summary: summaryText };
      }
      // No result message: the CLI exited early.
      const tail = stderrTail.trim();
      const c = classifyProviderError("ANTHROPIC", { text: tail });
      if (c.kind !== "OTHER") return { ...base, status: "FAILED", summary: summaryText, error: c.message, errorKind: c.kind, limit: limitOf(c) };
      const why = exit.signal ? `signal ${exit.signal}` : `exit code ${exit.code}`;
      return { ...base, status: "FAILED", summary: summaryText, error: truncate(`Claude Code ended without a result (${why})${parseError ? `; ${parseError}` : ""}${tail ? `\n${tail.slice(-1500)}` : ""}`, 2000), errorKind: "OTHER" };
    },
  };
}
