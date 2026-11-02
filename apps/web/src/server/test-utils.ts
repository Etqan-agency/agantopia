/** Helpers for integration tests (real DB). Not imported by production code. */
import { randomBytes } from "node:crypto";
import { prisma } from "@agentopia/db";
import { __setTestSession, type AppSession } from "./authz";
import type { RouteContext } from "./http";

export const uid = (p = "t") => `${p}_${randomBytes(6).toString("hex")}`;

export async function makeUser(label = "user"): Promise<AppSession["user"]> {
  const id = uid(label);
  const u = await prisma.user.create({ data: { id, email: `${id}@test.agentopia.local`, name: `Test ${label}` } });
  return { id: u.id, email: u.email, name: u.name };
}

export function actAs(user: AppSession["user"] | null) {
  __setTestSession(user ? { user } : null);
}

type Handler = (req: Request, ctx: RouteContext) => Promise<Response>;

/** Invoke an exported route handler like Next.js would. */
export async function call(
  handler: Handler,
  opts: { method?: string; path?: string; params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; query?: Record<string, string> } = {},
) {
  const url = new URL(`http://localhost${opts.path ?? "/api/test"}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const req = new Request(url, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

/** Deletes users and everything they own (companies/buildings cascade). */
export async function cleanupUsers(ids: string[]) {
  if (!ids.length) return;
  await prisma.company.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.building.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
export { prisma } from "@agentopia/db";
