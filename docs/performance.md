# Office scene performance

Measured on 2026-11-01 by the office-scene agent. Every number below was
produced by the procedure in this file; nothing is estimated.

## What is measured

`?bench=1` on `/office` or `/demo` (implemented in
`apps/web/src/office/perf.ts`):

1. Loads the current floor plus **40 idle + 8 working synthetic employees**.
   The 8 working employees get synthetic desks in the lounge, so their lamps
   are on and they run the typing loop. The 40 idle employees stand on
   lounge, shared-space and corridor tiles.
2. Samples `scene.getStats()` once per second for **20 s**. The first 1.5 s
   are skipped as warm-up. Each sample records:
   - FPS: `app.ticker.FPS`.
   - Sprite count.
   - Draw calls per frame. These are counted by wrapping
     `gl.drawElements`, `gl.drawArrays` and the instanced variants, and only
     when the HUD or bench is on.
   - `performance.memory.usedJSHeapSize` (Chromium only; enabled with
     `--enable-precise-memory-info`).
3. Prints one JSON line `[office-bench] {...}` to the console, stores it in
   `window.__officeBench`, and shows a summary in the HUD.

`?hud=1` shows the same live stats without the synthetic load.

## Procedure (reproducible)

```bash
cd apps/web && npx next dev -p 3200          # one dev server per app dir (Next 16)
# Playwright 1.64.1, bundled Chromium 156 (HeadlessChrome/156.0.8078.4)
# viewport 1440x900, deviceScaleFactor 2, headless
#   software run: default flags  → WebGL on SwiftShader
#   GPU run:      --enable-gpu --use-angle=metal --ignore-gpu-blocklist
# both runs add --enable-precise-memory-info
# open http://localhost:3200/demo?mock=1&bench=1, wait for window.__officeBench
```

The floor is `/demo?mock=1`, Floor 1: the default 40×24 layout, 7 rooms and
8 mock employees playing the local mock script during the run. With the
synthetic load that is 56 employees and 1,697 sprites. Machine: Apple M1 Pro,
10 cores, macOS.

## Results

| Renderer (as reported by `WEBGL_debug_renderer_info`) | FPS avg | FPS min | FPS p10 | FPS max | Draw calls / frame | JS heap start → end (peak) |
| --- | --- | --- | --- | --- | --- | --- |
| ANGLE Metal, Apple M1 Pro (headless Chromium, GPU flags) | 60.0 | 59.5 | 59.9 | 60.2 | 1 | 32.0 → 30.6 MB (37.2) |
| SwiftShader software WebGL (headless Chromium, default flags) | 30.9 | 12 | 15 | 60.2 | 1 | 30.5 → 29.4 MB (42.5) |

Notes:

- **Batching is verified.** The whole floor (tiles, walls, furniture, lamps
  with glow, 56 characters × 6 layered sprites, icons) renders in a single
  WebGL draw call per frame. Every texture is a sub-frame of the single
  procedurally generated atlas (`atlas.ts`, 131 frames, 512 logical px wide,
  rendered at resolution 2).
- The GPU run hits the 60 fps cap (`ticker.maxFPS = 60`) with no drops.
- The SwiftShader numbers are a worst case: the whole renderer runs on the
  CPU, as it would on a machine whose GPU is blocklisted.
- The heap stays flat during the run (it ends lower than it starts), so the
  steady-state loop shows no growth. A longer soak test has not been run.
- **Unmeasured:** low-power mode (30 fps cap), headed/foreground browsers,
  Firefox and Safari, mobile devices, and GPU memory (not exposed to JS).

## Design choices that keep it cheap

These follow docs/integrations-research.md §4:

- One `Application` with `sharedTicker: false` and `autoStart: false`. The
  ticker stops when the tab is hidden or the canvas is off-screen
  (IntersectionObserver), and when the user pauses. While paused, frames are
  rendered on demand only.
- No filters, masks, `Text` objects or per-frame `Graphics` work. Lamps,
  icons, offline desaturation (tint) and animation frames are texture swaps
  or tint changes.
- Name labels are HTML. They are repositioned only when a sprite moves or
  the camera pans or zooms.
- FSM ticks run only for employees with a running timer. Paths are computed
  once per walk (A* over at most 960 tiles).

## QA run (2026-11-01, Playwright e2e)

Run by the QA agent with `apps/web/e2e/10-performance.spec.ts`: it opens
`/demo?mock=1&bench=1` in the Playwright "Desktop Chrome" device with the
viewport forced to 1440x900, deviceScaleFactor 1, headless, **default flags**
(no GPU flags and no `--enable-precise-memory-info`), and reads the
`[office-bench]` console line. The page reported its renderer as
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)`,
i.e. software WebGL. Chromium 156.0.8078.4, Apple M1 Pro (10 cores).
The dev server (Turbopack, `next dev`) and the worker were running on the same
machine. Raw JSON of the last run: `test-results/perf/office-bench.json`.

| Run (time UTC) | Conditions | Employees | Sprites | Draw calls / frame | FPS avg | FPS min | FPS p10 | FPS max | JS heap start / end / peak |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 21:22:48 | spec run on its own | 56 | 1,697 | 1 | 24.2 | 12 | 12 | 60.2 | 31.6 / 31.6 / 31.6 MB |
| 21:30:43 | last spec of a full e2e run | 56 | 1,697 | 1 | 19.5 | 7.5 | 10 | 60.2 | 35.6 / 35.6 / 35.6 MB |
| 21:42:17 | last spec of a full e2e run, while another agent was editing app files (Turbopack recompiling) | 56 | 1,697 | 1 | 15.6 | 3.5 | 8.6 | 30 | 31.6 / 31.6 / 31.6 MB |

Notes:

- These are software-rendering (SwiftShader) numbers on a machine that was
  also running the dev server; they are lower than the SwiftShader row above
  (30.9 avg), and they vary run to run with background load.
- The heap figures are flat because `performance.memory` is coarse without
  `--enable-precise-memory-info`; they show no growth but are not precise.
- Batching held: 1 draw call per frame in all three runs.
- Not measured in this QA run: GPU-accelerated Chromium, low-power mode,
  other browsers.
