/**
 * GitHub repository snapshot via the public REST API: metadata, HEAD commit
 * SHA, README and (optionally) recent release notes. Never clones, downloads
 * or executes repository code.
 */
import { contentHash } from "../dedup";
import { extractMarkdown } from "../extract";
import { LEARNING_USER_AGENT, MAX_BYTES, type FetchImpl } from "./types";

export type RepoSnapshotResult = {
  status: "unchanged" | "changed" | "rate_limited" | "error";
  text?: string;
  title?: string;
  headings?: string[];
  etag?: string;
  commitSha?: string;
  contentHash?: string;
  sizeBytes?: number;
  license?: string | null;
  rateLimitRemaining?: number;
  error?: string;
};

const API = "https://api.github.com";
const MIN_REMAINING = 5;

/** Parse `https://github.com/{owner}/{repo}` (extra path segments ignored). */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const [owner, repo] = u.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    const clean = repo.replace(/\.git$/, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(clean)) return null;
    return { owner, repo: clean };
  } catch {
    return null;
  }
}

class RateLimited extends Error {
  constructor(public remaining: number) {
    super("GitHub rate limit nearly exhausted");
  }
}

/**
 * Fetch a repo snapshot. Change detection: `If-None-Match` on the repo
 * endpoint (304 → unchanged) and HEAD SHA vs `lastCommitSha`. Stops with
 * "rate_limited" when `X-RateLimit-Remaining` drops below 5.
 */
export async function fetchRepoSnapshot(
  url: string,
  opts: {
    lastCommitSha?: string | null;
    etag?: string | null;
    token?: string | null;
    signal?: AbortSignal;
    fetchImpl?: FetchImpl;
    includeReleases?: boolean;
  } = {},
): Promise<RepoSnapshotResult> {
  const parsed = parseRepoUrl(url);
  if (!parsed) return { status: "error", error: "not a github.com repository URL" };
  const { owner, repo } = parsed;
  const token = opts.token === undefined ? process.env.GITHUB_TOKEN : opts.token;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let remaining: number | undefined;

  const call = async (path: string, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
      "User-Agent": LEARNING_USER_AGENT,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...extra,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchImpl(`${API}${path}`, { headers, signal: opts.signal });
    const rem = res.headers.get("x-ratelimit-remaining");
    if (rem !== null && Number.isFinite(Number(rem))) remaining = Number(rem);
    if ((res.status === 403 || res.status === 429) && remaining === 0) throw new RateLimited(0);
    return res;
  };
  const guard = () => {
    if (remaining !== undefined && remaining < MIN_REMAINING) throw new RateLimited(remaining);
  };
  const json = async <T>(res: Response): Promise<T> => {
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES * 2) throw new Error("response too large");
    return (await res.json()) as T;
  };

  try {
    const repoRes = await call(`/repos/${owner}/${repo}`, opts.etag ? { "If-None-Match": opts.etag } : {});
    if (repoRes.status === 304) return { status: "unchanged", etag: opts.etag ?? undefined, commitSha: opts.lastCommitSha ?? undefined, rateLimitRemaining: remaining };
    if (!repoRes.ok) return { status: "error", error: `HTTP ${repoRes.status} for repo`, rateLimitRemaining: remaining };
    const meta = await json<{
      full_name?: string;
      description?: string | null;
      default_branch?: string;
      license?: { spdx_id?: string | null } | null;
      pushed_at?: string;
    }>(repoRes);
    const etag = repoRes.headers.get("etag") ?? undefined;
    guard();

    const branch = meta.default_branch ?? "main";
    const commitRes = await call(`/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`);
    if (!commitRes.ok) return { status: "error", error: `HTTP ${commitRes.status} for HEAD commit`, rateLimitRemaining: remaining };
    const commit = await json<{ sha?: string }>(commitRes);
    const sha = commit.sha;
    if (sha && opts.lastCommitSha && sha === opts.lastCommitSha) {
      return { status: "unchanged", etag, commitSha: sha, rateLimitRemaining: remaining };
    }
    guard();

    let readme = "";
    const readmeRes = await call(`/repos/${owner}/${repo}/readme`);
    if (readmeRes.ok) {
      const r = await json<{ content?: string; encoding?: string; size?: number }>(readmeRes);
      if (r.content && r.encoding === "base64" && (r.size ?? 0) <= MAX_BYTES * 4) {
        readme = Buffer.from(r.content, "base64").toString("utf8");
      }
    }

    const releases: string[] = [];
    if (opts.includeReleases !== false && (remaining === undefined || remaining >= MIN_REMAINING)) {
      const relRes = await call(`/repos/${owner}/${repo}/releases?per_page=3`);
      if (relRes.ok) {
        const rel = await json<Array<{ name?: string | null; tag_name?: string; published_at?: string | null; body?: string | null }>>(relRes);
        for (const r of rel.slice(0, 3)) {
          releases.push(`### ${r.name || r.tag_name || "release"} (${r.published_at?.slice(0, 10) ?? "unpublished"})\n${(r.body ?? "").slice(0, 4000)}`);
        }
      }
    }

    const fullName = meta.full_name ?? `${owner}/${repo}`;
    const parts = [
      `# ${fullName}`,
      meta.description ? meta.description : "",
      `Default branch: ${branch}. HEAD: ${sha ?? "unknown"}. License: ${meta.license?.spdx_id ?? "unknown"}.`,
      releases.length ? `## Recent releases\n\n${releases.join("\n\n")}` : "",
      readme ? `## README\n\n${extractMarkdown(readme).text}` : "",
    ].filter(Boolean);
    let text = parts.join("\n\n");
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) text = Buffer.from(text, "utf8").subarray(0, MAX_BYTES).toString("utf8");
    return {
      status: "changed",
      text,
      title: fullName,
      headings: extractMarkdown(text).headings.slice(0, 20),
      etag,
      commitSha: sha,
      contentHash: contentHash(text),
      sizeBytes: Buffer.byteLength(text, "utf8"),
      license: meta.license?.spdx_id ?? null,
      rateLimitRemaining: remaining,
    };
  } catch (err) {
    if (err instanceof RateLimited) return { status: "rate_limited", rateLimitRemaining: err.remaining, error: err.message };
    if (opts.signal?.aborted) throw err;
    return { status: "error", error: err instanceof Error ? err.message : String(err), rateLimitRemaining: remaining };
  }
}
