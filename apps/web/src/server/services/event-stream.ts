/**
 * SSE for company events: replay persisted rows with seq > after (batches of
 * 500), then live events from the Redis bus (or DB polling if the bus is not
 * available). Live events that arrive during replay are buffered.
 *
 * Seqs are allocated before commit, so rows can become visible out of seq
 * order. Dedupe therefore uses a bounded set of recently delivered seqs rather
 * than a high-water mark, and DB polling re-reads a trailing window below the
 * highest delivered seq to pick up late commits. Events at or below the
 * client's Last-Event-ID (`after`) are never re-sent.
 * 15 s heartbeat comments; cleanup on client abort.
 */
import { prisma } from "@agentopia/db";
import type { TaskEventView } from "../../lib/api-types";
import { subscribeCompanyEvents } from "../core";
import { toEventView } from "./views";

const BATCH = 500;
const HEARTBEAT_MS = 15_000;
const POLL_MS = 2_000;
/** How many recently delivered seqs are remembered for dedupe. */
const SEEN_MAX = 1000;
/** Polling re-reads this many seqs below the highest delivered one (late commits). */
const POLL_WINDOW = 200;

export function sseFrame(e: TaskEventView): string {
  return `id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
}

function normalize(e: unknown): TaskEventView | null {
  if (!e || typeof e !== "object") return null;
  const r = e as Record<string, unknown>;
  if (r.seq === undefined || typeof r.type !== "string" || typeof r.id !== "string") return null;
  return toEventView({
    seq: typeof r.seq === "bigint" ? r.seq : Number(r.seq),
    id: r.id,
    companyId: String(r.companyId ?? ""),
    taskId: (r.taskId as string | null) ?? null,
    employeeId: (r.employeeId as string | null) ?? null,
    type: r.type,
    payload: r.payload,
    createdAt: r.createdAt instanceof Date ? r.createdAt : String(r.createdAt ?? new Date().toISOString()),
  });
}

export async function openCompanyEventStream(companyId: string, after: number, signal: AbortSignal): Promise<Response> {
  const encoder = new TextEncoder();
  let lastSeq = after;
  const seen = new Set<number>();
  const seenOrder: number[] = [];
  let replaying = true;
  let closed = false;
  const buffer: TaskEventView[] = [];
  const timers: Array<ReturnType<typeof setInterval>> = [];
  let unsub: (() => void) | null = null;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const write = (s: string) => {
    if (closed || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(s));
    } catch {
      cleanup();
    }
  };
  const deliver = (e: TaskEventView) => {
    if (e.companyId && e.companyId !== companyId) return;
    if (e.seq <= after || seen.has(e.seq)) return;
    seen.add(e.seq);
    seenOrder.push(e.seq);
    if (seenOrder.length > SEEN_MAX) seen.delete(seenOrder.shift()!);
    if (e.seq > lastSeq) lastSeq = e.seq;
    write(sseFrame(e));
  };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    for (const t of timers) clearInterval(t);
    try {
      unsub?.();
    } catch {
      /* ignore */
    }
    try {
      controllerRef?.close();
    } catch {
      /* already closed */
    }
  };

  /** Deliver persisted rows with seq > fromSeq (in batches); already delivered seqs are skipped. */
  const replayFrom = async (fromSeq: number) => {
    let cursor = fromSeq;
    for (;;) {
      const rows = await prisma.taskEvent.findMany({ where: { companyId, seq: { gt: BigInt(cursor) } }, orderBy: { seq: "asc" }, take: BATCH });
      for (const r of rows) deliver(toEventView(r));
      if (rows.length < BATCH || closed) break;
      cursor = Number(rows[rows.length - 1]!.seq);
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controllerRef = controller;
      if (signal.aborted) return cleanup();
      signal.addEventListener("abort", cleanup, { once: true });
      write(`retry: 3000\n: connected\n\n`);
      try {
        unsub = await subscribeCompanyEvents(companyId, (raw) => {
          const e = normalize(raw);
          if (!e) return;
          if (replaying) buffer.push(e);
          else deliver(e);
        });
        if (closed) {
          // The client went away while we were subscribing: cleanup() ran before unsub existed.
          unsub?.();
          unsub = null;
          return;
        }
        await replayFrom(lastSeq);
        if (closed) return;
        replaying = false;
        buffer.sort((a, b) => a.seq - b.seq).forEach(deliver);
        buffer.length = 0;
        if (!unsub) {
          let polling = false;
          timers.push(
            setInterval(() => {
              if (polling || closed) return;
              polling = true;
              replayFrom(Math.max(after, lastSeq - POLL_WINDOW))
                .catch(() => undefined)
                .finally(() => (polling = false));
            }, POLL_MS),
          );
        }
        timers.push(setInterval(() => write(`: heartbeat ${Date.now()}\n\n`), HEARTBEAT_MS));
      } catch (err) {
        console.error("[sse] stream setup failed", err instanceof Error ? err.message : err);
        write(`event: error\ndata: {"message":"stream setup failed"}\n\n`);
        cleanup();
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
