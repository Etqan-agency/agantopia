/**
 * Detects the provider CLIs on this machine and whether they are signed in,
 * WITHOUT reading any secret and without running a model:
 *  - claude: binary on PATH (user-installed) or the bundled, unmodified vendor
 *    binary; `claude --version`; sign-in = existence of the macOS keychain item
 *    "Claude Code-credentials" (`security find-generic-password -s …`, never `-w`)
 *    or of `~/.claude/.credentials.json` (contents never opened).
 *  - codex: binary on PATH or bundled; `codex --version`; `codex login status`.
 * See docs/local-runner.md ("What the runner detects / never reads").
 */
import { execFile } from "node:child_process";
import { accessSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { RunnerToolInfo } from "@agentopia/shared";
import { bundledClaudePath, bundledCodexPath } from "@agentopia/core/runner/bundled";

export type RunnerAuthMode = "subscription" | "env";
export type DetectedTools = { claude: RunnerToolInfo; codex: RunnerToolInfo };

export type ExecResult = { code: number | null; stdout: string; stderr: string; error?: string };
export type ExecFn = (cmd: string, args: string[], opts?: { env?: NodeJS.ProcessEnv; timeoutMs?: number }) => Promise<ExecResult>;

export interface DetectDeps {
  exec?: ExecFn;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  home?: string;
  exists?: (p: string) => boolean;
  /** Resolve a command on PATH (default: scan PATH entries). */
  which?: (name: string) => string | null;
  bundled?: { claude: () => string | null; codex: () => string | null };
}

const defaultExec: ExecFn = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { env: opts.env ?? process.env, timeout: opts.timeoutMs ?? 15_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { code?: number | string }) | null;
      resolve({ code: e ? (typeof e.code === "number" ? e.code : null) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), error: e && typeof e.code !== "number" ? e.message : undefined });
    });
  });

/** First executable `name` on PATH (no shell, so shell functions/aliases are ignored). */
export function whichOnPath(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const exts = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD").split(";") : [""];
  for (const dir of (env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      try {
        if (statSync(p).isFile()) {
          accessSync(p, constants.X_OK);
          return p;
        }
      } catch {
        // not here
      }
    }
  }
  return null;
}

function isInsideNodeModules(p: string): boolean {
  try {
    return realpathSync(p).split(path.sep).includes("node_modules");
  } catch {
    return p.split(path.sep).includes("node_modules");
  }
}

function firstLine(s: string): string {
  return s.trim().split(/\r?\n/)[0]?.trim().slice(0, 200) ?? "";
}

/** Env for detection commands in subscription mode: provider API keys removed. */
function cleanEnv(env: NodeJS.ProcessEnv, mode: RunnerAuthMode): NodeJS.ProcessEnv {
  if (mode !== "subscription") return env;
  const e = { ...env };
  delete e.ANTHROPIC_API_KEY;
  delete e.ANTHROPIC_AUTH_TOKEN;
  delete e.OPENAI_API_KEY;
  delete e.CODEX_API_KEY;
  return e;
}

/** Parses `codex login status` output. */
export function parseCodexLoginStatus(out: string): { auth: RunnerToolInfo["auth"]; authMethod?: string } {
  if (/not logged in/i.test(out)) return { auth: "not_logged_in" };
  if (/logged in using chatgpt/i.test(out)) return { auth: "logged_in", authMethod: "ChatGPT" };
  if (/logged in using (an )?api key/i.test(out)) return { auth: "logged_in", authMethod: "API key" };
  if (/logged in/i.test(out)) return { auth: "logged_in" };
  return { auth: "unknown" };
}

