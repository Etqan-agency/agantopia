/**
 * Pure, deterministic per-employee animation state machine.
 *
 * The scene feeds it persisted TaskEvents, `tick` inputs (scaled by the speed
 * multiplier) and `arrived` inputs (when a walk finishes). It returns the next
 * state plus the commands the renderer must execute. It never invents work:
 * every transition is caused by an event, a timer started by an event, or an
 * arrival at the end of a walk started by an event.
 */
import type { TaskEvent, VisualState } from "@agentopia/shared";

export type Mode =
  | "idle"
  | "thinking"
  | "working"
  | "handoff_walk"
  | "presenting"
  | "returning"
  | "reviewing"
  | "waiting_approval"
  | "blocked"
  | "completed"
  | "offline";

/** Modes in which the employee sits at their own desk. */
export type DeskMode = Exclude<Mode, "handoff_walk" | "presenting" | "returning">;

export type Anim = "typing" | "walk" | "idle" | "shuffle" | "slump";
export type IconKind = "check" | "cross" | "exclamation" | "hourglass" | "zzz";
export type Prop = "folder" | null;

export type EmployeeAnimState = {
  mode: Mode;
  /** Where the sprite is: at its own desk, at a visited desk, or walking. */
  location: "home" | "visit" | "walking";
  lamp: boolean;
  icon: IconKind | null;
  /** Remaining ms before the icon clears; 0 = persistent. */
  iconMs: number;
  anim: Anim;
  prop: Prop;
  desaturated: boolean;
  /** Remaining ms of a timed mode (presenting, completed); 0 = none. */
  timerMs: number;
  /** Desk state to enter once the employee is back at their desk. */
  pending: { mode: DeskMode; icon?: IconKind; iconMs?: number } | null;
  taskId: string | null;
  /** Desk being visited during a handoff. */
  visitDeskId: string | null;
};

export type WalkTarget = { target: "home" } | { target: "visit"; deskId: string };

export type Command =
  | ({ type: "walkTo" } & WalkTarget)
  | ({ type: "teleport" } & WalkTarget)
  | { type: "lamp"; on: boolean }
  | { type: "icon"; icon: IconKind | null }
  | { type: "anim"; anim: Anim }
  | { type: "prop"; prop: Prop }
  | { type: "desaturate"; on: boolean };

export type FsmInput = TaskEvent | { type: "tick"; dt: number } | { type: "arrived" };

export type FsmContext = {
  employeeId: string;
  /** The employee's own desk (null = stands in the lounge). */
  homeDeskId: string | null;
  /** The floor's manager desk, the default handoff destination. */
  managerDeskId: string | null;
  /** Resolves another employee's desk on this floor (handoff recipient). */
  deskOf?: (employeeId: string) => string | null;
  /** Skip walking: state changes apply immediately, walks become teleports. */
  reducedMotion: boolean;
};

export const PRESENT_MS = 1200;
export const CHECK_MS = 2000;

type DeskLook = { lamp: boolean; icon: IconKind | null; anim: Anim; prop: Prop; desaturated: boolean };

const DESK_LOOK: Record<DeskMode, DeskLook> = {
  idle: { lamp: false, icon: null, anim: "idle", prop: null, desaturated: false },
  thinking: { lamp: true, icon: "hourglass", anim: "idle", prop: null, desaturated: false },
  working: { lamp: true, icon: null, anim: "typing", prop: null, desaturated: false },
  reviewing: { lamp: true, icon: null, anim: "shuffle", prop: "folder", desaturated: false },
  waiting_approval: { lamp: true, icon: "exclamation", anim: "idle", prop: null, desaturated: false },
  blocked: { lamp: false, icon: "cross", anim: "slump", prop: null, desaturated: false },
  completed: { lamp: false, icon: "check", anim: "idle", prop: null, desaturated: false },
  offline: { lamp: false, icon: "zzz", anim: "idle", prop: null, desaturated: true },
};

