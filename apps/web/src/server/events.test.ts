/** SSE: replays persisted events after the cursor, then delivers live events from the Redis bus. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./core", async (orig) => {
  const real = await orig<typeof import("./core")>();
  return { ...real, syncScheduleToQueue: vi.fn(async () => undefined) };
});

import { actAs, call, cleanupUsers, makeUser, prisma } from "./test-utils";
import { createCompany } from "./services/companies";
import { emitEvent } from "./core";
import * as stream from "../app/api/companies/[cid]/events/stream/route";
import * as events from "../app/api/companies/[cid]/events/route";

const users: string[] = [];
let cid: string;
let user: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  user = await makeUser("sse");
  users.push(user.id);
  cid = (await createCompany(user.id, { name: "SSE Co", timezone: "UTC" })).company.id;
  actAs(user);
});

afterAll(async () => {
  actAs(null);
  await cleanupUsers(users);
  try {
    const bus = await import("@agentopia/core/events/bus");
    await bus.closeRedis?.();
  } catch {
    /* bus not available */
  }
});

async function readFrames(reader: ReadableStreamDefaultReader<Uint8Array>, want: (frames: string[]) => boolean, timeoutMs = 8000) {
  const dec = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await Promise.race([reader.read(), new Promise<null>((res) => setTimeout(() => res(null), deadline - Date.now()))]);
    if (!r || r.done) break;
    buf += dec.decode(r.value, { stream: true });
    const frames = buf.split("\n\n").filter((f) => f.startsWith("id: "));
    if (want(frames)) return frames;
  }
  return buf.split("\n\n").filter((f) => f.startsWith("id: "));
}

describe("company event stream", () => {
  it("polling endpoint returns numeric seq cursors", async () => {
    await emitEvent({ companyId: cid, type: "demo.note", payload: { n: 0 } });
    const r = await call(events.GET, { params: { cid }, query: { after: "0" } });
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
    expect(typeof r.json.items[0].seq).toBe("number");
    expect(r.json.nextCursor).toBe(r.json.items[r.json.items.length - 1].seq);
  });

  it("replays after the cursor and then streams live events", async () => {
    const before = await prisma.taskEvent.findFirst({ where: { companyId: cid }, orderBy: { seq: "desc" } });
    const after = Number(before?.seq ?? 0);
    for (let i = 1; i <= 3; i++) await emitEvent({ companyId: cid, type: "demo.note", payload: { n: i } });

    const ac = new AbortController();
    const req = new Request(`http://localhost/api/companies/${cid}/events/stream?after=${after}`, { signal: ac.signal });
    const res = await stream.GET(req, { params: Promise.resolve({ cid }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();

    const replayed = await readFrames(reader, (f) => f.length >= 3);
    expect(replayed).toHaveLength(3);
    expect(replayed[0]).toMatch(/^id: \d+\nevent: demo\.note\ndata: \{/);
    const seqs = replayed.map((f) => Number(/^id: (\d+)/.exec(f)![1]));
    expect(seqs.every((s) => s > after)).toBe(true);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);

    await new Promise((r) => setTimeout(r, 300)); // let the subscriber attach
    await emitEvent({ companyId: cid, type: "employee.state", payload: { state: "THINKING" } });
    const live = await readFrames(reader, (f) => f.some((x) => x.includes("event: employee.state")));
    const frame = live.find((x) => x.includes("event: employee.state"));
    expect(frame, "live event delivered over SSE").toBeTruthy();
    const data = JSON.parse(frame!.split("\ndata: ")[1]!);
    expect(data.companyId).toBe(cid);
    expect(data.payload.state).toBe("THINKING");

    ac.abort();
    reader.releaseLock();
  });

  it("other tenants cannot open the stream", async () => {
    const other = await makeUser("sse_other");
    users.push(other.id);
    actAs(other);
    const r = await call(stream.GET, { params: { cid } });
    expect(r.status).toBe(403);
    actAs(user);
  });
});
