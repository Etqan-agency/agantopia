"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FloorView } from "@agentopia/shared";
import type { EventBus } from "./bus";
import { createOfficeScene, type SceneController, type SceneStats } from "./scene";
import { buildBenchView, runBenchmark, type BenchResult } from "./perf";

const LOW_POWER_KEY = "agentopia.office.lowPower";

export function readLowPower(): boolean {
  try {
    return localStorage.getItem(LOW_POWER_KEY) === "1";
  } catch {
    return false;
  }
}

export type CanvasProps = {
  view: FloorView;
  bus: EventBus;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAnnounce: (text: string) => void;
  /** WebGL (or Pixi init) failed: the parent shows the list view. */
  onUnavailable: (error: unknown) => void;
  onStaticView: () => void;
  reducedMotion: boolean;
  speed: number;
  onSpeedChange: (s: number) => void;
  paused: boolean;
  onPausedChange: (p: boolean) => void;
  hud: boolean;
  bench: boolean;
  simulated: boolean;
};

const SPEEDS = [0.5, 1, 2] as const;

/** Mounts the Pixi scene and its toolbar. Client-only (loaded with next/dynamic, ssr: false). */
export function OfficeCanvas(props: CanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const [ready, setReady] = useState(false);
  const [lowPower, setLowPower] = useState(readLowPower);
  const [stats, setStats] = useState<SceneStats | null>(null);
  const [bench, setBench] = useState<{ running: boolean; elapsed: number; result: BenchResult | null }>({ running: props.bench, elapsed: 0, result: null });
  const cb = useRef(props);
  useLayoutEffect(() => {
    cb.current = props;
  });

  // Create the scene once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let scene: SceneController | null = null;
    createOfficeScene(host, {
      lowPower: readLowPower(),
      reducedMotion: cb.current.reducedMotion,
      speed: cb.current.speed,
      onSelect: (id) => cb.current.onSelect(id),
      onAnnounce: (t) => cb.current.onAnnounce(t),
      instrument: cb.current.hud || cb.current.bench,
    })
      .then((s) => {
        if (cancelled) {
          s.destroy();
          return;
        }
        scene = s;
        sceneRef.current = s;
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) cb.current.onUnavailable(err);
      });
    return () => {
      cancelled = true;
      scene?.destroy();
      sceneRef.current = null;
      setReady(false);
    };
  }, []);

  // Load the floor (or the benchmark floor).
  useEffect(() => {
    const s = sceneRef.current;
    if (!ready || !s) return;
    if (props.bench) {
      s.loadFloor(buildBenchView(props.view));
      let alive = true;
      void runBenchmark(s, { lowPower, onSample: (_st, t) => alive && setBench((b) => ({ ...b, elapsed: t })) }).then(
        (result) => alive && setBench({ running: false, elapsed: result.durationMs, result }),
      );
      return () => {
        alive = false;
      };
    }
    s.loadFloor(props.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.view, props.bench]);

  useEffect(() => {
    if (!ready) return;
    return props.bus.subscribe((e) => sceneRef.current?.applyEvent(e));
  }, [ready, props.bus]);

  useEffect(() => {
    if (ready) sceneRef.current?.setSelected(props.selectedId);
  }, [ready, props.selectedId]);
  useEffect(() => {
    if (ready) sceneRef.current?.setReducedMotion(props.reducedMotion);
  }, [ready, props.reducedMotion]);
  useEffect(() => {
    if (ready) sceneRef.current?.setSpeed(props.speed);
  }, [ready, props.speed]);
  useEffect(() => {
    if (!ready) return;
    if (props.paused) sceneRef.current?.pause();
    else sceneRef.current?.resume();
  }, [ready, props.paused]);
  useEffect(() => {
    if (!ready) return;
    sceneRef.current?.setLowPower(lowPower);
    try {
      localStorage.setItem(LOW_POWER_KEY, lowPower ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [ready, lowPower]);

  // Dev HUD.
  useEffect(() => {
    if (!ready || !(props.hud || props.bench)) return;
    const iv = setInterval(() => sceneRef.current && setStats(sceneRef.current.getStats()), 1000);
    return () => clearInterval(iv);
  }, [ready, props.hud, props.bench]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = sceneRef.current;
    if (!s) return;
    const step = 64;
    const map: Record<string, () => void> = {
      ArrowLeft: () => s.panBy(step, 0),
      ArrowRight: () => s.panBy(-step, 0),
      ArrowUp: () => s.panBy(0, step),
      ArrowDown: () => s.panBy(0, -step),
      "+": () => s.zoomBy(1.2),
      "=": () => s.zoomBy(1.2),
      "-": () => s.zoomBy(1 / 1.2),
      "0": () => s.resetView(),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const btn =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-surface-sunken disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-saffron aria-pressed:bg-ink aria-pressed:text-parchment";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div role="toolbar" aria-label="Office view controls" className="flex flex-wrap items-center gap-1 rounded-lg border border-rule bg-surface-raised p-1">
        <button type="button" className={btn} onClick={() => sceneRef.current?.zoomBy(1.2)} aria-label="Zoom in" disabled={!ready}>
          +
        </button>
        <button type="button" className={btn} onClick={() => sceneRef.current?.zoomBy(1 / 1.2)} aria-label="Zoom out" disabled={!ready}>
          −
        </button>
        <button type="button" className={btn} onClick={() => sceneRef.current?.resetView()} disabled={!ready}>
          Fit
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-rule" />
        <button type="button" className={btn} onClick={() => props.onPausedChange(!props.paused)} aria-pressed={props.paused} disabled={!ready}>
          {props.paused ? "Play" : "Pause"}
        </button>
        <span role="group" aria-label="Animation speed" className="flex items-center">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={btn} aria-pressed={props.speed === s} onClick={() => props.onSpeedChange(s)}>
              {s}×
            </button>
          ))}
        </span>
        <span aria-hidden className="mx-1 h-5 w-px bg-rule" />
        <button type="button" className={btn} aria-pressed={lowPower} onClick={() => setLowPower((v) => !v)} title="Caps the frame rate at 30 fps">
          Low power
        </button>
        <button type="button" className={btn} onClick={props.onStaticView}>
          Static view
        </button>
        {props.simulated ? (
          <span className="ml-auto rounded-sm border border-dashed border-saffron px-2 py-0.5 text-xs font-medium text-saffron-ink">Simulated activity</span>
        ) : null}
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Office floor canvas. Arrow keys pan, plus and minus zoom, 0 fits the floor. The list view offers full keyboard access to employees."
        onKeyDown={onKeyDown}
        className={[
          "relative min-h-[420px] flex-1 overflow-hidden rounded-lg bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus",
          props.simulated ? "outline-2 -outline-offset-2 outline-dashed outline-saffron/60" : "border border-rule",
        ].join(" ")}
      >
        <div ref={hostRef} className="absolute inset-0" />
        {!ready ? <p className="absolute inset-0 grid place-items-center text-sm text-fg-muted">Opening the office…</p> : null}
        {(props.hud || props.bench) && stats ? (
          <pre className="pointer-events-none absolute top-2 right-2 z-10 max-w-[min(28rem,90%)] overflow-hidden rounded-md bg-ink/85 px-2 py-1 font-mono text-[11px] leading-snug text-parchment">
            {`fps ${stats.fps}  sprites ${stats.sprites}  draws ${stats.drawCalls ?? "n/a"}  mem ${stats.memoryMB ?? "n/a"}MB  ${stats.running ? "running" : "stopped"}`}
            {props.bench
              ? bench.result
                ? `\nbench ${JSON.stringify({ fps: bench.result.fps, memoryMB: bench.result.memoryMB, drawCalls: bench.result.drawCalls, employees: bench.result.employees })}`
                : `\nbench running… ${Math.round(bench.elapsed / 1000)}s / 20s`
              : ""}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
