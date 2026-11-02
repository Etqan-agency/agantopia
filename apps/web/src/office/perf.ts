/**
 * `?bench=1`: spawns 40 idle + 8 working synthetic employees on the current
 * floor, samples FPS and memory for 20 s and reports JSON (console + HUD).
 */
import type { DeskView, EmployeeView, FloorView } from "@agentopia/shared";
import type { SceneController, SceneStats } from "./scene";

export const BENCH_IDLE = 40;
export const BENCH_WORKING = 8;
export const BENCH_DURATION_MS = 20000;

const PALETTES = ["moss", "brick", "sky", "saffron", "ink", "plum"];

/** Clone `view`, add 8 desks (in the lounge, or the largest room) and 48 synthetic employees. */
export function buildBenchView(view: FloorView): FloorView {
  const rooms = view.rooms.map((r) => ({ ...r, desks: [...r.desks] }));
  const host = rooms.find((r) => r.kind === "LOUNGE") ?? [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const employees: EmployeeView[] = [];
  const mk = (i: number, working: boolean, deskId: string | null): EmployeeView => ({
    id: `bench-${working ? "w" : "i"}-${i}`,
    name: `${working ? "Worker" : "Idle"} ${i + 1}`,
    title: "Synthetic",
    specialty: "BACKEND",
    role: "EMPLOYEE",
    rank: "JUNIOR",
    status: "ACTIVE",
    visualState: working ? "WORKING" : "IDLE",
    avatar: { palette: PALETTES[i % PALETTES.length]!, hair: i * 3, skin: i },
    deskId,
    currentTaskId: working ? `bench-task-${i}` : null,
    provider: "SIMULATED",
  });
  for (let i = 0; i < BENCH_WORKING; i++) {
    let deskId: string | null = null;
    if (host && host.w >= 6 && host.h >= 4) {
      const cols = Math.max(1, Math.floor((host.w - 4) / 4));
      const x = host.x + 2 + (i % cols) * 4;
      const y = host.y + 2 + Math.floor(i / cols) * 3 + 1;
      if (y < host.y + host.h - 1) {
        const desk: DeskView = { id: `bench-desk-${i}`, x, y, facing: "down", employeeId: `bench-w-${i}` };
        host.desks.push(desk);
        deskId = desk.id;
      }
    }
    employees.push(mk(i, true, deskId));
  }
  for (let i = 0; i < BENCH_IDLE; i++) employees.push(mk(i, false, null));
  return { ...view, rooms, employees: [...view.employees, ...employees] };
}

export type BenchResult = {
  kind: "agentopia-office-bench";
  durationMs: number;
  employees: number;
  sprites: number;
  drawCalls: number | null;
  fps: { avg: number; min: number; max: number; p10: number };
  memoryMB: { start: number | null; end: number | null; peak: number | null };
  samples: Array<{ t: number; fps: number; memoryMB: number | null }>;
  env: { userAgent: string; devicePixelRatio: number; viewport: string; lowPower: boolean; hardwareConcurrency: number | null };
};

export function runBenchmark(
  scene: SceneController,
  opts: { durationMs?: number; lowPower: boolean; onSample?: (s: SceneStats, elapsedMs: number) => void },
): Promise<BenchResult> {
  const duration = opts.durationMs ?? BENCH_DURATION_MS;
  const samples: BenchResult["samples"] = [];
  const t0 = performance.now();
  const startMem = scene.getStats().memoryMB ?? null;
  let peak = startMem;
  let lastDraws: number | null = null;
  return new Promise((resolve) => {
    const iv = setInterval(() => {
      const s = scene.getStats();
      const t = Math.round(performance.now() - t0);
      // Skip the first sample: FPS is still warming up.
      if (t > 1500) samples.push({ t, fps: s.fps, memoryMB: s.memoryMB ?? null });
      if (s.memoryMB !== undefined) peak = Math.max(peak ?? 0, s.memoryMB);
      if (s.drawCalls !== undefined) lastDraws = s.drawCalls;
      opts.onSample?.(s, t);
      if (t >= duration) {
        clearInterval(iv);
        const fps = samples.map((x) => x.fps).sort((a, b) => a - b);
        const avg = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
        const end = scene.getStats();
        const result: BenchResult = {
          kind: "agentopia-office-bench",
          durationMs: t,
          employees: end.employees,
          sprites: end.sprites,
          drawCalls: lastDraws,
          fps: {
            avg: Math.round(avg * 10) / 10,
            min: fps[0] ?? 0,
            max: fps[fps.length - 1] ?? 0,
            p10: fps[Math.floor(fps.length * 0.1)] ?? 0,
          },
          memoryMB: { start: startMem, end: end.memoryMB ?? null, peak },
          samples,
          env: {
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            lowPower: opts.lowPower,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null,
          },
        };
        console.info("[office-bench]", JSON.stringify(result));
        (window as unknown as { __officeBench?: BenchResult }).__officeBench = result;
        resolve(result);
      }
    }, 1000);
  });
}