const VISUAL_TO_MODE: Record<VisualState, DeskMode | null> = {
  IDLE: "idle",
  THINKING: "thinking",
  WORKING: "working",
  COLLABORATING: null, // driven by task.handoff; see reduceOverride
  REVIEWING: "reviewing",
  WAITING_APPROVAL: "waiting_approval",
  BLOCKED: "blocked",
  COMPLETED: "completed",
  OFFLINE: "offline",
};

export function isAway(s: EmployeeAnimState): boolean {
  return s.mode === "handoff_walk" || s.mode === "presenting" || s.mode === "returning";
}

/** Desk state with the visuals of `mode`. */
function atDesk(s: EmployeeAnimState, mode: DeskMode, icon?: IconKind, iconMs?: number): EmployeeAnimState {
  const look = DESK_LOOK[mode];
  return {
    ...s,
    mode,
    location: "home",
    lamp: look.lamp,
    icon: icon !== undefined ? icon : look.icon,
    iconMs: iconMs ?? 0,
    anim: look.anim,
    prop: look.prop,
    desaturated: look.desaturated,
    timerMs: mode === "completed" ? CHECK_MS : 0,
    pending: null,
    visitDeskId: null,
  };
}

/** Initial state from the server projection. */
export function initialState(visual: VisualState, opts?: { status?: string; taskId?: string | null }): EmployeeAnimState {
  const base: EmployeeAnimState = {
    mode: "idle",
    location: "home",
    lamp: false,
    icon: null,
    iconMs: 0,
    anim: "idle",
    prop: null,
    desaturated: false,
    timerMs: 0,
    pending: null,
    taskId: opts?.taskId ?? null,
    visitDeskId: null,
  };
  if (opts?.status && opts.status !== "ACTIVE") return atDesk(base, "offline");
  const mode = VISUAL_TO_MODE[visual] ?? "thinking"; // COLLABORATING at load: at desk, lamp on
  const s = atDesk(base, mode);
  // A COMPLETED projection at load time is just a resting state.
  return mode === "completed" ? { ...s, timerMs: 0, icon: null, mode: "idle", lamp: false } : s;
}

/**
 * Enter a desk state. If the employee is away (handoff sequence), the state is
 * queued and applied on return so the handoff animation is never cut mid-way.
 */
function toDesk(s: EmployeeAnimState, ctx: FsmContext, mode: DeskMode, icon?: IconKind, iconMs?: number): Result {
  if (isAway(s) && !ctx.reducedMotion) {
    return { state: { ...s, pending: { mode, icon, iconMs } }, walk: null };
  }
  return { state: atDesk(s, mode, icon, iconMs), walk: null };
}

type Result = { state: EmployeeAnimState; walk: Command | null };

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** `task.review_decided`: `approved: true` (contract) or `decision: "APPROVED"`; anything else is a rejection. */
export function isApproved(p: Record<string, unknown>): boolean {
  return p.approved === true || p.decision === "APPROVED";
}

function handoffTarget(e: TaskEvent, ctx: FsmContext): string | null {
  const to = str(e.payload?.toEmployeeId);
  const recipientDesk = to && ctx.deskOf ? ctx.deskOf(to) : null;
  const target = recipientDesk ?? ctx.managerDeskId;
  return target && target !== ctx.homeDeskId ? target : null;
}

