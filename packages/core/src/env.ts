import { existsSync } from "node:fs";
import path from "node:path";

let cachedRepoRoot: string | null | undefined;

/** Walks up from `start` looking for pnpm-workspace.yaml; returns the monorepo root or null. */
export function findRepoRoot(start: string = process.cwd()): string | null {
  if (cachedRepoRoot !== undefined && start === process.cwd()) return cachedRepoRoot;
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      if (start === process.cwd()) cachedRepoRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      if (start === process.cwd()) cachedRepoRoot = null;
      return null;
    }
    dir = parent;
  }
}

/**
 * Resolves a data directory from an env value. Relative paths are resolved
 * against the monorepo root (so web, worker and tests agree), falling back to cwd.
 */
export function resolveDataRoot(value: string | undefined, fallback: string): string {
  const raw = value && value.trim() ? value.trim() : fallback;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(findRepoRoot() ?? process.cwd(), raw);
}

/** Redis key prefix for queues, semaphores and other keys (tests override via AGENTOPIA_REDIS_PREFIX). */
export function redisPrefix(): string {
  return process.env.AGENTOPIA_REDIS_PREFIX?.trim() || "agentopia";
}

/** Parses a numeric env var with a default. */
export function envNumber(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
