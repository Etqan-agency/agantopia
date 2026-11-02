/**
 * PixiJS v8 office scene. One Application per page; one procedurally generated
 * atlas; sprite pools keyed by employee id; employees are the only interactive
 * objects. No filters, masks, Text objects or per-frame Graphics mutation.
 * Name labels are HTML elements positioned from sprite coordinates.
 */
import { Application, Container, Rectangle, Sprite, UPDATE_PRIORITY, type FederatedPointerEvent, type Ticker } from "pixi.js";
import type { EmployeeView, FloorView, TaskEvent } from "@agentopia/shared";
import { buildAtlas, bodyKey, floorKey, hairKey, headKey, iconKey, type Atlas, type BodyFrame } from "./atlas";
import { buildFloorPlan, facingBetween, FACING_DELTA, type Facing, type FloorPlan } from "./floor-plan";
import { findPath, type Tile } from "./pathfinding";
import { BLACK, cssHex, cssRgba, DIM_TINT, GOLD, greyOf, resolveAvatar, wallTint, WHITE, type FloorKey } from "./palette";
import { initialState, needsTick, reduce, snapshotCommands, type Anim, type Command, type EmployeeAnimState, type FsmContext, type FsmInput, type IconKind } from "./state-machine";

export type SceneOptions = {
  lowPower: boolean;
  reducedMotion: boolean;
  speed: number;
  onSelect: (employeeId: string | null) => void;
  onAnnounce: (text: string) => void;
  /** Count draw calls per frame (dev HUD / benchmark). */
  instrument?: boolean;
};

export type SceneStats = { fps: number; sprites: number; drawCalls?: number; memoryMB?: number; running: boolean; employees: number };

export type SceneController = {
  loadFloor(view: FloorView): void;
  applyEvent(e: TaskEvent): void;
  setSpeed(speed: number): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  setLowPower(on: boolean): void;
  setReducedMotion(on: boolean): void;
  setSelected(employeeId: string | null): void;
  zoomBy(factor: number): void;
  resetView(): void;
  panBy(dx: number, dy: number): void;
  getStats(): SceneStats;
  destroy(): void;
};

export const TILES_PER_SECOND = 4;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
const TYPING_FRAME_MS = 170;
const SHUFFLE_FRAME_MS = 360;

type Runtime = {
  view: EmployeeView;
  root: Container;
  ring: Sprite;
  body: Sprite;
  head: Sprite;
  hair: Sprite;
  prop: Sprite;
  icon: Sprite;
  label: HTMLDivElement;
  look: ReturnType<typeof resolveAvatar>;
  state: EmployeeAnimState;
  ctx: FsmContext;
  homeTile: Tile;
  homeFacing: Facing;
  tile: Tile;
  facing: Facing;
  /** Pixel offset toward the desk when seated. */
  seatOffset: { x: number; y: number };
  path: Tile[] | null;
  pathIndex: number;
  progress: number;
  walked: number;
  anim: Anim;
  animClock: number;
  animFrame: 0 | 1;
  x: number;
  y: number;
};

type DeskSprites = { lamp: Sprite; employeeId: string | null };

function memoryMB(): number | undefined {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : undefined;
}