function reduceEvent(s: EmployeeAnimState, e: TaskEvent, ctx: FsmContext): Result {
  const me = ctx.employeeId;
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const actor = e.employeeId;
  const withTask = (st: EmployeeAnimState): EmployeeAnimState => (e.taskId ? { ...st, taskId: e.taskId } : st);

  if (s.mode === "offline" && e.type !== "employee.state") return { state: s, walk: null };

  switch (e.type) {
    case "task.assigned": {
      const assignee = str(p.assigneeId) ?? actor;
      if (assignee !== me) return { state: s, walk: null };
      const r = toDesk(s, ctx, "thinking");
      return { ...r, state: withTask(r.state) };
    }
    case "task.started":
    case "execution.started":
    case "execution.tool_use": {
      if (actor !== me) return { state: s, walk: null };
      if (s.mode === "working") return { state: withTask(s), walk: null };
      const r = toDesk(s, ctx, "working");
      return { ...r, state: withTask(r.state) };
    }
    case "task.waiting_approval": {
      if (actor !== me) return { state: s, walk: null };
      return toDesk(s, ctx, "waiting_approval");
    }
    case "task.handoff": {
      const from = str(p.fromEmployeeId) ?? actor;
      if (from !== me) return { state: s, walk: null };
      const target = handoffTarget(e, ctx);
      const base = withTask({ ...s, lamp: false, icon: null, iconMs: 0, pending: null, timerMs: 0 });
      if (!target || ctx.reducedMotion) {
        // Present in place: no walking.
        return {
          state: { ...base, mode: "presenting", location: s.location, anim: "idle", prop: "folder", timerMs: PRESENT_MS, visitDeskId: null, desaturated: false },
          walk: null,
        };
      }
      return {
        state: { ...base, mode: "handoff_walk", location: "walking", anim: "walk", prop: "folder", visitDeskId: target, desaturated: false },
        walk: { type: "walkTo", target: "visit", deskId: target },
      };
    }
    case "task.review_started": {
      const reviewer = str(p.reviewerId) ?? actor;
      if (reviewer !== me) return { state: s, walk: null };
      const r = toDesk(s, ctx, "reviewing");
      return { ...r, state: withTask(r.state) };
    }
    case "task.review_decided": {
      const approved = isApproved(p);
      const reviewer = str(p.reviewerId) ?? actor;
      const worker = str(p.assigneeId) ?? str(p.workerId) ?? str(p.fromEmployeeId);
      const isReviewer = reviewer === me && (s.mode === "reviewing" || worker !== null);
      const isWorker =
        !isReviewer && (worker === me || (worker === null && (actor === me || (s.taskId !== null && s.taskId === e.taskId))));
      if (isReviewer) return toDesk(s, ctx, "idle");
      if (!isWorker) return { state: s, walk: null };
      if (approved) return toDesk(s, ctx, "idle", "check", CHECK_MS);
      // Rejected: cut a presentation short and walk back to work.
      if (s.mode === "presenting" && !ctx.reducedMotion && s.location === "visit") {
        return startReturn({ ...s, pending: { mode: "working" } }, ctx);
      }
      return toDesk(s, ctx, "working");
    }
    case "task.completed": {
      if (actor !== me) return { state: s, walk: null };
      return toDesk(s, ctx, "completed");
    }
    case "task.failed":
    case "task.blocked": {
      if (actor !== me) return { state: s, walk: null };
      return toDesk(s, ctx, "blocked");
    }
    case "task.cancelled": {
      if (actor !== me) return { state: s, walk: null };
      const r = toDesk(s, ctx, "idle");
      return { ...r, state: { ...r.state, taskId: null } };
    }
    case "employee.state":
      if (actor !== me) return { state: s, walk: null };
      return reduceOverride(s, p, ctx, e);
    default:
      return { state: s, walk: null };
  }
}

/** `employee.state` is the authoritative projection and overrides local state. */
function reduceOverride(s: EmployeeAnimState, p: Record<string, unknown>, ctx: FsmContext, e: TaskEvent): Result {
  const visual = str(p.state) as VisualState | null;
  if (!visual || !(visual in VISUAL_TO_MODE)) return { state: s, walk: null };
  const taskId = p.taskId === null ? null : str(p.taskId) ?? e.taskId ?? s.taskId;
  if (visual === "OFFLINE") {
    // Immediate: snap home, desaturate.
    const st = { ...atDesk(s, "offline"), taskId };
    return { state: st, walk: s.location !== "home" ? { type: "teleport", target: "home" } : null };
  }
  if (visual === "COLLABORATING") {
    if (isAway(s) || s.mode === "presenting") return { state: { ...s, taskId }, walk: null };
    return { state: { ...atDesk(s, "thinking"), taskId }, walk: null };
  }
  const mode = VISUAL_TO_MODE[visual]!;
  if (s.mode === mode && !isAway(s)) return { state: { ...s, taskId }, walk: null };
  const r = toDesk(s, ctx, mode);
  return { ...r, state: { ...r.state, taskId } };
}

