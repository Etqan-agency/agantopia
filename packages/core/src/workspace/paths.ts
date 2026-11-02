import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { resolveDataRoot } from "../env";

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Absolute workspace root (AGENTOPIA_WORKSPACE_ROOT, relative paths resolve from the repo root). */
export function workspaceRoot(): string {
  return resolveDataRoot(process.env.AGENTOPIA_WORKSPACE_ROOT, "./workspaces");
}

/** Absolute artifact root (AGENTOPIA_ARTIFACT_ROOT). */
export function artifactRoot(): string {
  return resolveDataRoot(process.env.AGENTOPIA_ARTIFACT_ROOT, "./artifacts");
}

/** Throws unless `id` is a plain identifier (no separators, dots or traversal). */
export function assertSafeId(id: string, label = "id"): string {
  if (!SAFE_ID.test(id)) throw new Error(`Unsafe ${label}: ${JSON.stringify(id)}`);
  return id;
}

/** Resolves `parts` under `root` and throws if the result escapes `root`. */
export function safeJoin(root: string, ...parts: string[]): string {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("Path escapes its root");
  return target;
}

/** Reduces a file name to a safe basename. */
export function safeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/")).replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_");
  return (base || "artifact").slice(0, 120);
}

function git(cwd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => execFile("git", args, { cwd, timeout: 15000 }, (err) => resolve(!err)));
}

/**
 * Ensures the per-company (and per-project) workspace directory exists and is
 * a git repository with an initial commit (so diffs can be produced).
 * Layout: <root>/<companyId>/<projectId|default>.
 */
export async function ensureWorkspace(companyId: string, projectId?: string | null): Promise<string> {
  const dir = safeJoin(workspaceRoot(), assertSafeId(companyId, "companyId"), projectId ? assertSafeId(projectId, "projectId") : "default");
  await mkdir(dir, { recursive: true });
  if (!existsSync(path.join(dir, ".git"))) {
    if (await git(dir, ["init", "-q"])) {
      await git(dir, ["-c", "user.name=Agentopia", "-c", "user.email=agentopia@localhost", "commit", "-q", "--allow-empty", "-m", "Initialize Agentopia workspace"]);
    }
  }
  return dir;
}

/** Path for an artifact file: <artifactRoot>/<companyId>/<taskId>/<safe name>. Traversal-safe. */
export function artifactPath(companyId: string, taskId: string, name: string): string {
  return safeJoin(artifactRoot(), assertSafeId(companyId, "companyId"), assertSafeId(taskId, "taskId"), safeFileName(name));
}
