import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const PASSWORD = "Passw0rd!Passw0rd";
export const DEMO_COMPANY_IDS = ["demo_co_northwind", "demo_co_pixel"];

export function uniqueEmail(tag: string): string {
  return `e2e+${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@agentopia.test`;
}

/** Sign up through the better-auth API; the session cookie lands in the context. */
export async function signUpApi(request: APIRequestContext, tag: string, name = "E2E Owner") {
  const email = uniqueEmail(tag);
  const r = await request.post(`${BASE}/api/auth/sign-up/email`, { data: { name, email, password: PASSWORD }, headers: { origin: BASE } });
  expect(r.status(), await r.text()).toBe(200);
  return { email, password: PASSWORD, name };
}

export type CompanyInfo = { companyId: string; floorId: string; buildingId: string };

/** POST /api/companies and resolve the floor it landed on via /api/me. */
export async function createCompanyApi(request: APIRequestContext, name: string, floorName = "Floor 1", buildingId?: string): Promise<CompanyInfo> {
  const r = await request.post(`${BASE}/api/companies`, { data: { name, timezone: "Africa/Cairo", floorName, ...(buildingId ? { buildingId } : {}) } });
  expect(r.status(), await r.text()).toBeLessThan(300);
  const body = await r.json();
  const companyId: string = body.company?.id ?? body.id;
  const me = await (await request.get(`${BASE}/api/me`)).json();
  for (const b of me.buildings as Array<{ id: string; floors: Array<{ id: string; companyId: string | null }> }>) {
    const f = b.floors.find((x) => x.companyId === companyId);
    if (f) return { companyId, floorId: f.id, buildingId: b.id };
  }
  throw new Error(`floor for company ${companyId} not found in /api/me`);
}

export async function hireApi(request: APIRequestContext, cid: string, name: string, specialty: string, rank = "MID_LEVEL") {
  const r = await request.post(`${BASE}/api/companies/${cid}/employees`, { data: { name, specialty, rank } });
  expect(r.status(), await r.text()).toBeLessThan(300);
  const b = await r.json();
  return (b.employee ?? b) as { id: string; name: string };
}

export async function createTaskApi(request: APIRequestContext, cid: string, data: Record<string, unknown>) {
  const r = await request.post(`${BASE}/api/companies/${cid}/tasks`, { data });
  expect(r.status(), await r.text()).toBeLessThan(300);
  const b = await r.json();
  return (b.task ?? b) as { id: string; title: string };
}

export type Ev = { seq: number; type: string; taskId: string | null; employeeId: string | null; payload: Record<string, unknown>; simulated?: boolean };

export async function eventsApi(request: APIRequestContext, cid: string, after = 0): Promise<Ev[]> {
  const out: Ev[] = [];
  let cursor = after;
  for (let i = 0; i < 50; i++) {
    const r = await request.get(`${BASE}/api/companies/${cid}/events?after=${cursor}&limit=100`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    const items: Ev[] = b.items ?? b.events ?? b;
    out.push(...items);
    if (items.length < 100) break;
    cursor = items[items.length - 1]!.seq;
  }
  return out;
}

/** Poll the events endpoint until an event matching `pred` appears. */
export async function waitForEvent(request: APIRequestContext, cid: string, pred: (e: Ev) => boolean, timeoutMs = 45_000): Promise<Ev[]> {
  const deadline = Date.now() + timeoutMs;
  let last: Ev[] = [];
  while (Date.now() < deadline) {
    last = await eventsApi(request, cid);
    if (last.some(pred)) return last;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`event not seen within ${timeoutMs}ms; last types: ${last.map((e) => e.type).join(", ")}`);
}

export async function getTaskApi(request: APIRequestContext, cid: string, tid: string) {
  const r = await request.get(`${BASE}/api/companies/${cid}/tasks/${tid}`);
  expect(r.status()).toBe(200);
  const b = await r.json();
  return (b.task ?? b) as Record<string, unknown> & { status: string };
}

export async function waitForTaskStatus(request: APIRequestContext, cid: string, tid: string, statuses: string[], timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let t: { status: string } | null = null;
  while (Date.now() < deadline) {
    t = await getTaskApi(request, cid, tid);
    if (statuses.includes(t.status)) return t;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`task ${tid} did not reach ${statuses.join("/")} (last: ${t?.status})`);
}

/** A fresh signed-in browser context with one company (and its floor cookie selected). */
export async function newOwner(browser: Browser, tag: string, companyName = "Harbor Studio"): Promise<{ ctx: BrowserContext; page: Page; company: CompanyInfo; email: string }> {
  const ctx = await browser.newContext();
  const { email } = await signUpApi(ctx.request, tag);
  const company = await createCompanyApi(ctx.request, companyName);
  const page = await ctx.newPage();
  return { ctx, page, company, email };
}

/** Collect uncaught page errors so a spec can assert none happened. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
