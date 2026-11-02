#!/usr/bin/env -S npx tsx
/**
 * agentopia-runner: executes LOCAL_RUNNER jobs on the user's own machine.
 *   agentopia-runner --server http://localhost:3000 --token <runner token> [--auth subscription|env] [--workspace-root ./runner-workspaces]
 * Default --auth subscription: your own, unmodified Claude Code / Codex CLI with your own sign-in (`cli` is an alias).
 * See docs/local-runner.md.
 */
import { hostname } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { pino } from "pino";
import { loggerOptions } from "@agentopia/core/logging";
import { RunnerClaimResponseSchema, type RunnerCapabilities, type RunnerHeartbeatResponse } from "@agentopia/core/runner/protocol";
import { detectTools, type DetectedTools } from "./detect";
import { executeJob } from "./execute";
import { HttpError, request, type ClientOptions } from "./http";

const VERSION = "0.1.0";
const HEARTBEAT_MS = 30_000;
const IDLE_POLL_MS = 5_000;

const DETECT_MS = 5 * 60_000;

const SUBSCRIPTION_NOTICE = `
--auth subscription (default): jobs run through YOUR OWN, unmodified Claude Code / Codex CLI on this machine,
signed in with YOUR OWN account (Claude: run \`claude\` and /login; Codex: \`codex login\`). Usage counts against
your own plan's limits. Agentopia never reads, copies, stores or sends your credentials; provider API keys are
removed from the CLI environment so nothing is billed per token. When a plan limit is reached, tasks wait for the
reset (no paid fallback). Terms basis and what is unsupported: docs/integrations-research.md §1.3 and §7,
  https://code.claude.com/docs/en/legal-and-compliance
  https://support.claude.com/en/articles/15036540
See docs/local-runner.md.
`;

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}\n`);
  console.error("usage: agentopia-runner --server <url> --token <runner token> [--auth subscription|env] [--workspace-root <dir>] [--once]");
  process.exit(msg ? 2 : 0);
}

// Tolerate a leading "--" (e.g. `pnpm runner -- --token ...`).
const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === "--" ? argv.slice(1) : argv,
  options: {
    server: { type: "string", default: process.env.AGENTOPIA_SERVER ?? "http://localhost:3000" },
    token: { type: "string", default: process.env.AGENTOPIA_RUNNER_TOKEN },
    auth: { type: "string", default: "subscription" },
    "workspace-root": { type: "string", default: "./runner-workspaces" },
    once: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});
if (values.help) usage();
if (!values.token) usage("--token is required (or set AGENTOPIA_RUNNER_TOKEN)");
if (values.auth !== "env" && values.auth !== "cli" && values.auth !== "subscription") usage("--auth must be subscription (default) or env");
const auth: "subscription" | "env" = values.auth === "env" ? "env" : "subscription";

const log = pino(loggerOptions({ name: "runner", level: process.env.LOG_LEVEL ?? "info" }));
const client: ClientOptions = { server: values.server!, token: values.token };
process.env.AGENTOPIA_WORKSPACE_ROOT = path.resolve(values["workspace-root"]!);

if (auth === "subscription") {
  console.log(SUBSCRIPTION_NOTICE);
  const had = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CODEX_API_KEY"].filter((k) => process.env[k]);
  if (had.length) log.warn({ removed: had }, "subscription mode: provider API keys from this shell are ignored (removed from the CLI environment)");
  // Make sure no key from the shell leaks into a run that is meant to use the local CLI login.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.OPENAI_API_KEY;
  delete process.env.CODEX_API_KEY;
} else {
  const have = [process.env.ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY", (process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY) && "OPENAI_API_KEY"].filter(Boolean);
  if (!have.length) log.warn("--auth env but no ANTHROPIC_API_KEY / OPENAI_API_KEY set; jobs without a server-provided key will fail");
}

let tools: DetectedTools = await detectTools(auth);
let capabilities: RunnerCapabilities = { providers: ["ANTHROPIC", "OPENAI"], auth, version: VERSION, hostname: hostname().slice(0, 120), tools, detectedAt: new Date().toISOString() };
function logDetection() {
  for (const [name, t] of Object.entries(tools)) {
    log.info({ tool: name, installed: t.installed, path: t.path, version: t.version, bundled: t.bundled ?? false, auth: t.auth, authMethod: t.authMethod, executionAvailable: t.executionAvailable, reason: t.reason }, `detected ${name}`);
  }
}
logDetection();
async function redetect(): Promise<void> {
  const next = await detectTools(auth);
  const changed = JSON.stringify(next) !== JSON.stringify(tools);
  tools = next;
  capabilities = { ...capabilities, tools, detectedAt: new Date().toISOString() };
  if (changed) {
    logDetection();
    await heartbeat().catch((e: Error) => setOnline(false, e.message));
  }
}

let online: boolean | null = null;
function setOnline(next: boolean, detail?: string) {
  if (online === next) return;
  online = next;
  if (next) log.info({ server: client.server }, "ONLINE: connected to Agentopia");
  else log.warn({ server: client.server, detail }, "OFFLINE: cannot reach Agentopia; retrying with backoff");
}

async function heartbeat(): Promise<void> {
  const res = await request<RunnerHeartbeatResponse>(client, "POST", "/api/runner/heartbeat", { capabilities });
  setOnline(true);
  log.debug({ runnerId: res.runnerId }, "heartbeat ok");
}

let stopping = false;
let backoffMs = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      if (online !== true) await heartbeat();
      const raw = await request<unknown>(client, "POST", "/api/runner/jobs/claim", { capabilities });
      setOnline(true);
      backoffMs = 1000;
      const { job } = RunnerClaimResponseSchema.parse(raw ?? { job: null });
      if (job) {
        await executeJob(job, { client, auth, tools, log });
        if (values.once) return;
        continue;
      }
      if (values.once) return;
      await sleep(IDLE_POLL_MS);
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        log.error("the server rejected this runner token (revoked or wrong company); stopping");
        process.exit(1);
      }
      setOnline(false, (err as Error).message);
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 60_000);
    }
  }
}

const hb = setInterval(() => void heartbeat().catch((e: Error) => setOnline(false, e.message)), HEARTBEAT_MS);
const det = setInterval(() => void redetect().catch((e: Error) => log.warn({ err: e.message }, "re-detection failed")), DETECT_MS);
const stop = (sig: string) => {
  if (stopping) process.exit(1);
  stopping = true;
  clearInterval(hb);
  clearInterval(det);
  log.info({ signal: sig }, "stopping after the current job (press Ctrl+C again to force)");
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

log.info({ server: client.server, auth, workspaceRoot: process.env.AGENTOPIA_WORKSPACE_ROOT, version: VERSION }, "Agentopia local runner starting");
await loop();
clearInterval(hb);
clearInterval(det);
process.exit(0);
