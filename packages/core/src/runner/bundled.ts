/**
 * Locates the unmodified vendor CLI binaries shipped in Agentopia's
 * node_modules (fallback when the user has no `claude` / `codex` on PATH).
 * Resolution mirrors the vendors' own SDK lookups; files are never modified.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const req = createRequire(import.meta.url);

function tryResolve(fromFile: string, spec: string): string | null {
  try {
    return createRequire(fromFile).resolve(spec);
  } catch {
    return null;
  }
}

/** Resolves an installed package entry (ESM-only packages via import.meta.resolve, else CJS resolution). */
function sdkEntry(name: string): string | null {
  try {
    if (typeof import.meta.resolve === "function") return fileURLToPath(import.meta.resolve(name));
  } catch {
    // fall through
  }
  try {
    return req.resolve(name);
  } catch {
    return null;
  }
}

/** Bundled Claude Code binary from `@anthropic-ai/claude-agent-sdk-<platform>-<arch>`, or null. */
export function bundledClaudePath(): string | null {
  const sdk = sdkEntry("@anthropic-ai/claude-agent-sdk");
  if (!sdk) return null;
  const pkg = tryResolve(sdk, `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/package.json`);
  if (!pkg) return null;
  const bin = path.join(path.dirname(pkg), process.platform === "win32" ? "claude.exe" : "claude");
  return existsSync(bin) ? bin : null;
}

const CODEX_TRIPLE: Record<string, string> = {
  "linux-x64": "x86_64-unknown-linux-musl",
  "linux-arm64": "aarch64-unknown-linux-musl",
  "darwin-x64": "x86_64-apple-darwin",
  "darwin-arm64": "aarch64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
  "win32-arm64": "aarch64-pc-windows-msvc",
};

/** Bundled Codex CLI binary from `@openai/codex` (platform optional dependency), or null. */
export function bundledCodexPath(): string | null {
  const key = `${process.platform}-${process.arch}`;
  const triple = CODEX_TRIPLE[key];
  const sdk = sdkEntry("@openai/codex-sdk");
  if (!triple || !sdk) return null;
  const codexPkg = tryResolve(sdk, "@openai/codex/package.json");
  if (!codexPkg) return null;
  const platPkg = tryResolve(codexPkg, `@openai/codex-${key}/package.json`);
  if (!platPkg) return null;
  const bin = path.join(path.dirname(platPkg), "vendor", triple, "bin", process.platform === "win32" ? "codex.exe" : "codex");
  return existsSync(bin) ? bin : null;
}