function startReturn(s: EmployeeAnimState, ctx: FsmContext): Result {
  if (ctx.reducedMotion || s.location === "home") {
    const pending = s.pending ?? { mode: "idle" as DeskMode };
    return { state: atDesk(s, pending.mode, pending.icon, pending.iconMs), walk: null };
  }
  return {
    state: { ...s, mode: "returning", location: "walking", anim: "walk", prop: null, timerMs: 0, icon: null, iconMs: 0 },
    walk: { type: "walkTo", target: "home" },
  };
}

function reduceTick(s: EmployeeAnimState, dt: number, ctx: FsmContext): Result {
  if (dt <= 0) return { state: s, walk: null };
  let st = s;
  if (st.iconMs > 0) {
    const left = st.iconMs - dt;
    st = left <= 0 ? { ...st, iconMs: 0, icon: null } : { ...st, iconMs: left };
  }
  if (st.timerMs > 0) {
    const left = st.timerMs - dt;
    if (left > 0) return { state: { ...st, timerMs: left }, walk: null };
    st = { ...st, timerMs: 0 };
    if (st.mode === "presenting") return startReturn(st, ctx);
    if (st.mode === "completed") return { state: atDesk(st, "idle"), walk: null };
  }
  return { state: st, walk: null };
}

function reduceArrived(s: EmployeeAnimState, ctx: FsmContext): Result {
  if (s.mode === "handoff_walk") {
    return { state: { ...s, mode: "presenting", location: "visit", anim: "idle", prop: "folder", timerMs: PRESENT_MS }, walk: null };
  }
  if (s.mode === "returning") {
    const pending = s.pending ?? { mode: "idle" as DeskMode };
    return { state: atDesk({ ...s, location: "home" }, pending.mode, pending.icon, pending.iconMs), walk: null };
  }
  void ctx;
  return { state: { ...s, location: s.location === "walking" ? "home" : s.location }, walk: null };
}

/** Visual diff → commands. */
function diff(prev: EmployeeAnimState, next: EmployeeAnimState): Command[] {
  const out: Command[] = [];
  if (prev.lamp !== next.lamp) out.push({ type: "lamp", on: next.lamp });
  if (prev.icon !== next.icon) out.push({ type: "icon", icon: next.icon });
  if (prev.anim !== next.anim) out.push({ type: "anim", anim: next.anim });
  if (prev.prop !== next.prop) out.push({ type: "prop", prop: next.prop });
  if (prev.desaturated !== next.desaturated) out.push({ type: "desaturate", on: next.desaturated });
  return out;
}

export function reduce(
  state: EmployeeAnimState,
  input: FsmInput,
  ctx: FsmContext,
): { state: EmployeeAnimState; commands: Command[] } {
  let r: Result;
  if (input.type === "tick") r = reduceTick(state, (input as { dt: number }).dt, ctx);
  else if (input.type === "arrived") r = reduceArrived(state, ctx);
  else r = reduceEvent(state, input as TaskEvent, ctx);
  if (r.state === state && !r.walk) return { state, commands: [] };
  const commands: Command[] = [];
  if (r.walk) commands.push(r.walk);
  commands.push(...diff(state, r.state));
  return { state: r.state, commands };
}

/** Commands that render `s` from scratch (used on floor load). */
export function snapshotCommands(s: EmployeeAnimState): Command[] {
  return [
    { type: "lamp", on: s.lamp },
    { type: "icon", icon: s.icon },
    { type: "anim", anim: s.anim },
    { type: "prop", prop: s.prop },
    { type: "desaturate", on: s.desaturated },
  ];
}

/** True when the state has a running timer and must receive ticks. */
export function needsTick(s: EmployeeAnimState): boolean {
  return s.timerMs > 0 || s.iconMs > 0;
}
