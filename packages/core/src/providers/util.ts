import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/** Truncates a string to `max` chars with a marker. */
export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

/** Resolves after `ms`, or rejects early with an AbortError when `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError(signal!));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Builds an AbortError carrying the signal's reason. */
export function abortError(signal: AbortSignal): Error {
  const e = new Error(typeof signal.reason === "string" ? signal.reason : "aborted");
  e.name = "AbortError";
  return e;
}

/** Maps an abort reason to an execution terminal status. */
export function abortStatus(signal: AbortSignal): "CANCELLED" | "TIMED_OUT" | "FAILED" {
  const r = signal.reason;
  if (r === "timeout") return "TIMED_OUT";
  if (r === "cost_cap" || r === "lease_lost") return "FAILED";
  return "CANCELLED";
}

const DIFF_LIMIT = 200 * 1024;

/**
 * Returns `git diff` of the workspace against HEAD (including new files via
 * intent-to-add), bounded to 200KB, or null when not a git repo / no changes.
 */
export function workspaceDiff(cwd: string): Promise<string | null> {
  if (!existsSync(path.join(cwd, ".git"))) return Promise.resolve(null);
  const run = (args: string[]) =>
    new Promise<string>((resolve) => {
      execFile("git", args, { cwd, maxBuffer: DIFF_LIMIT * 2, timeout: 15000 }, (err, stdout) => resolve(err ? "" : String(stdout)));
    });
  return (async () => {
    await run(["add", "-A", "-N"]);
    const hasHead = (await run(["rev-parse", "--verify", "HEAD"])).trim().length > 0;
    const out = await run(hasHead ? ["diff", "HEAD"] : ["diff"]);
    if (!out.trim()) return null;
    return truncate(out, DIFF_LIMIT);
  })();
}

/** Copies process.env into a string-only record (SDKs that reject undefined values). */
export function stringEnv(extra: Record<string, string | undefined> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...process.env, ...extra })) if (typeof v === "string") out[k] = v;
  return out;
}

/** Composes the user-turn prompt from the brief and (untrusted) memory context. */
export function composeUserPrompt(taskBrief: string, memoryContext: string): string {
  return memoryContext.trim() ? `${taskBrief}\n\n${memoryContext}` : taskBrief;
}
