import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const OUT = resolve(__dirname, "../../../test-results/perf/office-bench.json");

test.describe("Performance", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("office benchmark on /demo?mock=1&bench=1 (headless, no GPU flags)", async ({ page }) => {
    test.setTimeout(90_000);
    const lines: string[] = [];
    page.on("console", (m) => {
      if (m.text().startsWith("[office-bench]")) lines.push(m.text());
    });
    await page.goto("/demo?mock=1&bench=1");
    await expect.poll(() => lines.length, { timeout: 60_000, intervals: [1000] }).toBeGreaterThan(0);
    const result = JSON.parse(lines[0]!.replace(/^\[office-bench\]\s*/, "")) as {
      kind: string;
      durationMs: number;
      employees: number;
      sprites: number;
      drawCalls: number | null;
      fps: { avg: number; min: number; max: number; p10: number };
      memoryMB: { start: number | null; end: number | null; peak: number | null };
    };
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
      if (!gl) return "no WebGL";
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    });
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), renderer, ...result }, null, 2));
    test.info().annotations.push({ type: "office-bench", description: JSON.stringify({ renderer, fps: result.fps, drawCalls: result.drawCalls, employees: result.employees, sprites: result.sprites, memoryMB: result.memoryMB }) });
    expect(result.kind).toBe("agentopia-office-bench");
    expect(result.employees).toBeGreaterThanOrEqual(48);
    expect(result.fps.avg).toBeGreaterThan(0);
  });
});
