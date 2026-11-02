/**
 * Plays the visitor demo script entirely in the browser: no network, no LLM.
 * Every emitted event is marked `simulated: true`.
 */
import { EVENT_TYPES, type EventType, type TaskEvent } from "@agentopia/shared";

export type DemoScriptItem = {
  type: EventType;
  employeeId: string | null;
  taskId?: string | null;
  payload: Record<string, unknown>;
  /** Delay before this item, relative to the previous one (ms at 1× speed). */
  delayMs: number;
  simulated: true;
};

export type Scheduler = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
};

const realScheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

const TYPES = new Set<string>(EVENT_TYPES);

/** Accepts `[...]`, `{ items }`, `{ events }` or `{ script }` and drops malformed items. */
export function normalizeScript(raw: unknown): DemoScriptItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).items ?? (raw as Record<string, unknown>).events ?? (raw as Record<string, unknown>).script)
      : null;
  if (!Array.isArray(list)) return [];
  const out: DemoScriptItem[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.type !== "string" || !TYPES.has(o.type)) continue;
    out.push({
      type: o.type as EventType,
      employeeId: typeof o.employeeId === "string" ? o.employeeId : null,
      taskId: typeof o.taskId === "string" ? o.taskId : null,
      payload: o.payload && typeof o.payload === "object" ? (o.payload as Record<string, unknown>) : {},
      delayMs: typeof o.delayMs === "number" && o.delayMs >= 0 ? o.delayMs : 1000,
      simulated: true,
    });
  }
  return out;
}

export type DemoPlayer = {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  readonly playing: boolean;
};

export function createDemoPlayer(opts: {
  script: DemoScriptItem[];
  companyId: string;
  onEvent: (e: TaskEvent) => void;
  /** Called before each new loop (e.g. to reload the floor projection). */
  onLoop?: (loop: number) => void;
  speed?: number;
  loopGapMs?: number;
  loop?: boolean;
  scheduler?: Scheduler;
}): DemoPlayer {
  const sch = opts.scheduler ?? realScheduler;
  const gap = opts.loopGapMs ?? 4000;
  let speed = opts.speed ?? 1;
  let index = 0;
  let loop = 0;
  let seq = 0;
  let handle: unknown = null;
  let dueAt = 0;
  let remaining = 0; // ms of real time left when paused
  let playing = false;
  let paused = false;

  const clear = () => {
    if (handle !== null) sch.clearTimeout(handle);
    handle = null;
  };

  const schedule = (ms: number) => {
    clear();
    dueAt = sch.now() + ms;
    handle = sch.setTimeout(fire, ms);
  };

  const delayFor = (i: number) => (opts.script[i]?.delayMs ?? 0) / speed;

  function fire() {
    handle = null;
    if (!playing || paused) return;
    if (index >= opts.script.length) {
      if (opts.loop === false) {
        playing = false;
        return;
      }
      loop += 1;
      index = 0;
      opts.onLoop?.(loop);
      schedule(delayFor(0));
      return;
    }
    const it = opts.script[index]!;
    seq += 1;
    opts.onEvent({
      seq,
      id: `demo-${loop}-${index}`,
      companyId: opts.companyId,
      taskId: it.taskId ?? null,
      employeeId: it.employeeId,
      type: it.type,
      payload: it.payload,
      createdAt: new Date(sch.now()).toISOString(),
      simulated: true,
    });
    index += 1;
    schedule(index >= opts.script.length ? gap / speed : delayFor(index));
  }

  return {
    start() {
      if (playing || opts.script.length === 0) return;
      playing = true;
      paused = false;
      schedule(delayFor(0));
    },
    stop() {
      playing = false;
      paused = false;
      clear();
    },
    pause() {
      if (!playing || paused) return;
      paused = true;
      remaining = Math.max(0, dueAt - sch.now());
      clear();
    },
    resume() {
      if (!playing || !paused) return;
      paused = false;
      schedule(remaining);
    },
    setSpeed(next) {
      const s = Math.max(0.1, Math.min(4, next));
      if (s === speed) return;
      const ratio = speed / s;
      speed = s;
      if (paused) remaining *= ratio;
      else if (handle !== null) schedule(Math.max(0, dueAt - sch.now()) * ratio);
    },
    get playing() {
      return playing && !paused;
    },
  };
}
