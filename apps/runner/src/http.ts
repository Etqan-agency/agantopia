/** Minimal JSON HTTP client for the runner protocol (bearer auth, timeouts, retries). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ClientOptions {
  server: string;
  token: string;
}

/** True for errors worth retrying (network failures and 5xx/429). */
export function isTransient(err: unknown): boolean {
  if (err instanceof HttpError) return err.status >= 500 || err.status === 429;
  return true;
}

/** Sends a JSON request and parses the JSON response (204 → null). */
export async function request<T>(opts: ClientOptions, method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(new URL(path, opts.server), {
    method,
    headers: { authorization: `Bearer ${opts.token}`, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 204) return null as T;
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 300);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // non-JSON error body
    }
    throw new HttpError(res.status, `${method} ${path} → ${res.status}: ${message}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Retries `fn` on transient errors with exponential backoff (max `attempts`). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseMs = 1000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw last;
}
