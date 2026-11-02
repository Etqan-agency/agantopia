/**
 * Typed fetch helpers for the UI. Same-origin; the better-auth session cookie
 * is sent automatically. Errors are thrown as `ApiClientError` carrying the
 * documented `{ error: { code, message, details? } }` body.
 */
import { EVENT_TYPES } from "@agentopia/shared";
import type { ApiErrorBody, TaskEventView } from "./api-types";

export * from "./api-types";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function isApiClientError(e: unknown): e is ApiClientError {
  return e instanceof ApiClientError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | undefined)?.error;
    throw new ApiClientError(res.status, err?.code ?? `http_${res.status}`, err?.message ?? res.statusText ?? "Request failed", err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, init?: RequestInit) => request<T>("GET", withQuery(path, query), undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("POST", path, body ?? {}, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("PATCH", path, body ?? {}, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>("PUT", path, body ?? {}, init),
  del: <T>(path: string, init?: RequestInit) => request<T>("DELETE", path, undefined, init),
};

/**
 * Subscribe to a company's live events over SSE. With `after === null` the first
 * connect sends no cursor, so the server replays only the most recent events and
 * then streams live ones. We track the last seq received and, on any error, close
 * the EventSource and reconnect ourselves with `?after=<last>` and exponential
 * backoff. (The browser's own retry would reuse the original URL, and the query
 * param wins over Last-Event-ID, so it would replay from the wrong cursor.)
 * Returns an unsubscribe function.
 */
export function streamCompanyEvents(
  companyId: string,
  after: number | null,
  onEvent: (e: TaskEventView) => void,
  opts: { onError?: (ev: Event) => void; onOpen?: () => void } = {},
): () => void {
  let last: number | null = after;
  let es: EventSource | null = null;
  let closed = false;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const handle = (msg: MessageEvent<string>) => {
    try {
      const e = JSON.parse(msg.data) as TaskEventView;
      const seq = Number(e.seq);
      if (!Number.isFinite(seq)) return;
      if (last !== null && seq <= last) return;
      last = seq;
      onEvent(seq === e.seq ? e : { ...e, seq });
    } catch {
      /* ignore malformed frames */
    }
  };

  const connect = () => {
    if (closed) return;
    const q = last !== null ? `?after=${last}` : "";
    es = new EventSource(`/api/companies/${encodeURIComponent(companyId)}/events/stream${q}`, { withCredentials: true });
    es.onopen = () => {
      retry = 0;
      opts.onOpen?.();
    };
    es.onmessage = handle;
    // Named events (event: <type>) don't hit onmessage; listen to every known type.
    for (const t of EVENT_TYPES) es.addEventListener(t, handle as EventListener);
    es.onerror = (ev) => {
      // Always reconnect ourselves so the `after` cursor is current.
      es?.close();
      es = null;
      if (closed) return;
      opts.onError?.(ev);
      retry += 1;
      retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(retry, 5)));
    };
  };
  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    es?.close();
    es = null;
  };
}
