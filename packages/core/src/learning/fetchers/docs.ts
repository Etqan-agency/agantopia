/** Documentation page fetcher (conditional GET, size cap, deterministic extraction). */
import { contentHash } from "../dedup";
import { extractText } from "../extract";
import { assertHttpUrl, LEARNING_USER_AGENT, MAX_BYTES, readCapped, type FetchImpl } from "./types";

export type DocFetchResult = {
  status: "unchanged" | "changed" | "error";
  text?: string;
  title?: string;
  headings?: string[];
  etag?: string;
  contentHash?: string;
  sizeBytes?: number;
  truncated?: boolean;
  error?: string;
};

const ALLOWED_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "text/markdown", "text/x-markdown"];

/**
 * Fetch one docs page. Sends `If-None-Match` when an ETag is known (304 →
 * "unchanged"), reads at most 200 KB, reduces HTML to text deterministically
 * and hashes it. Never executes or follows anything in the content.
 */
export async function fetchDocPage(
  url: string,
  opts: { etag?: string | null; signal?: AbortSignal; fetchImpl?: FetchImpl } = {},
): Promise<DocFetchResult> {
  try {
    assertHttpUrl(url);
    const headers: Record<string, string> = {
      "User-Agent": LEARNING_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,text/markdown;q=0.9",
    };
    if (opts.etag) headers["If-None-Match"] = opts.etag;
    const res = await (opts.fetchImpl ?? fetch)(url, { headers, signal: opts.signal, redirect: "follow" });
    if (res.status === 304) return { status: "unchanged", etag: opts.etag ?? undefined };
    if (!res.ok) return { status: "error", error: `HTTP ${res.status}` };
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct && !ALLOWED_TYPES.some((t) => ct.includes(t))) return { status: "error", error: `unsupported content-type ${ct}` };
    const body = await readCapped(res, MAX_BYTES);
    const ex = extractText(body.text, ct);
    return {
      status: "changed",
      text: ex.text,
      title: ex.title ?? new URL(url).pathname,
      headings: ex.headings,
      etag: res.headers.get("etag") ?? undefined,
      contentHash: contentHash(ex.text),
      sizeBytes: body.bytes,
      truncated: body.truncated,
    };
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
