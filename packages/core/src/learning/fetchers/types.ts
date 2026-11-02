/** Shared fetcher types. All fetchers accept an injectable `fetchImpl` for tests. */
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export const LEARNING_USER_AGENT = "AgentopiaLearningBot/0.1 (+learning; respects robots)";
/** Hard cap on bytes read from any single response. */
export const MAX_BYTES = 200 * 1024;

/**
 * Read at most `maxBytes` of a response body as UTF-8. Returns the text and
 * whether it was truncated; stops reading (and cancels the stream) at the cap.
 */
export async function readCapped(res: Response, maxBytes = MAX_BYTES): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (!res.body) {
    const t = await res.text();
    const buf = Buffer.from(t, "utf8");
    return buf.length > maxBytes
      ? { text: buf.subarray(0, maxBytes).toString("utf8"), bytes: maxBytes, truncated: true }
      : { text: t, bytes: buf.length, truncated: false };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (bytes + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - bytes));
      bytes = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }
  return { text: Buffer.concat(chunks).toString("utf8"), bytes, truncated };
}

/** Only plain http(s) URLs are ever fetched. */
export function assertHttpUrl(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`unsupported protocol ${u.protocol}`);
  return u;
}