export async function createOfficeScene(parent: HTMLElement, opts: SceneOptions): Promise<SceneController> {
  const app = new Application();
  await app.init({
    preference: "webgl",
    antialias: false,
    resolution: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
    autoDensity: true,
    backgroundAlpha: 0,
    sharedTicker: false,
    autoStart: false,
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
  });

  const options = { ...opts };
  const canvas = app.canvas;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  canvas.setAttribute("aria-hidden", "true");
  parent.appendChild(canvas);

  const labelLayer = document.createElement("div");
  labelLayer.setAttribute("aria-hidden", "true");
  Object.assign(labelLayer.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden" } satisfies Partial<CSSStyleDeclaration>);
  parent.appendChild(labelLayer);

  const atlas: Atlas = buildAtlas(app.renderer);
  app.ticker.maxFPS = options.lowPower ? 30 : 60;
  app.ticker.minFPS = 10;

  // --- draw-call instrumentation (opt-in) ----------------------------------
  let drawCounter = 0;
  let lastFrameDraws: number | undefined;
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
  const restoreGl: Array<() => void> = [];
  if (options.instrument && gl) {
    for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const) {
      const orig = (gl as unknown as Record<string, unknown>)[name];
      if (typeof orig !== "function") continue;
      const bound = (orig as (...a: unknown[]) => unknown).bind(gl);
      (gl as unknown as Record<string, unknown>)[name] = (...a: unknown[]) => {
        drawCounter++;
        return bound(...a);
      };
      restoreGl.push(() => ((gl as unknown as Record<string, unknown>)[name] = orig));
    }
  }

  // --- scene graph -----------------------------------------------------------
  const world = new Container({ label: "world" });
  app.stage.addChild(world);
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  let floorRoot: Container | null = null;
  let objects: Container | null = null;
  let plan: FloorPlan | null = null;
  let view: FloorView | null = null;
  let staticSprites = 0;
  const employees = new Map<string, Runtime>();
  const pool = new Map<string, Runtime>();
  const desks = new Map<string, DeskSprites>();
  let selectedId: string | null = null;
  let paused = false;
  let docHidden = typeof document !== "undefined" ? document.hidden : false;
  let onScreen = true;
  let destroyed = false;
  let running = false;
  let labelsDirty = true;
  const dirtyLabels = new Set<Runtime>();
  let renderQueued = false;

  const T = () => plan?.tileSize ?? 32;

  function feet(tile: Tile): { x: number; y: number } {
    const t = T();
    return { x: (tile.x + 0.5) * t, y: (tile.y + 1) * t - 5 };
  }

  // --- running state ---------------------------------------------------------
  function updateRunning() {
    if (destroyed) return;
    const shouldRun = !paused && !docHidden && onScreen;
    if (shouldRun && !running) {
      app.start();
      running = true;
    } else if (!shouldRun && running) {
      app.stop();
      running = false;
    }
    if (!shouldRun) requestRender();
  }

  /** Render a single frame while the ticker is stopped (paused but visible). */
  function requestRender() {
    if (running || destroyed || renderQueued || docHidden || !onScreen) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      if (destroyed || running) return;
      flushLabels();
      app.renderer.render(app.stage);
    });
  }

  const onVisibility = () => {
    docHidden = document.hidden;
    updateRunning();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          for (const e of entries) onScreen = e.isIntersecting;
          updateRunning();
        })
      : null;
  io?.observe(canvas);

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          const w = Math.max(1, parent.clientWidth);
          const h = Math.max(1, parent.clientHeight);
          if (w === app.screen.width && h === app.screen.height) return;
          app.renderer.resize(w, h);
          // Until the person pans or zooms, keep the floor fitted to the (possibly late-settling) canvas size.
          if (autoFit) resetView();
          else clampWorld();
          markAllLabels();
          requestRender();
        })
      : null;
  ro?.observe(parent);

  // --- camera ---------------------------------------------------------------
  /** True while the camera shows the automatic fit; any manual pan/zoom clears it. */
  let autoFit = true;
  function floorSize() {
    const t = T();
    return { w: (plan?.width ?? 40) * t, h: (plan?.height ?? 24) * t };
  }

  function clampWorld() {
    const { w, h } = floorSize();
    const s = world.scale.x;
    const sw = app.screen.width;
    const sh = app.screen.height;
    const margin = 0.25;
    const minX = Math.min(sw * margin - w * s, (sw - w * s) / 2);
    const maxX = Math.max(sw * (1 - margin), (sw - w * s) / 2);
    const minY = Math.min(sh * margin - h * s, (sh - h * s) / 2);
    const maxY = Math.max(sh * (1 - margin), (sh - h * s) / 2);
    world.x = Math.min(maxX, Math.max(minX, world.x));
    world.y = Math.min(maxY, Math.max(minY, world.y));
  }

  function setZoom(next: number, cx: number, cy: number) {
    const s0 = world.scale.x;
    const s1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (s1 === s0) return;
    autoFit = false;
    const wx = (cx - world.x) / s0;
    const wy = (cy - world.y) / s0;
    world.scale.set(s1);
    world.x = cx - wx * s1;
    world.y = cy - wy * s1;
    clampWorld();
    markAllLabels();
    requestRender();
  }

  function resetView() {
    const { w, h } = floorSize();
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((app.screen.width - 24) / w, (app.screen.height - 24) / h)));
    world.scale.set(s);
    world.x = (app.screen.width - w * s) / 2;
    world.y = (app.screen.height - h * s) / 2;
    autoFit = true;
    markAllLabels();
    requestRender();
  }

  // Drag to pan.
  let drag: { x: number; y: number; wx: number; wy: number; moved: boolean } | null = null;
  let lastDragMoved = false;
  app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
    drag = { x: e.global.x, y: e.global.y, wx: world.x, wy: world.y, moved: false };
    lastDragMoved = false;
  });
  app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
    if (!drag) return;
    const dx = e.global.x - drag.x;
    const dy = e.global.y - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    drag.moved = true;
    autoFit = false;
    canvas.style.cursor = "grabbing";
    world.x = drag.wx + dx;
    world.y = drag.wy + dy;
    clampWorld();
    markAllLabels();
    requestRender();
  });
  const endDrag = () => {
    if (!drag) return;
    lastDragMoved = drag.moved;
    drag = null;
    canvas.style.cursor = "";
  };
  app.stage.on("pointerup", endDrag);
  app.stage.on("pointerupoutside", endDrag);
  app.stage.on("pointertap", (e: FederatedPointerEvent) => {
    if (lastDragMoved) return;
    if (e.target === app.stage || e.target === world) setSelected(null, true);
  });

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
    setZoom(world.scale.x * factor, ev.clientX - rect.left, ev.clientY - rect.top);
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // --- labels ---------------------------------------------------------------
  function markAllLabels() {
    labelsDirty = true;
  }

  function placeLabel(r: Runtime) {
    const s = world.scale.x;
    const sx = world.x + r.x * s;
    const sy = world.y + (r.y + 3) * s;
    r.label.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, 0)`;
    const sel = r.view.id === selectedId;
    // Labels show at every allowed zoom (like the demo); below 0.45 only the selection keeps one.
    r.label.style.display = s < 0.45 && !sel ? "none" : "block";
    // Zoomed out, neighbouring desks (4 tiles apart) get close: cap labels to that pitch so names do not overlap.
    r.label.style.maxWidth = sel || s >= 0.6 ? "none" : `${Math.max(56, Math.round(4 * T() * s))}px`;
  }

  function flushLabels() {
    if (labelsDirty) {
      for (const r of employees.values()) placeLabel(r);
      labelsDirty = false;
      dirtyLabels.clear();
    } else if (dirtyLabels.size) {
      for (const r of dirtyLabels) placeLabel(r);
      dirtyLabels.clear();
    }
  }

  function styleLabel(r: Runtime) {
    const sel = r.view.id === selectedId;
    Object.assign(r.label.style, {
      background: sel ? cssHex(GOLD) : cssRgba(BLACK, 0.85),
      color: sel ? cssHex(BLACK) : cssHex(WHITE),
      fontWeight: sel ? "600" : "500",
      opacity: r.state.desaturated ? "0.6" : "1",
    } satisfies Partial<CSSStyleDeclaration>);
  }

  // --- floor building -------------------------------------------------------
  function sprite(name: string, x: number, y: number, ax = 0, ay = 0): Sprite {
    const s = new Sprite(atlas.get(name));
    s.anchor.set(ax, ay);
    s.position.set(x, y);
    return s;
  }

  function buildFloor(v: FloorView, p: FloorPlan): { root: Container; objects: Container; count: number } {
    const t = p.tileSize;
    const root = new Container({ label: "floor" });
    const ground = new Container({ label: "ground" });
    ground.eventMode = "none";
    ground.interactiveChildren = false;
    const objs = new Container({ label: "objects" });
    objs.sortableChildren = true;
    objs.eventMode = "passive";
    root.addChild(ground, objs);
    let count = 0;
    const scale = t / 32;

    const kinds = p.roomKinds;
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const r = p.roomAt[y * p.width + x]!;
        const kind: FloorKey = r >= 0 ? kinds[r]! : "CORRIDOR";
        const s = sprite(floorKey(kind, ((x + y) & 1) as 0 | 1), x * t, y * t);
        s.scale.set(scale);
        ground.addChild(s);
        count++;
      }
    }
    for (const w of p.walls) {
      const s = sprite("wall", w.x * t, w.y * t);
      s.scale.set(scale);
      s.tint = wallTint(kinds[w.room] ?? "CORRIDOR");
      ground.addChild(s);
      count++;
    }
    for (const d of p.doors) {
      const s = sprite("door", d.x * t, d.y * t);
      s.scale.set(scale);
      ground.addChild(s);
      count++;
    }
    for (const d of p.decor) {
      if (d.wall) {
        const s = sprite(d.kind, d.x * t, d.y * t);
        s.scale.set(scale);
        ground.addChild(s);
      } else {
        const s = sprite(d.kind, (d.x + 0.5) * t, (d.y + 1) * t, 0.5, 1);
        s.scale.set(scale);
        s.zIndex = (d.y + 1) * t;
        s.eventMode = "none";
        objs.addChild(s);
      }
      count++;
    }
    for (const d of p.desks) {
      const deskBottom = (d.y + 1) * t;
      const desk = sprite(`desk:${d.facing}`, (d.x + 0.5) * t, deskBottom, 0.5, 1);
      desk.scale.set(scale);
      desk.zIndex = deskBottom - 2;
      desk.eventMode = "none";
      const seat = p.seats.get(d.id)!;
      const chairPos = feet(seat.tile);
      const chair = sprite("chair", chairPos.x, chairPos.y + 3, 0.5, 1);
      chair.scale.set(scale);
      chair.zIndex = chairPos.y - 6;
      chair.eventMode = "none";
      // Monitor and lamp sit on the desk top.
      const cx = (d.x + 0.5) * t;
      const cy = (d.y + 0.5) * t;
      const mon = sprite(`monitor:${d.facing}`, cx + (d.facing === "up" || d.facing === "down" ? 3 : 0), cy - 3, 0.5, 0.5);
      mon.scale.set(scale);
      mon.zIndex = deskBottom - 1;
      mon.eventMode = "none";
      const lampOffset = d.facing === "up" || d.facing === "down" ? { x: -9, y: -6 } : { x: 0, y: -9 };
      const lamp = sprite("lamp:off", cx + lampOffset.x * scale, cy + lampOffset.y * scale, 0.5, 0.5);
      lamp.scale.set(scale * 0.75);
      lamp.zIndex = deskBottom;
      lamp.eventMode = "none";
      objs.addChild(chair, desk, mon, lamp);
      desks.set(d.id, { lamp, employeeId: d.employeeId });
      count += 4;
    }
    void v;
    return { root, objects: objs, count };
  }

  // --- employees ------------------------------------------------------------
  function makeRuntime(e: EmployeeView): Runtime {
    const root = new Container({ label: `employee:${e.id}` });
    const ring = sprite("selection", 0, -1, 0.5, 0.5);
    ring.visible = false;
    const body = sprite(bodyKey(0, "down", "walk0"), 0, 0, 0.5, 1);
    const head = sprite(headKey("down"), 0, -20, 0.5, 0.5);
    const hair = sprite(hairKey(0, "down"), 0, -21, 0.5, 0.5);
    const prop = sprite("folder", 7, -9, 0.5, 0.5);
    prop.visible = false;
    const icon = sprite(iconKey("check"), 0, -39, 0.5, 0.5);
    icon.visible = false;
    root.addChild(ring, body, head, hair, prop, icon);
    root.eventMode = "static";
    root.cursor = "pointer";
    root.interactiveChildren = false;
    root.hitArea = new Rectangle(-12, -33, 24, 36);
    root.on("pointertap", (ev: FederatedPointerEvent) => {
      if (lastDragMoved) return;
      ev.stopPropagation();
      setSelected(e.id, true);
    });
    const label = document.createElement("div");
    Object.assign(label.style, {
      position: "absolute",
      left: "0",
      top: "0",
      padding: "1px 6px",
      borderRadius: "6px",
      font: "500 11px/1.4 Inter, ui-sans-serif, system-ui, sans-serif",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      boxSizing: "border-box",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>);
    label.textContent = e.name;
    labelLayer.appendChild(label);
    const look = resolveAvatar(e.avatar, e.id);
    const state = initialState(e.visualState, { status: e.status, taskId: e.currentTaskId });
    const r: Runtime = {
      view: e,
      root,
      ring,
      body,
      head,
      hair,
      prop,
      icon,
      label,
      look,
      state,
      ctx: { employeeId: e.id, homeDeskId: e.deskId, managerDeskId: null, reducedMotion: options.reducedMotion },
      homeTile: { x: 0, y: 0 },
      homeFacing: "down",
      tile: { x: 0, y: 0 },
      facing: "down",
      seatOffset: { x: 0, y: 0 },
      path: null,
      pathIndex: 0,
      progress: 0,
      walked: 0,
      anim: "idle",
      animClock: 0,
      animFrame: 0,
      x: 0,
      y: 0,
    };
    return r;
  }

  function applyLook(r: Runtime) {
    const { palette, hairStyle, hairColor, skin } = r.look;
    let frame: BodyFrame = "walk0";
    if (r.anim === "walk") frame = r.animFrame ? "walk1" : "walk0";
    else if (r.anim === "typing") frame = options.reducedMotion ? "type" : r.animFrame ? "type" : "walk0";
    else if (r.anim === "shuffle") frame = "type";
    // Seated employees (at their desk, not walking) use the seated frame for typing only.
    r.body.texture = atlas.get(bodyKey(palette, r.facing, frame));
    r.head.texture = atlas.get(headKey(r.facing));
    r.hair.texture = atlas.get(hairKey(hairStyle, r.facing));
    const bob = r.anim === "walk" && r.animFrame ? -1 : 0;
    const slump = r.anim === "slump";
    const headY = -20 + bob + (slump ? 3 : 0);
    const tilt = slump ? (r.facing === "left" ? -0.3 : 0.3) : 0;
    r.head.position.set(slump ? 1 : 0, headY);
    r.hair.position.set(slump ? 1 : 0, headY - 1);
    r.head.rotation = tilt;
    r.hair.rotation = tilt;
    const shuffleUp = r.anim === "shuffle" && r.animFrame === 1 && !options.reducedMotion ? -2 : 0;
    const side = r.facing === "left" ? -1 : 1;
    r.prop.position.set(r.facing === "up" ? 0 : 7 * side, -9 + shuffleUp);
    r.prop.zIndex = 0;
    const desat = r.state.desaturated;
    r.body.tint = desat ? DIM_TINT : WHITE;
    r.head.tint = desat ? greyOf(skin) : skin;
    r.hair.tint = desat ? greyOf(hairColor) : hairColor;
    r.root.alpha = desat ? 0.7 : 1;
  }

  function setPosition(r: Runtime, x: number, y: number) {
    if (r.x === x && r.y === y) return;
    r.x = x;
    r.y = y;
    r.root.position.set(x, y);
    r.root.zIndex = y;
    dirtyLabels.add(r);
  }

  function placeAt(r: Runtime, tile: Tile, facing: Facing) {
    r.tile = { ...tile };
    r.facing = facing;
    r.path = null;
    const f = feet(tile);
    const atHome = tile.x === r.homeTile.x && tile.y === r.homeTile.y;
    const off = atHome ? r.seatOffset : { x: 0, y: 0 };
    setPosition(r, f.x + off.x, f.y + off.y);
  }

  function lampFor(r: Runtime): Sprite | null {
    return r.view.deskId ? desks.get(r.view.deskId)?.lamp ?? null : null;
  }

  function visitPlacement(deskId: string) {
    return plan?.visits.get(deskId) ?? null;
  }

  function startWalk(r: Runtime, target: Tile, arriveFacing: Facing) {
    if (!plan) return;
    const path = findPath(plan.grid, r.tile, target);
    if (!path || path.length < 2 || options.reducedMotion) {
      placeAt(r, target, arriveFacing);
      queueArrival(r, arriveFacing);
      return;
    }
    r.path = path;
    r.pathIndex = 0;
    r.progress = 0;
    r.walked = 0;
    (r as Runtime & { arriveFacing?: Facing }).arriveFacing = arriveFacing;
    r.facing = facingBetween(path[0]!, path[1]!, r.facing);
    // Leave the seat offset immediately.
    const f = feet(r.tile);
    setPosition(r, f.x, f.y);
  }

  const arrivals: Array<{ r: Runtime; facing: Facing }> = [];
  function queueArrival(r: Runtime, facing: Facing) {
    arrivals.push({ r, facing });
  }

  function exec(r: Runtime, cmds: Command[]) {
    for (const c of cmds) {
      switch (c.type) {
        case "walkTo":
        case "teleport": {
          let tile = r.homeTile;
          let facing = r.homeFacing;
          if (c.target === "visit") {
            const v = visitPlacement(c.deskId);
            if (v) {
              tile = v.tile;
              facing = v.facing;
            }
          }
          if (c.type === "teleport") placeAt(r, tile, facing);
          else startWalk(r, tile, facing);
          break;
        }
        case "lamp": {
          const lamp = lampFor(r);
          if (lamp) lamp.texture = atlas.get(c.on ? "lamp:on" : "lamp:off");
          break;
        }
        case "icon":
          r.icon.visible = c.icon !== null;
          if (c.icon) r.icon.texture = atlas.get(iconKey(c.icon as IconKind));
          break;
        case "anim":
          r.anim = c.anim;
          r.animClock = 0;
          r.animFrame = 0;
          break;
        case "prop":
          r.prop.visible = c.prop === "folder";
          break;
        case "desaturate":
          styleLabel(r);
          break;
      }
    }
    applyLook(r);
  }

  function feed(r: Runtime, input: FsmInput) {
    const res = reduce(r.state, input, r.ctx);
    if (res.state === r.state) return;
    r.state = res.state;
    exec(r, res.commands);
  }

  function drainArrivals() {
    while (arrivals.length) {
      const { r, facing } = arrivals.shift()!;
      r.facing = facing;
      if (r.tile.x === r.homeTile.x && r.tile.y === r.homeTile.y) placeAt(r, r.homeTile, r.homeFacing);
      feed(r, { type: "arrived" });
    }
  }

  // --- ticker ---------------------------------------------------------------
  const update = (ticker: Ticker) => {
    const dt = Math.min(ticker.deltaMS, 100) * options.speed;
    for (const r of employees.values()) {
      if (r.path) {
        r.progress += (dt / 1000) * TILES_PER_SECOND;
        while (r.path && r.progress >= 1) {
          r.progress -= 1;
          r.pathIndex++;
          r.walked++;
          r.tile = { ...r.path[r.pathIndex]! };
          if (r.pathIndex >= r.path.length - 1) {
            const facing = (r as Runtime & { arriveFacing?: Facing }).arriveFacing ?? r.facing;
            r.path = null;
            r.progress = 0;
            placeAt(r, r.tile, facing);
            queueArrival(r, facing);
          } else {
            r.facing = facingBetween(r.path[r.pathIndex]!, r.path[r.pathIndex + 1]!, r.facing);
          }
        }
        if (r.path) {
          const a = feet(r.path[r.pathIndex]!);
          const b = feet(r.path[r.pathIndex + 1]!);
          setPosition(r, a.x + (b.x - a.x) * r.progress, a.y + (b.y - a.y) * r.progress);
          const frame = (Math.floor((r.walked + r.progress) * 2) % 2) as 0 | 1;
          if (frame !== r.animFrame || r.anim !== "walk") {
            r.anim = "walk";
            r.animFrame = frame;
            applyLook(r);
          }
        }
      } else if (!options.reducedMotion && (r.anim === "typing" || r.anim === "shuffle")) {
        r.animClock += dt;
        const period = r.anim === "typing" ? TYPING_FRAME_MS : SHUFFLE_FRAME_MS;
        const frame = (Math.floor(r.animClock / period) % 2) as 0 | 1;
        if (frame !== r.animFrame) {
          r.animFrame = frame;
          applyLook(r);
        }
      }
      if (needsTick(r.state)) feed(r, { type: "tick", dt });
    }
    drainArrivals();
    flushLabels();
  };
  app.ticker.add(update, undefined, UPDATE_PRIORITY.NORMAL);
  app.ticker.add(
    () => {
      if (!options.instrument) return;
      lastFrameDraws = drawCounter;
      drawCounter = 0;
    },
    undefined,
    UPDATE_PRIORITY.UTILITY,
  );

  // --- selection --------------------------------------------------------------
  function setSelected(id: string | null, fromUser: boolean) {
    if (selectedId === id) {
      if (fromUser) options.onSelect(id);
      return;
    }
    const prev = selectedId ? employees.get(selectedId) : null;
    selectedId = id;
    if (prev) {
      prev.ring.visible = false;
      styleLabel(prev);
      dirtyLabels.add(prev);
    }
    const next = id ? employees.get(id) : null;
    if (next) {
      next.ring.visible = true;
      styleLabel(next);
      dirtyLabels.add(next);
    }
    if (fromUser) options.onSelect(id);
    requestRender();
  }

  // --- floor load -------------------------------------------------------------
  function loadFloor(v: FloorView) {
    view = v;
    // Detach employee sprites into the pool before destroying the floor.
    for (const [id, r] of employees) {
      r.root.removeFromParent();
      pool.set(id, r);
    }
    employees.clear();
    desks.clear();
    arrivals.length = 0;
    if (floorRoot) floorRoot.destroy({ children: true });
    plan = buildFloorPlan(v.layout, v.rooms);
    const built = buildFloor(v, plan);
    floorRoot = built.root;
    objects = built.objects;
    staticSprites = built.count;
    world.addChild(floorRoot);

    const deskOwner = new Map<string, string>();
    for (const d of plan.desks) if (d.employeeId) deskOwner.set(d.employeeId, d.id);
    const manager = v.employees.find((e) => e.role === "MANAGER" && (e.deskId ?? deskOwner.get(e.id)));
    const managerDeskId = manager ? manager.deskId ?? deskOwner.get(manager.id) ?? null : null;
    const deskOf = (id: string) => {
      const e = employees.get(id);
      return e ? e.view.deskId : null;
    };

    let spawn = 0;
    for (const e of v.employees) {
      if (e.status === "ARCHIVED") continue;
      let r = pool.get(e.id);
      if (r) {
        pool.delete(e.id);
        r.view = e;
        r.label.textContent = e.name;
        r.look = resolveAvatar(e.avatar, e.id);
        r.state = initialState(e.visualState, { status: e.status, taskId: e.currentTaskId });
        r.path = null;
      } else {
        r = makeRuntime(e);
      }
      const deskId = e.deskId ?? deskOwner.get(e.id) ?? null;
      const seat = deskId ? plan.seats.get(deskId) : undefined;
      if (seat) {
        r.homeTile = seat.tile;
        r.homeFacing = seat.facing;
        const d = FACING_DELTA[seat.facing];
        r.seatOffset = { x: d.x * 5, y: d.y * 5 };
      } else {
        const tiles = plan.spawnTiles;
        r.homeTile = tiles.length ? tiles[spawn++ % tiles.length]! : { x: 1, y: 1 };
        r.homeFacing = "down";
        r.seatOffset = { x: 0, y: 0 };
      }
      r.view = { ...e, deskId };
      r.ctx = { employeeId: e.id, homeDeskId: deskId, managerDeskId, deskOf, reducedMotion: options.reducedMotion };
      employees.set(e.id, r);
      objects!.addChild(r.root);
      placeAt(r, r.homeTile, r.homeFacing);
      r.ring.visible = e.id === selectedId;
      r.anim = r.state.anim;
      exec(r, snapshotCommands(r.state));
      styleLabel(r);
    }
    // Destroy pooled sprites for employees not on this floor.
    for (const [id, r] of pool) {
      r.label.remove();
      r.root.destroy({ children: true });
      pool.delete(id);
    }
    if (selectedId && !employees.has(selectedId)) selectedId = null;
    resetView();
    labelsDirty = true;
    flushLabels();
    updateRunning();
    requestRender();
    options.onAnnounce(`${v.name} loaded with ${employees.size} employee${employees.size === 1 ? "" : "s"}.`);
  }

  function applyEvent(e: TaskEvent) {
    for (const r of employees.values()) feed(r, e);
    drainArrivals();
    requestRender();
  }

  function countSprites(): number {
    return staticSprites + employees.size * 6;
  }

  const controller: SceneController = {
    loadFloor,
    applyEvent,
    setSpeed(speed) {
      options.speed = Math.max(0.1, Math.min(4, speed));
    },
    pause() {
      paused = true;
      updateRunning();
    },
    resume() {
      paused = false;
      updateRunning();
    },
    isPaused: () => paused,
    setLowPower(on) {
      options.lowPower = on;
      app.ticker.maxFPS = on ? 30 : 60;
    },
    setReducedMotion(on) {
      options.reducedMotion = on;
      for (const r of employees.values()) {
        r.ctx = { ...r.ctx, reducedMotion: on };
        if (on && r.path) {
          const facing = (r as Runtime & { arriveFacing?: Facing }).arriveFacing ?? r.facing;
          const last = r.path[r.path.length - 1]!;
          placeAt(r, last, facing);
          queueArrival(r, facing);
        }
        applyLook(r);
      }
      drainArrivals();
      requestRender();
    },
    setSelected(id) {
      setSelected(id, false);
    },
    zoomBy(factor) {
      setZoom(world.scale.x * factor, app.screen.width / 2, app.screen.height / 2);
    },
    resetView,
    panBy(dx, dy) {
      autoFit = false;
      world.x += dx;
      world.y += dy;
      clampWorld();
      markAllLabels();
      requestRender();
    },
    getStats() {
      return {
        fps: running ? Math.round(app.ticker.FPS * 10) / 10 : 0,
        sprites: countSprites(),
        drawCalls: options.instrument ? lastFrameDraws : undefined,
        memoryMB: memoryMB(),
        running,
        employees: employees.size,
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      ro?.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      for (const f of restoreGl) f();
      for (const r of employees.values()) r.label.remove();
      for (const r of pool.values()) r.label.remove();
      labelLayer.remove();
      employees.clear();
      pool.clear();
      app.stop();
      app.destroy(true, { children: true });
      atlas.destroy();
      void view;
    },
  };
  void options.onAnnounce;
  return controller;
}
