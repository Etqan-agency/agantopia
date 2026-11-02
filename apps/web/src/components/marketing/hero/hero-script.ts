/**
 * The scripted hero demo: six scenes on a ~24 s timeline, as pure data.
 *
 * `stateAt(ms)` replays the event list up to `ms` and returns everything the
 * hero needs to draw that moment (employee states, lamps, connectors, feed,
 * task card, travelling artifact). Feed sentences follow the product's own
 * phrasing in src/office/describe.ts.
 *
 * Relative imports only (vitest runs without the `@/` alias).
 */
import type { VisualState } from "@agentopia/shared";
import { castMember } from "../office/floor-geometry";

export type SceneDef = {
  id: string;
  index: number;
  title: string;
  caption: string;
  start: number;
  end: number;
};

const SCENE_COPY: Array<Pick<SceneDef, "id" | "title" | "caption"> & { ms: number }> = [
  { id: "arrives", title: "A task arrives", caption: "You hand the manager a task. The manager's lamp turns on while it thinks.", ms: 3500 },
  { id: "delegates", title: "The manager delegates", caption: "The task becomes four linked subtasks, each sent to the best-fit specialist.", ms: 4000 },
  { id: "working", title: "Employees start working", caption: "Gold lamps mark live work. Each specialist runs on their own AI tool.", ms: 4000 },
  { id: "collaboration", title: "Collaboration", caption: "Finished research goes to design, and the design goes to development.", ms: 4000 },
  { id: "review", title: "Review", caption: "The build goes back to the manager, and QA checks it against the definition of done.", ms: 4000 },
  { id: "delivery", title: "Delivery", caption: "The task completes with the files, a summary and a timeline of who did what.", ms: 4500 },
];

export const SCENES: readonly SceneDef[] = (() => {
  let t = 0;
  return SCENE_COPY.map((s, index) => {
    const def = { id: s.id, index, title: s.title, caption: s.caption, start: t, end: t + s.ms };
    t += s.ms;
    return def;
  });
})();

export const TOTAL_MS = SCENES[SCENES.length - 1]!.end;

export const TASK_TITLE = "Build a landing page for my new product";

export type SubtaskId = "research" | "design" | "build" | "review";
export const SUBTASKS: ReadonlyArray<{ id: SubtaskId; label: string; title: string; owner: string }> = [
  { id: "research", label: "Research", title: "Research competitor landing pages", owner: "researcher" },
  { id: "design", label: "Design", title: "Design the page layout", owner: "designer" },
  { id: "build", label: "Build", title: "Build the landing page", owner: "developer" },
  { id: "review", label: "Review", title: "Review the build", owner: "qa" },
];

export type TaskStatus = "Backlog" | "Planning" | "In progress" | "In review" | "Completed";
export type SubtaskState = "hidden" | "waiting" | "active" | "done";
export type LampState = "off" | "on" | "done";

export type HeroConnector = { id: string; from: string; to: string; active: boolean };
export type FeedLine = { id: string; at: number; text: string };
export type HeroTask = {
  title: string;
  status: TaskStatus;
  subtasks: Record<SubtaskId, SubtaskState>;
  /** True once the task has completed (drives the small success beat). */
  delivered: boolean;
};
export type HeroArtifact = { from: string; to: string; start: number; duration: number; label: string };
export type Deliverable = { folder: string; file: string; files: number; summary: string };

export type HeroFrame = {
  ms: number;
  scene: SceneDef;
  states: Record<string, VisualState>;
  lamps: Record<string, LampState>;
  connectors: HeroConnector[];
  /** Oldest first. */
  feed: FeedLine[];
  task: HeroTask;
  artifact: HeroArtifact | null;
  deliverable: Deliverable | null;
};

