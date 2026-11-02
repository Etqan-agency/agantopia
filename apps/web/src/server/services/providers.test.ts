/**
 * Subscription-first provider connections: auth modes, the separate-billing
 * acknowledgement, the status endpoint and reconnect. No provider is called:
 * core is stubbed where it would touch the network or the bus.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProviderStatusView } from "@agentopia/shared";

const { statusCoreMock, emitMock } = vi.hoisted(() => ({
  statusCoreMock: vi.fn<(companyId: string) => Promise<unknown[] | null>>(),
  emitMock: vi.fn<(input: unknown) => Promise<undefined>>(async () => undefined),
}));

vi.mock("../core", async (orig) => {
  const real = await orig<typeof import("../core")>();
  statusCoreMock.mockImplementation(real.getProviderStatusesCore); // real core unless a test overrides it
  return {
    ...real,
    syncScheduleToQueue: vi.fn(async () => undefined),
    enqueueManagerReview: vi.fn(async () => undefined),
    emitEvent: emitMock,
    getProviderStatusesCore: statusCoreMock,
    getProviderAdapter: vi.fn(async () => {
      throw new Error("no provider must be called in this suite");
    }),
  };
});

import { actAs, call, cleanupUsers, makeUser, prisma } from "../test-utils";
import { createCompany } from "./companies";
import { deriveStatusesLocally, isLimitActive, limitResetSentence, OK_LIMIT } from "./provider-status";
import * as providers from "../../app/api/companies/[cid]/providers/route";
import * as provider from "../../app/api/companies/[cid]/providers/[pid]/route";
import * as status from "../../app/api/companies/[cid]/providers/status/route";
import * as reconnect from "../../app/api/companies/[cid]/providers/[pid]/reconnect/route";
import * as runners from "../../app/api/companies/[cid]/runners/route";
import * as task from "../../app/api/companies/[cid]/tasks/[tid]/route";
import * as usage from "../../app/api/companies/[cid]/usage/route";

const KEY = "sk-ant-api03-SUBSCRIPTIONsuiteSecretDoNotLeak0042";
const users: string[] = [];
const bodies: string[] = [];
let cid: string;
let managerId: string;

function rec<T extends { text: string }>(r: T) {
  bodies.push(r.text);
  return r;
}

beforeAll(async () => {
  const owner = await makeUser("subs");
  users.push(owner.id);
  const c = await createCompany(owner.id, { name: "Subscription Co", timezone: "UTC" });
  cid = c.company.id;
  managerId = c.managerId;
  actAs(owner);
});

afterAll(async () => {
  actAs(null);
  await cleanupUsers(users);
});

const byProvider = (items: ProviderStatusView[], p: "ANTHROPIC" | "OPENAI") => items.find((s) => s.provider === p)!;

describe("provider auth modes", () => {
  it("an API key connection without the separate-billing acknowledgement is refused (400)", async () => {
    const r = rec(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "ANTHROPIC", authMode: "API_KEY", label: "Key", apiKey: KEY } }));
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("separate_billing_not_acknowledged");
    const legacy = rec(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "OPENAI", mode: "API", label: "Legacy", apiKey: KEY } }));
    expect(legacy.status).toBe(400);
    expect(legacy.json.error.code).toBe("separate_billing_not_acknowledged");
    expect(await prisma.providerConnection.count({ where: { companyId: cid } })).toBe(0);
  });

  it("a subscription connection stores no secret and derives mode LOCAL_RUNNER", async () => {
    const r = rec(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "ANTHROPIC", label: "Claude Code (subscription)" } }));
    expect(r.status).toBe(201);
    expect(r.json.authMode).toBe("SUBSCRIPTION_CLI");
    expect(r.json.mode).toBe("LOCAL_RUNNER");
    expect(r.json.hasSecret).toBe(false);
    expect(r.json.secretLast4).toBeNull();
    expect(r.json.authMethodLabel).toMatch(/Claude plan via the unmodified Claude Code CLI/);
    const row = await prisma.providerConnection.findUniqueOrThrow({ where: { id: r.json.id } });
    expect(row.encryptedSecret).toBeNull();
    expect(row.authMode).toBe("SUBSCRIPTION_CLI");
    expect(await prisma.auditLog.count({ where: { companyId: cid, action: "provider.create", entityId: r.json.id } })).toBe(1);
  });

  it("any key makes it an API key connection (acknowledgement required), and a second subscription for the same provider conflicts", async () => {
    const withKey = rec(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "OPENAI", authMode: "SUBSCRIPTION_CLI", label: "Codex", apiKey: KEY } }));
    expect(withKey.status).toBe(400);
    expect(withKey.json.error.code).toBe("separate_billing_not_acknowledged");
    expect(await prisma.providerConnection.count({ where: { companyId: cid, provider: "OPENAI" } })).toBe(0);
    const dup = rec(await call(providers.POST, { method: "POST", params: { cid }, body: { provider: "ANTHROPIC", label: "Again" } }));
    expect(dup.status).toBe(409);
  });

  it("an acknowledged API key connection is created (billed separately); switching auth mode needs the acknowledgement too", async () => {
    const r = rec(
      await call(providers.POST, {
        method: "POST",
        params: { cid },
        body: { provider: "OPENAI", authMode: "API_KEY", acknowledgeSeparateBilling: true, label: "OpenAI key", apiKey: KEY },
      }),
    );
    expect(r.status).toBe(201);
    expect(r.json.mode).toBe("API");
    expect(r.json.authMode).toBe("API_KEY");
    expect(r.json.authMethodLabel).toBe("API key (billed separately)");

    const sub = (await prisma.providerConnection.findFirstOrThrow({ where: { companyId: cid, provider: "ANTHROPIC" } })).id;
    const noAck = rec(await call(provider.PATCH, { method: "PATCH", params: { cid, pid: sub }, body: { authMode: "API_KEY", apiKey: KEY } }));
    expect(noAck.status).toBe(400);
    expect(noAck.json.error.code).toBe("separate_billing_not_acknowledged");
    expect((await prisma.providerConnection.findUniqueOrThrow({ where: { id: sub } })).authMode).toBe("SUBSCRIPTION_CLI");

    const list = rec(await call(providers.GET, { params: { cid } }));
    for (const c of list.json.items) {
      expect(c).toHaveProperty("authMode");
      expect(c).toHaveProperty("authMethodLabel");
      expect(c).not.toHaveProperty("encryptedSecret");
    }
  });
});

describe("provider status", () => {
  it("returns one ProviderStatusView per provider (local derivation while core has none)", async () => {
    statusCoreMock.mockResolvedValueOnce(null);
    const r = rec(await call(status.GET, { params: { cid } }));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json)).toBe(true);
    expect(r.json.map((s: ProviderStatusView) => s.provider).sort()).toEqual(["ANTHROPIC", "OPENAI"]);
    const claude = byProvider(r.json, "ANTHROPIC");
    expect(claude.displayName).toBe("Claude Code");
    expect(claude.status).toBe("RUNNER_OFFLINE");
    expect(claude.statusLabel).toBe("Runner offline");
    expect(claude.authMode).toBe("SUBSCRIPTION_CLI");
    expect(claude.runner).toBeNull();
    expect(claude.limit.kind).toBe("OK");
    expect(claude.usage).toEqual({ kind: "unavailable", note: "Usage details unavailable from provider." });
    for (const k of ["detail", "authMethodLabel", "connectionId", "activeExecutions", "waitingTasks"]) expect(claude).toHaveProperty(k);
    const codex = byProvider(r.json, "OPENAI");
    expect(codex.authMode).toBe("API_KEY");
    expect(["CONNECTED", "READY"]).toContain(codex.status);
  });

  it("passes core's statuses through when core provides them", async () => {
    const fixture = [{ provider: "ANTHROPIC", displayName: "Claude Code", status: "READY", statusLabel: "Ready" }];
    statusCoreMock.mockResolvedValueOnce(fixture);
    const r = await call(status.GET, { params: { cid } });
    expect(r.json).toEqual(fixture);
  });

  it("reflects runner capabilities and limits; runners list exposes display-safe capabilities", async () => {
    const created = await call(runners.POST, { method: "POST", params: { cid }, body: { name: "Studio laptop" } });
    const runnerId = created.json.runner.id;
    await prisma.runner.update({
      where: { id: runnerId },
      data: {
        status: "ONLINE",
        lastSeenAt: new Date(),
        capabilities: {
          providers: ["ANTHROPIC", "OPENAI"], auth: "subscription", version: "0.2.0", detectedAt: new Date().toISOString(),
          tools: {
            claude: { installed: true, version: "2.1.0", auth: "logged_in", executionAvailable: true, secretish: "x" },
            codex: { installed: false, auth: "unknown", executionAvailable: false },
          },
        },
      },
    });
    const list = rec(await call(runners.GET, { params: { cid } }));
    const caps = list.json.items[0].capabilities;
    expect(caps.auth).toBe("subscription");
    expect(caps.tools.claude).toMatchObject({ installed: true, version: "2.1.0", auth: "logged_in" });
    expect(caps.tools.claude).not.toHaveProperty("secretish");

    let r = await call(status.GET, { params: { cid } });
    expect(byProvider(r.json, "ANTHROPIC").status).toBe("READY");
    expect(byProvider(r.json, "ANTHROPIC").runner).toMatchObject({ name: "Studio laptop", status: "ONLINE" });

    // Core stores its own backoff in retryAfterAt (source "classified") when the provider reports no time.
    const backoff = new Date(Date.now() + 5 * 60_000);
    await prisma.providerLimitState.create({
      data: { companyId: cid, provider: "ANTHROPIC", kind: "USAGE_LIMIT", message: "Claude usage limit reached", source: "classified", retryAfterAt: backoff, lastErrorAt: new Date() },
    });
    r = rec(await call(status.GET, { params: { cid } }));
    const claude = byProvider(r.json, "ANTHROPIC");
    expect(claude.status).toBe("USAGE_LIMIT_REACHED");
    expect(claude.limit).toMatchObject({ kind: "USAGE_LIMIT", resetAt: null });
    expect(claude.limit.source).toBe("classified");
    expect(claude.detail).not.toContain("reported by the provider");
    expect(JSON.stringify(claude)).not.toMatch(/%/);

    const u = rec(await call(usage.GET, { params: { cid } }));
    expect(u.json.subscription).toEqual({ note: "Usage details unavailable from provider." });
    expect(u.json.subscriptionQuota).toBe("unavailable");
    expect(u.json.providerLimits.find((p: { provider: string }) => p.provider === "ANTHROPIC")).toMatchObject({ limited: true, limit: { kind: "USAGE_LIMIT" } });
  });

  it("task detail exposes limitRetries, the latest errorKind and the provider limit", async () => {
    const conn = await prisma.providerConnection.findFirstOrThrow({ where: { companyId: cid, provider: "ANTHROPIC" } });
    await prisma.employee.update({ where: { id: managerId }, data: { providerConnectionId: conn.id } });
    const t = await prisma.task.create({
      data: { companyId: cid, title: "parked", description: "waiting", status: "WAITING_FOR_PROVIDER_LIMIT", assigneeId: managerId, limitRetries: 2 },
    });
    await prisma.executionSession.create({
      data: { companyId: cid, taskId: t.id, employeeId: managerId, attempt: 1, provider: "anthropic", mode: "LOCAL_RUNNER", status: "FAILED", errorKind: "USAGE_LIMIT" },
    });
    const r = rec(await call(task.GET, { params: { cid, tid: t.id } }));
    expect(r.status).toBe(200);
    expect(r.json.limitRetries).toBe(2);
    expect(r.json.maxLimitRetries).toBe(5);
    expect(r.json.latestErrorKind).toBe("USAGE_LIMIT");
    expect(r.json.executions[0].errorKind).toBe("USAGE_LIMIT");
    expect(r.json.providerLimit).toMatchObject({ provider: "ANTHROPIC", displayName: "Claude Code", limited: true, limit: { kind: "USAGE_LIMIT" } });

    const s = await call(status.GET, { params: { cid } });
    expect(byProvider(s.json, "ANTHROPIC")).toMatchObject({ status: "WAITING_FOR_RESET", waitingTasks: 1 });
  });

  it("reconnect clears AUTH_EXPIRED only when the runner reports the CLI signed in, and never logs in itself", async () => {
    await prisma.providerLimitState.update({ where: { companyId_provider: { companyId: cid, provider: "ANTHROPIC" } }, data: { kind: "AUTH_EXPIRED", message: "Please run /login" } });
    const pid = (await prisma.providerConnection.findFirstOrThrow({ where: { companyId: cid, provider: "ANTHROPIC" } })).id;
    const runner = await prisma.runner.findFirstOrThrow({ where: { companyId: cid } });
    const caps = runner.capabilities as Record<string, Record<string, Record<string, unknown>>>;

    await prisma.runner.update({ where: { id: runner.id }, data: { capabilities: { ...caps, tools: { ...caps.tools, claude: { ...caps.tools!.claude, auth: "not_logged_in" } } } } });
    let r = rec(await call(reconnect.POST, { method: "POST", params: { cid, pid } }));
    expect(r.status).toBe(200);
    expect(r.json.cleared).toBe(false);
    expect(r.json.instructions).toContain("/login");
    expect(r.json.status.status).toBe("AUTHENTICATION_EXPIRED");

    await prisma.runner.update({ where: { id: runner.id }, data: { capabilities: caps as object } });
    r = rec(await call(reconnect.POST, { method: "POST", params: { cid, pid } }));
    expect(r.json.cleared).toBe(true);
    expect(r.json.status.limit.kind).toBe("OK");
    expect(await prisma.taskEvent.count({ where: { companyId: cid, type: "provider.limit_cleared" } })).toBeGreaterThan(0);
  });

  it("fallback derivation (core unavailable): fresh heartbeat is ready, a stale one is runner offline", async () => {
    expect(byProvider(await deriveStatusesLocally(cid), "ANTHROPIC").status).toBe("READY");
    const later = byProvider(await deriveStatusesLocally(cid, Date.now() + 10 * 60_000), "ANTHROPIC");
    expect(later.status).toBe("RUNNER_OFFLINE");
    expect(later.runner?.status).toBe("OFFLINE");
  });

  it("fallback derivation: a CLI that is not installed is unsupported, a signed-out CLI needs sign-in", async () => {
    const runner = await prisma.runner.findFirstOrThrow({ where: { companyId: cid } });
    const caps = runner.capabilities as Record<string, Record<string, Record<string, unknown>>>;
    const withClaude = (claude: Record<string, unknown>) => ({ ...caps, tools: { ...caps.tools, claude: { ...caps.tools!.claude, ...claude } } }) as object;
    await prisma.runner.update({ where: { id: runner.id }, data: { capabilities: withClaude({ installed: false, executionAvailable: false }) } });
    expect(byProvider(await deriveStatusesLocally(cid), "ANTHROPIC").status).toBe("UNSUPPORTED");
    await prisma.runner.update({ where: { id: runner.id }, data: { capabilities: withClaude({ auth: "not_logged_in" }) } });
    expect(byProvider(await deriveStatusesLocally(cid), "ANTHROPIC").status).toBe("AUTHENTICATION_EXPIRED");
    await prisma.runner.update({ where: { id: runner.id }, data: { capabilities: caps as object } });
  });

  it("no response body contained the API key", () => {
    expect(bodies.length).toBeGreaterThan(8);
    for (const b of bodies) {
      expect(b).not.toContain(KEY);
      expect(b).not.toContain("encryptedSecret");
    }
  });
});

describe("status rules", () => {
  it("a classified retry time is never presented as provider-reported", () => {
    const at = new Date(Date.now() + 60_000).toISOString();
    expect(limitResetSentence({ resetAt: null, retryAfterAt: at, source: "classified" })).toMatch(/^Reset time not reported by provider\. Agentopia retries automatically/);
    expect(limitResetSentence({ resetAt: at, retryAfterAt: null, source: "provider_reported" })).toMatch(/reported by the provider/);
  });

  it("a usage limit whose reset / retry time is in the past is no longer active", () => {
    expect(isLimitActive({ ...OK_LIMIT, kind: "USAGE_LIMIT", resetAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
    expect(isLimitActive({ ...OK_LIMIT, kind: "USAGE_LIMIT", resetAt: new Date(Date.now() + 60_000).toISOString() })).toBe(true);
    expect(isLimitActive({ ...OK_LIMIT, kind: "USAGE_LIMIT" })).toBe(false); // same rule as core availabilityOf
    expect(isLimitActive({ ...OK_LIMIT, kind: "AUTH_EXPIRED", resetAt: new Date(Date.now() - 1000).toISOString() })).toBe(true);
  });
});