async function detectClaude(mode: RunnerAuthMode, d: Required<Omit<DetectDeps, "which" | "bundled">> & Pick<DetectDeps, "which" | "bundled">): Promise<RunnerToolInfo> {
  const onPath = (d.which ?? ((n: string) => whichOnPath(n, d.env)))("claude");
  const bundledPath = onPath ? null : (d.bundled?.claude ?? bundledClaudePath)();
  const bin = onPath ?? bundledPath;
  if (!bin) {
    return { installed: false, auth: "unknown", executionAvailable: false, reason: "Claude Code is not installed (install it from https://code.claude.com, then run `claude` and /login)" };
  }
  const bundled = !onPath || isInsideNodeModules(bin);
  const env = cleanEnv(d.env, mode);
  const v = await d.exec(bin, ["--version"], { env, timeoutMs: 15_000 });
  const version = v.code === 0 ? firstLine(v.stdout) || undefined : undefined;
  if (v.code !== 0 && v.error) {
    return { installed: false, path: bin, bundled, auth: "unknown", executionAvailable: false, reason: `Claude Code could not start: ${v.error}` };
  }

  if (mode === "env") {
    const has = !!d.env.ANTHROPIC_API_KEY;
    return { installed: true, path: bin, version, bundled, auth: has ? "logged_in" : "not_logged_in", authMethod: has ? "API key (env)" : undefined, executionAvailable: has, reason: has ? undefined : "--auth env but ANTHROPIC_API_KEY is not set" };
  }

  // Subscription: existence checks only; secrets are never read.
  let auth: RunnerToolInfo["auth"] = "unknown";
  let authMethod: string | undefined;
  if (d.env.CLAUDE_CODE_OAUTH_TOKEN) {
    auth = "logged_in";
    authMethod = "oauth token (env)";
  }
  if (auth !== "logged_in" && d.platform === "darwin") {
    // Exit 0 = item exists; 44 = not found. Without -w the password is not printed; output is discarded.
    const k = await d.exec("security", ["find-generic-password", "-s", "Claude Code-credentials"], { timeoutMs: 10_000 });
    if (k.code === 0) {
      auth = "logged_in";
      authMethod = "keychain";
    } else if (k.code === 44) {
      auth = "not_logged_in";
    }
  }
  if (auth !== "logged_in") {
    const dirs = [d.env.CLAUDE_CONFIG_DIR, path.join(d.home, ".claude")].filter((x): x is string => !!x);
    if (dirs.some((dir) => d.exists(path.join(dir, ".credentials.json")))) {
      auth = "logged_in";
      authMethod = "credentials file";
    } else if (d.platform !== "darwin") {
      auth = "unknown";
    }
  }
  const executionAvailable = auth === "logged_in";
  return {
    installed: true,
    path: bin,
    version,
    bundled,
    auth,
    authMethod,
    executionAvailable,
    reason: executionAvailable ? undefined : auth === "not_logged_in" ? "Not signed in: run `claude` and use /login" : "Sign-in could not be detected: run `claude` and use /login",
  };
}

async function detectCodex(mode: RunnerAuthMode, d: Required<Omit<DetectDeps, "which" | "bundled">> & Pick<DetectDeps, "which" | "bundled">): Promise<RunnerToolInfo> {
  const onPath = (d.which ?? ((n: string) => whichOnPath(n, d.env)))("codex");
  const bundledPath = onPath ? null : (d.bundled?.codex ?? bundledCodexPath)();
  const bin = onPath ?? bundledPath;
  if (!bin) {
    return { installed: false, auth: "unknown", executionAvailable: false, reason: "Codex CLI is not installed (npm i -g @openai/codex, then run `codex login`)" };
  }
  const bundled = !onPath || isInsideNodeModules(bin);
  const env = cleanEnv(d.env, mode);
  const v = await d.exec(bin, ["--version"], { env, timeoutMs: 15_000 });
  const version = v.code === 0 ? firstLine(v.stdout) || undefined : undefined;
  if (v.code !== 0 && v.error) {
    return { installed: false, path: bin, bundled, auth: "unknown", executionAvailable: false, reason: `Codex could not start: ${v.error}` };
  }
  if (mode === "env") {
    const has = !!(d.env.OPENAI_API_KEY || d.env.CODEX_API_KEY);
    return { installed: true, path: bin, version, bundled, auth: has ? "logged_in" : "not_logged_in", authMethod: has ? "API key (env)" : undefined, executionAvailable: has, reason: has ? undefined : "--auth env but OPENAI_API_KEY is not set" };
  }
  const s = await d.exec(bin, ["login", "status"], { env, timeoutMs: 15_000 });
  const { auth, authMethod } = parseCodexLoginStatus(`${s.stdout}\n${s.stderr}`);
  const executionAvailable = auth === "logged_in";
  return {
    installed: true,
    path: bin,
    version,
    bundled,
    auth,
    authMethod,
    executionAvailable,
    reason: !executionAvailable
      ? auth === "not_logged_in"
        ? "Not signed in: run `codex login` (Sign in with ChatGPT)"
        : "Sign-in could not be detected: run `codex login status`"
      : authMethod === "API key"
        ? "Codex is signed in with an API key on this machine (usage bills to that key, not a ChatGPT plan)"
        : undefined,
  };
}

/** Detects both CLIs. Never reads credentials and never runs a model. */
export async function detectTools(mode: RunnerAuthMode = "subscription", deps: DetectDeps = {}): Promise<DetectedTools> {
  const d = {
    exec: deps.exec ?? defaultExec,
    env: deps.env ?? process.env,
    platform: deps.platform ?? process.platform,
    home: deps.home ?? homedir(),
    exists: deps.exists ?? existsSync,
    which: deps.which,
    bundled: deps.bundled,
  };
  const [claude, codex] = await Promise.all([detectClaude(mode, d), detectCodex(mode, d)]);
  return { claude, codex };
}
