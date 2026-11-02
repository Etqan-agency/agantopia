import { createHash } from "node:crypto";
import { getRedis } from "./redis";
import { tooManyRequests } from "./errors";

export type RateLimitTier = "default" | "strict" | "none";

/** Token bucket per (tier, caller). default: 120/min, strict: 20/min. */
const TIERS: Record<Exclude<RateLimitTier, "none">, { capacity: number; perMinute: number }> = {
  default: { capacity: 120, perMinute: 120 },
  strict: { capacity: 20, perMinute: 20 },
};

/**
 * The pre-auth IP bucket is shared by everyone behind one address (NAT, a
 * browser plus a local runner, or every caller when no trusted proxy is
 * configured), so it gets this multiple of the tier. The per-identity bucket
 * enforced after authentication uses the tier as is.
 */
const IP_BUCKET_MULTIPLIER = 5;

const LUA = `
local key = KEYS[1]
local cap = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local d = redis.call('HMGET', key, 't', 'ts')
local t = tonumber(d[1]) or cap
local ts = tonumber(d[2]) or now
t = math.min(cap, t + (now - ts) * rate)
local ok = 0
if t >= 1 then t = t - 1; ok = 1 end
redis.call('HSET', key, 't', t, 'ts', now)
redis.call('PEXPIRE', key, 120000)
return ok
`;

/** Forwarding headers are only honored behind a trusted reverse proxy (TRUSTED_PROXY=true). */
export function trustedProxy(): boolean {
  const v = (process.env.TRUSTED_PROXY ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

/**
 * The client address, or null when it cannot be known. Without a trusted
 * proxy any forwarding header is caller-controlled, so none is read.
 */
export function clientIp(req: Request): string | null {
  if (!trustedProxy()) return null;
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = req.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

/** Pre-auth bucket key: the client IP only (never cookies or Authorization, which the caller chooses freely). */
export function clientKey(req: Request): string {
  return `ip:${hash(clientIp(req) ?? "unknown")}`;
}

function rateLimitActive(): boolean {
  return !(process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_IN_TESTS !== "1");
}

async function take(key: string, capacity: number, perMinute: number): Promise<void> {
  let ok: unknown = 1;
  try {
    ok = await getRedis().eval(LUA, 1, key, capacity, perMinute / 60000, Date.now());
  } catch {
    return; // fail open when Redis is unavailable
  }
  if (Number(ok) !== 1) throw tooManyRequests(60);
}

/** Tier chosen by `route()` for each request, so the identity limit after auth uses the same tier. */
const requestTier = new WeakMap<Request, Exclude<RateLimitTier, "none">>();
/** Identities already charged for a request (requireSession may run more than once per request). */
const charged = new WeakMap<Request, Set<string>>();

/** Pre-auth limit, keyed by client IP. Called by `route()` for every API request. */
export async function enforceRateLimit(req: Request, tier: RateLimitTier): Promise<void> {
  if (tier === "none") return;
  requestTier.set(req, tier);
  if (!rateLimitActive()) return;
  const cfg = TIERS[tier];
  await take(`rl:${tier}:${clientKey(req)}`, cfg.capacity * IP_BUCKET_MULTIPLIER, cfg.perMinute * IP_BUCKET_MULTIPLIER);
}

/**
 * Post-auth limit keyed on the resolved identity (`u:<userId>` or `r:<runnerId>`),
 * using the tier `route()` assigned to this request. No-op for requests that did
 * not go through a rate-limited `route()`.
 */
export async function enforceIdentityRateLimit(req: Request, identity: string): Promise<void> {
  const tier = requestTier.get(req);
  if (!tier) return;
  const done = charged.get(req) ?? new Set<string>();
  if (done.has(identity)) return;
  done.add(identity);
  charged.set(req, done);
  if (!rateLimitActive()) return;
  const cfg = TIERS[tier];
  await take(`rl:${tier}:id:${hash(identity)}`, cfg.capacity, cfg.perMinute);
}
