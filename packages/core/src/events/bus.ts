import { Redis } from "ioredis";
import type { TaskEvent } from "@agentopia/shared";
import { logger } from "../logging";

let client: Redis | null = null;
let subscriber: Redis | null = null;
const handlers = new Map<string, Set<(e: TaskEvent) => void>>();

function redisUrl(): string {
  return process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
}

/** Shared ioredis client for commands/publish (singleton from REDIS_URL). */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(redisUrl(), { maxRetriesPerRequest: null });
    client.on("error", (err) => logger.warn({ err: err.message }, "redis client error"));
  }
  return client;
}

/** Redis pub/sub channel for a company's live events. */
export function companyChannel(companyId: string): string {
  return `events:${companyId}`;
}

function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(redisUrl(), { maxRetriesPerRequest: null });
    subscriber.on("error", (err) => logger.warn({ err: err.message }, "redis subscriber error"));
    subscriber.on("message", (channel: string, message: string) => {
      const set = handlers.get(channel);
      if (!set?.size) return;
      let parsed: TaskEvent;
      try {
        parsed = JSON.parse(message) as TaskEvent;
      } catch {
        return;
      }
      for (const h of set) {
        try {
          h(parsed);
        } catch (err) {
          logger.warn({ err: (err as Error).message }, "event handler threw");
        }
      }
    });
  }
  return subscriber;
}

/**
 * Subscribes to a company's live events over a dedicated (shared) subscriber
 * connection. Returns an unsubscribe function. Persisted replay is the
 * caller's job (query TaskEvent with seq > cursor).
 */
export function subscribeCompanyEvents(companyId: string, handler: (e: TaskEvent) => void): () => void {
  const channel = companyChannel(companyId);
  const sub = getSubscriber();
  let set = handlers.get(channel);
  if (!set) {
    set = new Set();
    handlers.set(channel, set);
    void sub.subscribe(channel).catch((err: Error) => logger.warn({ err: err.message, channel }, "subscribe failed"));
  }
  set.add(handler);
  return () => {
    const s = handlers.get(channel);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) {
      handlers.delete(channel);
      void sub.unsubscribe(channel).catch(() => undefined);
    }
  };
}

/** Publishes already-persisted events (best effort; persistence is the source of truth). */
export async function publishEvents(events: TaskEvent[]): Promise<void> {
  if (!events.length) return;
  try {
    const r = getRedis();
    for (const e of events) await r.publish(companyChannel(e.companyId), JSON.stringify(e));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "event publish failed (clients will catch up via replay)");
  }
}

/** Closes Redis connections (tests, graceful shutdown). */
export async function closeRedis(): Promise<void> {
  const cs = [client, subscriber].filter((c): c is Redis => c !== null);
  client = null;
  subscriber = null;
  handlers.clear();
  await Promise.all(cs.map((c) => c.quit().catch(() => c.disconnect())));
}