/** Shortens a title at a word boundary, product style: ‘Build a landing page…’. */
export function shortTitle(title: string, max = 22): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 8 ? cut.slice(0, space) : title.slice(0, max)).replace(/[\s,.;:]+$/, "")}…`;
}

const q = (title: string) => `‘${shortTitle(title)}’`;
const nameOf = (id: string) => castMember(id).name;
const sub = (id: SubtaskId) => SUBTASKS.find((s) => s.id === id)!;

const DELIVERABLE: Deliverable = { folder: "landing-page/", file: "index.tsx", files: 3, summary: "summary.md" };

type Ev =
  | { at: number; kind: "state"; id: string; state: VisualState }
  | { at: number; kind: "feed"; text: string }
  | { at: number; kind: "connect"; from: string; to: string }
  | { at: number; kind: "settle"; from: string; to: string }
  | { at: number; kind: "disconnect"; from: string; to: string }
  | { at: number; kind: "status"; status: TaskStatus }
  | { at: number; kind: "subtask"; id: SubtaskId; state: SubtaskState }
  | { at: number; kind: "artifact"; from: string; to: string; duration: number; label: string }
  | { at: number; kind: "artifact-done" }
  | { at: number; kind: "deliver" };

const S = SCENES.map((s) => s.start);
const at = (scene: number, offset: number) => S[scene]! + offset;

/** The script. Times are absolute ms; keep each event inside its scene. */
const SCRIPT: Ev[] = [
  // 1. A task arrives
  { at: at(0, 500), kind: "feed", text: `New task ${q(TASK_TITLE)} was created` },
  { at: at(0, 1300), kind: "state", id: "manager", state: "THINKING" },
  { at: at(0, 1300), kind: "status", status: "Planning" },
  { at: at(0, 1300), kind: "feed", text: `${nameOf("manager")} picked up ${q(TASK_TITLE)}` },

  // 2. The manager delegates (connectors stay live until each specialist starts working)
  { at: at(1, 50), kind: "feed", text: `${nameOf("manager")} planned ${q(TASK_TITLE)}` },
  ...SUBTASKS.map((s) => ({ at: at(1, 50), kind: "subtask" as const, id: s.id, state: "waiting" as const })),
  { at: at(1, 150), kind: "connect", from: "manager", to: "researcher" },
  { at: at(1, 500), kind: "state", id: "researcher", state: "THINKING" },
  { at: at(1, 500), kind: "feed", text: `${nameOf("researcher")} picked up ${q(sub("research").title)}` },
  { at: at(1, 500), kind: "connect", from: "manager", to: "designer" },
  { at: at(1, 850), kind: "state", id: "designer", state: "THINKING" },
  { at: at(1, 850), kind: "feed", text: `${nameOf("designer")} picked up ${q(sub("design").title)}` },
  { at: at(1, 850), kind: "connect", from: "manager", to: "developer" },
  { at: at(1, 1200), kind: "state", id: "developer", state: "THINKING" },
  { at: at(1, 1200), kind: "feed", text: `${nameOf("developer")} picked up ${q(sub("build").title)}` },

  // 3. Employees start working
  { at: at(2, 0), kind: "state", id: "manager", state: "IDLE" },
  { at: at(2, 0), kind: "status", status: "In progress" },
  { at: at(2, 300), kind: "state", id: "researcher", state: "WORKING" },
  { at: at(2, 300), kind: "subtask", id: "research", state: "active" },
  { at: at(2, 300), kind: "disconnect", from: "manager", to: "researcher" },
  { at: at(2, 300), kind: "feed", text: `${nameOf("researcher")} started working on ${q(sub("research").title)}` },
  { at: at(2, 1100), kind: "state", id: "designer", state: "WORKING" },
  { at: at(2, 1100), kind: "subtask", id: "design", state: "active" },
  { at: at(2, 1100), kind: "disconnect", from: "manager", to: "designer" },
  { at: at(2, 1100), kind: "feed", text: `${nameOf("designer")} started working on ${q(sub("design").title)}` },
  { at: at(2, 1900), kind: "state", id: "developer", state: "WORKING" },
  { at: at(2, 1900), kind: "subtask", id: "build", state: "active" },
  { at: at(2, 1900), kind: "disconnect", from: "manager", to: "developer" },
  { at: at(2, 1900), kind: "feed", text: `${nameOf("developer")} started working on ${q(sub("build").title)}` },

  // 4. Collaboration
  { at: at(3, 200), kind: "state", id: "researcher", state: "COLLABORATING" },
  { at: at(3, 200), kind: "connect", from: "researcher", to: "designer" },
  { at: at(3, 200), kind: "feed", text: `${nameOf("researcher")} handed ${q(sub("research").title)} to ${nameOf("designer")}` },
  { at: at(3, 1600), kind: "state", id: "researcher", state: "COMPLETED" },
  { at: at(3, 1600), kind: "subtask", id: "research", state: "done" },
  { at: at(3, 1600), kind: "disconnect", from: "researcher", to: "designer" },
  { at: at(3, 2000), kind: "state", id: "designer", state: "COLLABORATING" },
  { at: at(3, 2000), kind: "connect", from: "designer", to: "developer" },
  { at: at(3, 2000), kind: "feed", text: `${nameOf("designer")} handed ${q(sub("design").title)} to ${nameOf("developer")}` },
  { at: at(3, 3400), kind: "state", id: "designer", state: "COMPLETED" },
  { at: at(3, 3400), kind: "subtask", id: "design", state: "done" },
  { at: at(3, 3400), kind: "disconnect", from: "designer", to: "developer" },

  // 5. Review
  { at: at(4, 200), kind: "state", id: "developer", state: "COLLABORATING" },
  { at: at(4, 200), kind: "connect", from: "developer", to: "manager" },
  { at: at(4, 200), kind: "artifact", from: "developer", to: "manager", duration: 1600, label: "index.tsx" },
  { at: at(4, 200), kind: "feed", text: `${nameOf("developer")} handed ${q(sub("build").title)} to ${nameOf("manager")}` },
  { at: at(4, 1900), kind: "artifact-done" },
  { at: at(4, 1900), kind: "disconnect", from: "developer", to: "manager" },
  { at: at(4, 1900), kind: "state", id: "developer", state: "COMPLETED" },
  { at: at(4, 1900), kind: "subtask", id: "build", state: "done" },
  { at: at(4, 1900), kind: "state", id: "manager", state: "REVIEWING" },
  { at: at(4, 1900), kind: "status", status: "In review" },
  { at: at(4, 1900), kind: "feed", text: `${nameOf("manager")} started reviewing ${q(TASK_TITLE)}` },
  { at: at(4, 2500), kind: "connect", from: "manager", to: "qa" },
  { at: at(4, 2700), kind: "state", id: "qa", state: "REVIEWING" },
  { at: at(4, 2700), kind: "subtask", id: "review", state: "active" },
  { at: at(4, 2700), kind: "feed", text: `${nameOf("qa")} started reviewing ${q(sub("review").title)}` },

  // 6. Delivery
  { at: at(5, 0), kind: "disconnect", from: "manager", to: "qa" },
  { at: at(5, 300), kind: "subtask", id: "review", state: "done" },
  { at: at(5, 300), kind: "state", id: "qa", state: "COMPLETED" },
  { at: at(5, 300), kind: "feed", text: `${nameOf("qa")} approved ${q(sub("build").title)}` },
  { at: at(5, 1000), kind: "state", id: "manager", state: "COMPLETED" },
  { at: at(5, 1000), kind: "status", status: "Completed" },
  { at: at(5, 1000), kind: "deliver" },
  { at: at(5, 1000), kind: "feed", text: `${nameOf("manager")} completed ${q(TASK_TITLE)}` },
];

/** Stable sort by time (same-time events keep script order). */
const EVENTS: readonly Ev[] = [...SCRIPT].sort((a, b) => a.at - b.at);

/** Every connector pair the script ever draws (so renderers can keep them mounted and fade them). */
export const ALL_CONNECTORS: ReadonlyArray<{ id: string; from: string; to: string }> = (() => {
  const seen = new Map<string, { id: string; from: string; to: string }>();
  for (const e of EVENTS) {
    if (e.kind === "connect") seen.set(`${e.from}>${e.to}`, { id: `${e.from}>${e.to}`, from: e.from, to: e.to });
  }
  return [...seen.values()];
})();

/** Every cast id the script touches. */
export const SCRIPT_IDS: readonly string[] = ["manager", "researcher", "designer", "developer", "qa", "developer-2"];

/**
 * Sorted, de-duplicated times at which the frame changes (plus scene starts).
 * A clock only needs to re-render when it crosses one of these.
 */
export const BEATS: readonly number[] = [...new Set([...S, ...EVENTS.map((e) => e.at)])].sort((a, b) => a - b);

export function sceneAt(ms: number): SceneDef {
  const t = clamp(ms);
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i]!.start) return SCENES[i]!;
  return SCENES[0]!;
}

export function sceneIndexAt(ms: number): number {
  return sceneAt(ms).index;
}

function clamp(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(Math.max(ms, 0), TOTAL_MS - 1);
}

/** Lamp per visual state, as in the product (src/office/state-machine.ts), with "done" as a dimmed lamp. */
export function lampFor(state: VisualState): LampState {
  if (state === "THINKING" || state === "WORKING" || state === "COLLABORATING" || state === "REVIEWING" || state === "WAITING_APPROVAL") return "on";
  if (state === "COMPLETED") return "done";
  return "off";
}

export function stateAt(ms: number): HeroFrame {
  const t = clamp(ms);
  const states: Record<string, VisualState> = Object.fromEntries(SCRIPT_IDS.map((id) => [id, "IDLE" as VisualState]));
  const connectors = new Map<string, HeroConnector>();
  const feed: FeedLine[] = [];
  const task: HeroTask = {
    title: TASK_TITLE,
    status: "Backlog",
    subtasks: { research: "hidden", design: "hidden", build: "hidden", review: "hidden" },
    delivered: false,
  };
  let artifact: HeroArtifact | null = null;
  let deliverable: Deliverable | null = null;

  EVENTS.forEach((e, i) => {
    if (e.at > t) return;
    switch (e.kind) {
      case "state":
        states[e.id] = e.state;
        break;
      case "feed":
        feed.push({ id: `f${i}`, at: e.at, text: e.text });
        break;
      case "connect":
        connectors.set(`${e.from}>${e.to}`, { id: `${e.from}>${e.to}`, from: e.from, to: e.to, active: true });
        break;
      case "settle": {
        const c = connectors.get(`${e.from}>${e.to}`);
        if (c) connectors.set(c.id, { ...c, active: false });
        break;
      }
      case "disconnect":
        connectors.delete(`${e.from}>${e.to}`);
        break;
      case "status":
        task.status = e.status;
        if (e.status === "Completed") task.delivered = true;
        break;
      case "subtask":
        task.subtasks[e.id] = e.state;
        break;
      case "artifact":
        artifact = { from: e.from, to: e.to, start: e.at, duration: e.duration, label: e.label };
        break;
      case "artifact-done":
        artifact = null;
        break;
      case "deliver":
        deliverable = DELIVERABLE;
        break;
    }
  });

  const lamps: Record<string, LampState> = Object.fromEntries(Object.entries(states).map(([id, s]) => [id, lampFor(s)]));
  return { ms: t, scene: sceneAt(t), states, lamps, connectors: [...connectors.values()], feed, task, artifact, deliverable };
}

/** The frame a scene settles into (used for reduced motion and manual stepping). */
export function sceneEndFrame(index: number): HeroFrame {
  const s = SCENES[Math.min(Math.max(index, 0), SCENES.length - 1)]!;
  return stateAt(s.end - 1);
}
