import { Redis } from "ioredis";

declare global {
  var __agentopiaWebRedis: Redis | undefined;
}

/** Lazily-created shared Redis client for the web process (rate limiting). */
export function getRedis(): Redis {
  if (!globalThis.__agentopiaWebRedis) {
    globalThis.__agentopiaWebRedis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6380", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    globalThis.__agentopiaWebRedis.on("error", () => {
      /* rate limiting fails open; errors are surfaced by health checks, not per request */
    });
  }
  return globalThis.__agentopiaWebRedis;
}
