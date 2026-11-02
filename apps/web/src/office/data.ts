/** Minimal fetch helpers for the office (kept local so the office slice is self-contained). */
import type { FloorView } from "@agentopia/shared";
import type { FloorSummary } from "./FloorSwitcher";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* not JSON */
    }
    throw new HttpError(res.status, message);
  }
  return (await res.json()) as T;
}

/** Accepts the bare FloorView or `{ view }` / `{ floor }` envelopes. */
function unwrapView(raw: unknown): FloorView {
  const o = raw as Record<string, unknown>;
  const v = (o && typeof o === "object" && ("rooms" in o ? o : (o.view ?? o.floor ?? o.data))) as FloorView | undefined;
  if (!v || !Array.isArray(v.rooms) || !Array.isArray(v.employees) || !v.layout) throw new Error("Malformed floor view");
  return v;
}

export async function fetchFloorView(floorId: string, opts?: { demo?: boolean; signal?: AbortSignal }): Promise<FloorView> {
  const url = opts?.demo ? `/api/demo/floors/${encodeURIComponent(floorId)}/view` : `/api/floors/${encodeURIComponent(floorId)}/view`;
  return unwrapView(await fetchJson<unknown>(url, { signal: opts?.signal }));
}

type RawFloor = {
  id: string;
  name: string;
  order?: number;
  companyId?: string | null;
  company?: { id?: string; name?: string } | null;
  companyName?: string | null;
  taskSummary?: FloorSummary["taskSummary"];
};

function toSummaries(floors: RawFloor[]): FloorSummary[] {
  return floors
    .filter((f) => f && typeof f.id === "string")
    .map((f, i) => ({
      id: f.id,
      name: f.name ?? `Floor ${i + 1}`,
      order: typeof f.order === "number" ? f.order : i,
      companyId: f.companyId ?? f.company?.id ?? null,
      companyName: f.company?.name ?? f.companyName ?? null,
      taskSummary: f.taskSummary,
    }))
    .sort((a, b) => a.order - b.order);
}

/** `/api/me` → floors (flattened across buildings) + default company id. */
export async function fetchMyFloors(): Promise<{ floors: FloorSummary[]; defaultCompanyId: string | null }> {
  const me = await fetchJson<{ buildings?: Array<{ floors?: RawFloor[] }>; defaultCompanyId?: string | null }>("/api/me");
  const all: RawFloor[] = [];
  for (const b of me.buildings ?? []) all.push(...(b.floors ?? []));
  return { floors: toSummaries(all), defaultCompanyId: me.defaultCompanyId ?? null };
}

/** `/api/demo/building` → `{ name, floors }` (accepts `{ building: {...} }` too). */
export async function fetchDemoBuilding(): Promise<{ name: string; floors: FloorSummary[] }> {
  const raw = await fetchJson<Record<string, unknown>>("/api/demo/building");
  const b = (raw.building ?? raw) as { name?: string; floors?: RawFloor[] };
  return { name: b.name ?? "Demo building", floors: toSummaries(b.floors ?? []) };
}

export async function fetchDemoScript(): Promise<unknown> {
  return fetchJson<unknown>("/api/demo/script");
}
