/**
 * Local runner job execution (apps/runner/src/execute.ts) against a fake
 * Agentopia server: env runners never take subscription jobs, a lost lease
 * stops the run without reporting, and event batches are bounded, retried and
 * never sent concurrently. No real CLI or provider is called.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Logger } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProviderSettingsSchema } from "../../packages/shared/src/settings";
import type { ProviderAdapter, ExecutionResult } from "../../packages/core/src/providers/types";
import { emptyUsage } from "../../packages/core/src/providers/types";
import type { RunnerEventItem, RunnerJob } from "../../packages/core/src/runner/protocol";
import { RunnerEventsInput } from "../../packages/core/src/runner/protocol";
import { executeJob, planExecution } from "../../apps/runner/src/execute";

const TMP = mkdtempSync(path.join(tmpdir(), "agentopia-runner-exec-"));
process.env.AGENTOPIA_WORKSPACE_ROOT = path.join(TMP, "workspaces");

const noop = () => undefined;
const log = { child: () => log, info: noop, warn: noop, error: noop, debug: noop } as unknown as Logger;

const job = (over: Partial<RunnerJob> = {}): RunnerJob => ({
  executionSessionId: "sess1",
  companyId: "comp1",
  taskId: "t",
  employeeId: "e",
  projectId: null,
  attempt: 1,
  provider: "ANTHROPIC",
  model: null,
  systemPrompt: "",
  taskBrief: "brief",
  memoryContext: "",
  settings: ProviderSettingsSchema.parse({ autoApprove: true }),
  secret: null,
  authMode: "SUBSCRIPTION_CLI",
  resumeSessionId: null,
  timeoutSec: 30,
  costCapUsd: 1,
  ...over,
});

type Handler = (req: IncomingMessage, body: unknown) => { status: number; json?: unknown } | Promise<{ status: number; json?: unknown }>;
let server: Server;
let base = "";
let handler: Handler = () => ({ status: 404 });

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += String(d)));
    req.on("end", () => {
      void (async () => {
        const out = await handler(req, raw ? JSON.parse(raw) : undefined);
        res.writeHead(out.status, { "content-type": "application/json" });
        res.end(out.json === undefined ? "" : JSON.stringify(out.json));
      })();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(TMP, { recursive: true, force: true });
});

const ok = (): ExecutionResult => ({ status: "SUCCEEDED", summary: "done", usage: emptyUsage(), artifacts: [] });
const adapterOf = (run: ProviderAdapter["run"]): ProviderAdapter => ({ kind: "ANTHROPIC", verify: async () => ({ ok: true, status: "VERIFIED" }), listModels: async () => [], run });

describe("env runner never runs subscription jobs on the machine key", () => {
  it("refuses SUBSCRIPTION_CLI jobs even when an env key is present; API_KEY jobs use the env key", () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-machine";
    try {
      expect(planExecution(job(), "env")).toEqual({ kind: "refuse", errorKind: "UNSUPPORTED", error: "Subscription connection: start the runner with --auth subscription" });
      expect(planExecution(job({ authMode: "API_KEY" }), "env")).toEqual({ kind: "key", authMode: "API_KEY", secret: "sk-ant-machine" });
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  it("the refusal is reported as UNSUPPORTED without calling the adapter", async () => {
    const completes: unknown[] = [];
    handler = (req, body) => {
      if (req.url?.endsWith("/complete")) completes.push(body);
      return { status: 200, json: { ok: true, cancel: false, approvals: {} } };
    };
    let called = false;
    const status = await executeJob(job(), { client: { server: base, token: "t" }, auth: "env", log, adapterFor: () => adapterOf(async () => ((called = true), ok())) });
    expect(status).toBe("FAILED");
    expect(called).toBe(false);
    expect(completes[0]).toMatchObject({ status: "FAILED", errorKind: "UNSUPPORTED", error: "Subscription connection: start the runner with --auth subscription" });
  });
});

describe("lease lost: the runner stops a job the server already failed or re-queued", () => {
  it("aborts the run on a 409 from the control poll and never posts complete", async () => {
    const paths: string[] = [];
    let started = false;
    handler = (req) => {
      paths.push(`${req.method} ${req.url}`);
      if (req.url?.endsWith("/control")) return started ? { status: 409, json: { error: { message: "Job is FAILED" } } } : { status: 200, json: { cancel: false, approvals: [] } };
      return { status: 200, json: { ok: true, cancel: false, approvals: {} } };
    };
    let reason: unknown = null;
    const adapter = adapterOf(
      (req) =>
        new Promise((resolve) => {
          started = true;
          const done = () => {
            reason = req.signal.reason;
            resolve({ status: "CANCELLED", summary: "", usage: emptyUsage(), artifacts: [] });
          };
          if (req.signal.aborted) done();
          else req.signal.addEventListener("abort", done);
        }),
    );
    const status = await executeJob(job(), { client: { server: base, token: "t" }, auth: "subscription", log, adapterFor: () => adapter, controlPollMs: 20, flushMs: 20 });
    expect(reason).toBe("lease_lost");
    expect(status).toBe("FAILED");
    expect(paths.some((p) => p.endsWith("/complete"))).toBe(false);
  });

  it("a 404 on an event flush aborts as well", async () => {
    const paths: string[] = [];
    handler = (req) => {
      paths.push(`${req.method} ${req.url}`);
      if (req.url?.endsWith("/events")) return { status: 404, json: { error: { message: "gone" } } };
      return { status: 200, json: { cancel: false, approvals: [] } };
    };
    const adapter = adapterOf(async (req, hooks) => {
      await hooks.onEvent({ type: "message", role: "assistant", text: "hi" });
      await new Promise<void>((r) => req.signal.addEventListener("abort", () => r()));
      return { status: "CANCELLED", summary: "", usage: emptyUsage(), artifacts: [] };
    });
    expect(await executeJob(job(), { client: { server: base, token: "t" }, auth: "subscription", log, adapterFor: () => adapter, controlPollMs: 10_000, flushMs: 20 })).toBe("FAILED");
    expect(paths.some((p) => p.endsWith("/complete"))).toBe(false);
  });
});

describe("event batches", () => {
  it("bounds long text, keeps items across transient failures, never flushes concurrently", async () => {
    const received: RunnerEventItem[] = [];
    let failures = 2 * 4; // two full withRetry rounds fail (4 attempts each)
    let inFlight = 0;
    let maxInFlight = 0;
    let complete: Record<string, unknown> | null = null;
    handler = async (req, body) => {
      if (req.url?.endsWith("/complete")) {
        complete = body as Record<string, unknown>;
        return { status: 200, json: { ok: true } };
      }
      if (!req.url?.endsWith("/events")) return { status: 200, json: { cancel: false, approvals: [] } };
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      if (failures > 0) {
        failures -= 1;
        return { status: 503, json: { error: { message: "busy" } } };
      }
      const parsed = RunnerEventsInput.safeParse(body);
      if (!parsed.success) return { status: 400, json: { error: { message: parsed.error.message } } };
      received.push(...parsed.data.items);
      return { status: 200, json: { ok: true, cancel: false, approvals: {} } };
    };
    const adapter = adapterOf(async (_req, hooks) => {
      await hooks.onEvent({ type: "message", role: "assistant", text: "x".repeat(30_000) });
      await hooks.onEvent({ type: "progress", text: "p".repeat(8_000) });
      for (let i = 0; i < 250; i++) await hooks.onEvent({ type: "tool_result", output: `line ${i}` });
      await new Promise((r) => setTimeout(r, 400));
      return ok();
    });
    const status = await executeJob(job(), { client: { server: base, token: "t" }, auth: "subscription", log, adapterFor: () => adapter, controlPollMs: 10_000, flushMs: 5, retryBaseMs: 1 });
    expect(status).toBe("SUCCEEDED");
    expect(maxInFlight).toBe(1);
    // nothing lost despite the transient failures, in order, in valid batches (<= 200 items each)
    expect(received).toHaveLength(252);
    const msg = received[0] as { event: { type: string; text: string } };
    expect(msg.event.type).toBe("message");
    expect(msg.event.text.length).toBeLessThanOrEqual(20_000);
    expect((received[1] as { event: { text: string } }).event.text.length).toBeLessThanOrEqual(5_000);
    expect((received[251] as { event: { output: string } }).event.output).toBe("line 249");
    expect(complete).toMatchObject({ status: "SUCCEEDED" });
  });

  it("clips approval titles to the wire limit", async () => {
    const titles: string[] = [];
    handler = (req, body) => {
      if (req.url?.endsWith("/events")) {
        const parsed = RunnerEventsInput.safeParse(body);
        if (!parsed.success) return { status: 400, json: { error: { message: "invalid" } } };
        for (const it of parsed.data.items) if (it.type === "approval_request") titles.push(it.title);
        return { status: 200, json: { ok: true, cancel: false, approvals: {} } };
      }
      return { status: 200, json: { ok: true, cancel: false, approvals: [] } };
    };
    const adapter = adapterOf(async (_req, hooks) => {
      void hooks.requestApproval({ kind: "TOOL_USE", title: `Allow Bash: ${"a".repeat(1000)}`, payload: {} });
      await new Promise((r) => setTimeout(r, 50));
      return ok();
    });
    const settings = ProviderSettingsSchema.parse({ autoApprove: false });
    await executeJob(job({ settings }), { client: { server: base, token: "t" }, auth: "subscription", log, adapterFor: () => adapter, controlPollMs: 10_000, flushMs: 10, retryBaseMs: 1 });
    expect(titles).toHaveLength(1);
    expect(titles[0]!.length).toBeLessThanOrEqual(300);
  });
});
