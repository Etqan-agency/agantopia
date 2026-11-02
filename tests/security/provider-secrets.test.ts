/**
 * Provider credentials: the plaintext key and the ciphertext never appear in any
 * API response, and `verify` stores INVALID (sanitized) for a rejected key
 * without throwing. The provider adapter is stubbed: no network, no paid calls.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const SECRET = "sk-ant-api03-TESTSECRETdoNotLeak1234567890abcdef";
const ROTATED = "sk-ant-api03-ROTATEDsecretAlsoMustNotLeakZZZZ9876";
const verifyMock = vi.fn();

vi.mock("../../apps/web/src/server/core", async (orig) => {
  const real = await orig<typeof import("../../apps/web/src/server/core")>();
  return {
    ...real,
    syncScheduleToQueue: vi.fn(async () => undefined),
    getProviderAdapter: vi.fn(async () => ({ verify: verifyMock, listModels: vi.fn(async () => []) })),
  };
});

import { actAs, call, cleanupUsers, makeUser, prisma } from "../../apps/web/src/server/test-utils";
import { createCompany } from "../../apps/web/src/server/services/companies";
import * as providers from "../../apps/web/src/app/api/companies/[cid]/providers/route";
import * as provider from "../../apps/web/src/app/api/companies/[cid]/providers/[pid]/route";
import * as verify from "../../apps/web/src/app/api/companies/[cid]/providers/[pid]/verify/route";
import * as employee from "../../apps/web/src/app/api/companies/[cid]/employees/[eid]/route";
import { sanitizeProviderError } from "../../apps/web/src/server/services/providers";

const users: string[] = [];
const bodies: string[] = [];
let cid: string;
let managerId: string;
let owner: Awaited<ReturnType<typeof makeUser>>;

function record(r: { text: string }) {
  bodies.push(r.text);
  return r;
}

beforeAll(async () => {
  owner = await makeUser("prov");
  users.push(owner.id);
  const c = await createCompany(owner.id, { name: "Secret Co", timezone: "UTC" });
  cid = c.company.id;
  managerId = c.managerId;
  actAs(owner);
});

afterAll(async () => {
  actAs(null);
  await cleanupUsers(users);
});

describe("provider secrets", () => {
  let pid: string;

  it("create returns last-4 only and stores ciphertext", async () => {
    const r = record(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "ANTHROPIC", authMode: "API_KEY", acknowledgeSeparateBilling: true, label: "Claude", apiKey: SECRET } }));
    expect(r.status).toBe(201);
    pid = r.json.id;
    expect(r.json.secretLast4).toBe(SECRET.slice(-4));
    expect(r.json.hasSecret).toBe(true);
    expect(r.json).not.toHaveProperty("encryptedSecret");
    const row = await prisma.providerConnection.findUniqueOrThrow({ where: { id: pid } });
    expect(row.encryptedSecret).toBeTruthy();
    expect(row.encryptedSecret).not.toContain(SECRET);
  });

  it("API mode requires a key", async () => {
    const r = record(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "OPENAI", mode: "API", label: "No key" } }));
    expect(r.status).toBe(400);
  });

  it("verify with an invalid key stores INVALID with a sanitized error, without throwing", async () => {
    verifyMock.mockResolvedValueOnce({ ok: false, status: "INVALID", message: `401 invalid x-api-key ${SECRET}` });
    const r = record(await call(verify.POST, { method: "POST", params: { cid, pid } }));
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("INVALID");
    expect(r.json.error).toBeTruthy();
    expect(r.json.error).not.toContain(SECRET);
    const row = await prisma.providerConnection.findUniqueOrThrow({ where: { id: pid } });
    expect(row.status).toBe("INVALID");
    expect(row.verifyError ?? "").not.toContain(SECRET);
  });

  it("verify survives an adapter that throws", async () => {
    verifyMock.mockRejectedValueOnce(new Error(`network error while using key ${SECRET}`));
    const r = record(await call(verify.POST, { method: "POST", params: { cid, pid } }));
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("INVALID");
  });

  it("verify success stores models; rotate resets to UNVERIFIED", async () => {
    verifyMock.mockResolvedValueOnce({ ok: true, status: "VERIFIED", models: ["claude-test-1"] });
    const v = record(await call(verify.POST, { method: "POST", params: { cid, pid } }));
    expect(v.json.status).toBe("VERIFIED");
    expect(v.json.models).toEqual(["claude-test-1"]);
    const list = record(await call(providers.GET, { params: { cid } }));
    expect(list.json.items[0].models).toEqual(["claude-test-1"]);
    const rot = record(await call(provider.PATCH, { method: "PATCH", params: { cid, pid }, body: { apiKey: ROTATED } }));
    expect(rot.json.status).toBe("UNVERIFIED");
    expect(rot.json.secretLast4).toBe(ROTATED.slice(-4));
  });

  it("employee detail with a provider attached exposes no secret", async () => {
    await prisma.employee.update({ where: { id: managerId }, data: { providerConnectionId: pid } });
    record(await call(employee.GET, { params: { cid, eid: managerId } }));
  });

  it("revoke clears the secret", async () => {
    const r = record(await call(provider.DELETE, { method: "DELETE", params: { cid, pid } }));
    expect(r.json.status).toBe("REVOKED");
    expect(r.json.hasSecret).toBe(false);
    const row = await prisma.providerConnection.findUniqueOrThrow({ where: { id: pid } });
    expect(row.encryptedSecret).toBeNull();
  });

  it("no response body ever contained the key or its ciphertext", async () => {
    const row = await prisma.providerConnection.findFirst({ where: { companyId: cid } });
    expect(bodies.length).toBeGreaterThan(5);
    for (const b of bodies) {
      expect(b).not.toContain(SECRET);
      expect(b).not.toContain(ROTATED);
      expect(b).not.toContain("encryptedSecret");
      expect(b).not.toMatch(/v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:/); // AES-GCM envelope format
      if (row?.encryptedSecret) expect(b).not.toContain(row.encryptedSecret);
    }
  });

  it("sanitizer strips key-like tokens", () => {
    expect(sanitizeProviderError("bad key sk-proj-abcdefghijklmnop", null)).not.toContain("abcdefghijklmnop");
    expect(sanitizeProviderError("Authorization: Bearer abc.def.ghi", null)).not.toContain("abc.def.ghi");
  });
});
