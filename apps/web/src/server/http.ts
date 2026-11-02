import { ZodError, type z } from "zod";
import { Prisma } from "@agentopia/db";
import { ApiError, badRequest } from "./errors";
import { enforceRateLimit, type RateLimitTier } from "./rate-limit";

export { ApiError } from "./errors";

/** Keys that must never leave the server, whatever object is serialized. */
const REDACTED_KEYS = new Set(["encryptedSecret", "tokenHash", "password", "apiKey", "searchVector"]);

/** JSON replacer: BigInt → number, strip secret-bearing keys (defense in depth). */
export function jsonReplacer(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key)) return undefined;
  if (typeof value === "bigint") return Number(value);
  return value;
}

export function toJson(data: unknown): string {
  return JSON.stringify(data, jsonReplacer);
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(toJson(data), { status, headers: h });
}

export const created = (data: unknown) => json(data, 201);
export const noContent = () => new Response(null, { status: 204 });

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const headers: HeadersInit = {};
    if (err.status === 429) headers["retry-after"] = "60";
    return json({ error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } }, err.status, headers);
  }
  if (isDomainError(err)) {
    const code = String(err.code).toLowerCase();
    return json({ error: { code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } }, err.httpStatus);
  }
  if (err && typeof err === "object" && (err as { name?: string }).name === "KnowledgeError") {
    const code = (err as { code: string }).code;
    const status = code === "NOT_FOUND" ? 404 : code === "INVALID_STATE" ? 409 : 400;
    return json({ error: { code: code.toLowerCase(), message: (err as Error).message } }, status);
  }
  if (err instanceof ZodError) {
    return json({ error: { code: "validation_error", message: "Request validation failed", details: err.issues } }, 400);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return json({ error: { code: "not_found", message: "Resource not found" } }, 404);
    if (err.code === "P2002") return json({ error: { code: "conflict", message: "A record with these values already exists" } }, 409);
    if (err.code === "P2003") return json({ error: { code: "conflict", message: "Related record constraint failed" } }, 409);
  }
  console.error("[api] unhandled error", err instanceof Error ? err.message : err);
  return json({ error: { code: "internal_error", message: "Internal server error" } }, 500);
}

/** Duck-typed check for `@agentopia/core/errors` DomainError (avoids identity issues across bundles). */
function isDomainError(err: unknown): err is { code: string; message: string; httpStatus: number; details?: unknown } {
  return !!err && typeof err === "object" && (err as { name?: string }).name === "DomainError" && typeof (err as { httpStatus?: unknown }).httpStatus === "number";
}

type Params = Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteContext = { params: Promise<any> };
export type RouteOptions = { rateLimit?: RateLimitTier };

/**
 * Route handler wrapper: rate limiting, params resolution, consistent error shape,
 * and JSON serialization of plain return values. Handlers may return a Response.
 */
export function route<P extends Params = Params>(
  handler: (req: Request, params: P) => Promise<unknown>,
  opts: RouteOptions = {},
): (req: Request, ctx: RouteContext) => Promise<Response> {
  return async (req, ctx) => {
    try {
      await enforceRateLimit(req, opts.rateLimit ?? "default");
      const params = ((await ctx?.params) ?? {}) as P;
      const out = await handler(req, params);
      if (out instanceof Response) return out;
      return json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Reads a JSON body once ({} when empty); 400 on malformed JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text.length ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Body must be valid JSON");
  }
}

export async function parseBody<S extends z.ZodType>(schema: S, req: Request): Promise<z.infer<S>> {
  return parseValue(schema, await readJson(req));
}

export function parseValue<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(400, "validation_error", "Request validation failed", r.error.issues);
  return r.data;
}

export function queryObject(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((v, k) => {
    if (v !== "") out[k] = v;
  });
  return out;
}

export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  const r = schema.safeParse(queryObject(req));
  if (!r.success) throw new ApiError(400, "validation_error", "Query validation failed", r.error.issues);
  return r.data;
}

// --- Cursor pagination (id cursors) -------------------------------------------
export type Page<T> = { items: T[]; nextCursor: string | null };

export function pageArgs(q: { cursor?: string; limit: number }) {
  return { take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}
