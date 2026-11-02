import { redisPrefix } from "../env";
import { getRedis } from "../events/bus";

const ACQUIRE = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZSCORE', KEYS[1], ARGV[3]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  return 1
end
if redis.call('ZCARD', KEYS[1]) < tonumber(ARGV[4]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return 1
end
return 0`;

function key(companyId: string): string {
  return `${redisPrefix()}:sem:exec:${companyId}`;
}

/**
 * Per-company execution semaphore (Redis sorted set of holder → expiry).
 * Holders expire after `ttlMs` unless refreshed, so a crashed worker cannot
 * leak slots. Returns true if the slot was acquired (or is already held).
 */
export async function acquireExecutionSlot(companyId: string, holder: string, max: number, ttlMs = 60_000): Promise<boolean> {
  const now = Date.now();
  const res = await getRedis().eval(ACQUIRE, 1, key(companyId), String(now), String(now + ttlMs), holder, String(max), String(ttlMs * 2));
  return Number(res) === 1;
}

/** Extends a held slot's expiry (call from the heartbeat). */
export async function refreshExecutionSlot(companyId: string, holder: string, ttlMs = 60_000): Promise<void> {
  await getRedis().zadd(key(companyId), "XX", Date.now() + ttlMs, holder);
}

/** Releases a slot. */
export async function releaseExecutionSlot(companyId: string, holder: string): Promise<void> {
  await getRedis().zrem(key(companyId), holder);
}
