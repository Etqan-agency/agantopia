/**
 * Rate limit keys must not be attacker-chosen: before auth only the client IP
 * (and only behind a trusted proxy) counts; after auth the resolved identity
 * (`u:<userId>` / `r:<runnerId>`) gets its own bucket at the route's tier.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const evalMock = vi.fn(async (..._args: unknown[]) => 1);
vi.mock("./redis", () => ({ getRedis: () => ({ eval: evalMock }) }));

import { clientIp, clientKey, enforceIdentityRateLimit, enforceRateLimit } from "./rate-limit";

const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/x", { headers });
const keys = () => evalMock.mock.calls.map((c) => String(c[2]));

describe("rate limit keys", () => {
  beforeEach(() => {
    evalMock.mockClear();
    evalMock.mockImplementation(async () => 1);
    vi.stubEnv("RATE_LIMIT_IN_TESTS", "1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("ignores cookies, Authorization and forwarding headers without a trusted proxy", () => {
    vi.stubEnv("TRUSTED_PROXY", "");
    const base = clientKey(req());
    expect(clientKey(req({ cookie: "better-auth.session_token=random1" }))).toBe(base);
    expect(clientKey(req({ authorization: "Bearer whatever-the-attacker-wants" }))).toBe(base);
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe(base);
    expect(clientKey(req({ "x-real-ip": "5.6.7.8" }))).toBe(base);
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("uses only the first x-forwarded-for hop behind a trusted proxy", () => {
    vi.stubEnv("TRUSTED_PROXY", "true");
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe(clientKey(req({ "x-forwarded-for": "1.2.3.4, 10.9.9.9" })));
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4" }))).not.toBe(clientKey(req({ "x-forwarded-for": "9.9.9.9" })));
    // Session cookies never change the bucket.
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4", cookie: "better-auth.session_token=a" }))).toBe(clientKey(req({ "x-forwarded-for": "1.2.3.4" })));
  });

  it("charges the IP bucket before auth and the identity bucket after, at the route tier", async () => {
    const r = req();
    await enforceRateLimit(r, "strict");
    await enforceIdentityRateLimit(r, "u:user-1");
    await enforceIdentityRateLimit(r, "u:user-1"); // charged once per request
    expect(keys()).toHaveLength(2);
    expect(keys()[0]).toMatch(/^rl:strict:ip:/);
    expect(keys()[1]).toMatch(/^rl:strict:id:/);
    expect(evalMock.mock.calls[1]![3]).toBe(20); // identity bucket keeps the tier capacity
  });

  it("gives different identities different buckets", async () => {
    const a = req();
    const b = req();
    await enforceRateLimit(a, "default");
    await enforceRateLimit(b, "default");
    await enforceIdentityRateLimit(a, "u:user-1");
    await enforceIdentityRateLimit(b, "r:runner-1");
    const idKeys = keys().filter((k) => k.includes(":id:"));
    expect(idKeys).toHaveLength(2);
    expect(idKeys[0]).not.toBe(idKeys[1]);
  });

  it("rejects with 429 when the identity bucket is empty", async () => {
    const r = req();
    await enforceRateLimit(r, "default");
    evalMock.mockImplementation(async () => 0);
    await expect(enforceIdentityRateLimit(r, "u:user-1")).rejects.toMatchObject({ status: 429 });
  });

  it("skips the identity limit for requests outside route() or with tier none", async () => {
    await enforceIdentityRateLimit(req(), "u:user-1");
    const r = req();
    await enforceRateLimit(r, "none");
    await enforceIdentityRateLimit(r, "u:user-1");
    expect(evalMock).not.toHaveBeenCalled();
  });
});
