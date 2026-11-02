import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const RUN = randomBytes(4).toString("hex");
const PREFIX = `agentopia-test-boot-${RUN}`;
const here = path.dirname(fileURLToPath(import.meta.url));

afterAll(async () => {
  process.env.AGENTOPIA_REDIS_PREFIX = PREFIX;
  const core = await import("@agentopia/core");
  await core.obliterateQueues().catch(() => undefined);
  await core.closeQueues();
  await core.closeRedis();
});

describe("worker", () => {
  it("boots (execution, manager, learning, maintenance incl. limit/runner-offline release) and shuts down cleanly", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: path.resolve(here, ".."),
      env: { ...process.env, AGENTOPIA_REDIS_PREFIX: PREFIX, NODE_ENV: "production", LOG_LEVEL: "info" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.stderr.on("data", (d) => (out += String(d)));
    const started = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 25_000);
      const check = () => {
        if (out.includes("Agentopia worker started")) {
          clearTimeout(t);
          resolve(true);
        }
      };
      child.stdout.on("data", check);
      child.on("exit", () => {
        clearTimeout(t);
        resolve(false);
      });
    });
    expect(started, out.slice(-2000)).toBe(true);
    const code = await new Promise<number | null>((resolve) => {
      child.on("exit", (c) => resolve(c));
      child.kill("SIGTERM");
    });
    expect(code).toBe(0);
  }, 40_000);
});
