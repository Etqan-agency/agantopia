/**
 * Pure helpers shared by the viz components: staged reveal timing, roving keyboard
 * navigation, the floor switcher reducer and dependency layering for delegation plans.
 * No React here so everything is unit tested (sequence.test.ts).
 */

/** Gap between two stages of a progressive highlight, in ms. */
export const STAGE_STEP_MS = 700;

/** Start delay for stage `index` (0-based). */
export function stageDelay(index: number, step = STAGE_STEP_MS): number {
  return Math.max(0, Math.floor(index)) * step;
}

/**
 * Static Tailwind delay classes per stage (class names must be literal for the compiler).
 * Index 0..7 at STAGE_STEP_MS spacing.
 */
export const STAGE_DELAY_CLASS = [
  "delay-0",
  "delay-[700ms]",
  "delay-[1400ms]",
  "delay-[2100ms]",
  "delay-[2800ms]",
  "delay-[3500ms]",
  "delay-[4200ms]",
  "delay-[4900ms]",
] as const;

/** Same delays, applied to the moving path inside an AnimatedConnector `<g>`. */
export const CONNECTOR_DELAY_CLASS = [
  "[&>path:last-child]:delay-0",
  "[&>path:last-child]:delay-[700ms]",
  "[&>path:last-child]:delay-[1400ms]",
  "[&>path:last-child]:delay-[2100ms]",
  "[&>path:last-child]:delay-[2800ms]",
  "[&>path:last-child]:delay-[3500ms]",
  "[&>path:last-child]:delay-[4200ms]",
  "[&>path:last-child]:delay-[4900ms]",
] as const;

export function delayClass(index: number): string {
  return STAGE_DELAY_CLASS[Math.min(Math.max(0, index), STAGE_DELAY_CLASS.length - 1)]!;
}

export function connectorDelayClass(index: number): string {
  return CONNECTOR_DELAY_CLASS[Math.min(Math.max(0, index), CONNECTOR_DELAY_CLASS.length - 1)]!;
}

/** Index after moving by `delta`, wrapping around a list of `length` items. */
export function wrapIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

export type NavMove = { type: "next" } | { type: "prev" } | { type: "first" } | { type: "last" };

/**
 * Keyboard key to a roving move. Vertical lists answer Up/Down, horizontal Left/Right;
 * "both" answers all four arrows. Home/End always work.
 */
export function keyToMove(key: string, orientation: "vertical" | "horizontal" | "both" = "both"): NavMove | null {
  const v = orientation !== "horizontal";
  const h = orientation !== "vertical";
  if ((v && key === "ArrowDown") || (h && key === "ArrowRight")) return { type: "next" };
  if ((v && key === "ArrowUp") || (h && key === "ArrowLeft")) return { type: "prev" };
  if (key === "Home") return { type: "first" };
  if (key === "End") return { type: "last" };
  return null;
}

/* ------------------------------------------------------------ floor switcher */

export type FloorState = { selected: number; count: number };
export type FloorAction = { type: "select"; index: number } | NavMove;

/** Floor switcher state: select a floor, or move with wrap-around. */
export function floorReducer(state: FloorState, action: FloorAction): FloorState {
  const { count } = state;
  if (count <= 0) return state;
  let selected = state.selected;
  switch (action.type) {
    case "select":
      selected = Math.min(Math.max(0, Math.floor(action.index)), count - 1);
      break;
    case "next":
      selected = wrapIndex(state.selected, 1, count);
      break;
    case "prev":
      selected = wrapIndex(state.selected, -1, count);
      break;
    case "first":
      selected = 0;
      break;
    case "last":
      selected = count - 1;
      break;
  }
  return selected === state.selected ? state : { ...state, selected };
}

/* ------------------------------------------------------ delegation layering */

export type DependencyNode = { id: string; dependsOn?: readonly string[] };

/**
 * Groups nodes into columns by longest dependency path: a node sits one column after the
 * last thing it depends on. Nodes in the same column run in parallel. Throws on unknown
 * dependencies or cycles (the real planner rejects circular plans too).
 */
export function layerByDependencies<T extends DependencyNode>(nodes: readonly T[]): T[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const node = byId.get(id);
    if (!node) throw new Error(`Unknown dependency: ${id}`);
    if (visiting.has(id)) throw new Error(`Circular dependency at: ${id}`);
    visiting.add(id);
    const d = (node.dependsOn ?? []).reduce((max, dep) => Math.max(max, visit(dep) + 1), 0);
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  nodes.forEach((n) => visit(n.id));
  const layers: T[][] = [];
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    (layers[d] ??= []).push(n);
  }
  return layers;
}

/** Vertical centre of item `index` of `count` stacked items, as a 0..100 percentage. */
export function slotCenter(index: number, count: number): number {
  return count <= 0 ? 50 : ((index + 0.5) / count) * 100;
}

export type BridgeEdge = { from: string; to: string; y1: number; y2: number };

/**
 * Edges to draw between two adjacent columns: one per dependency of a node in `right` on a
 * node in `left`, with each end's vertical centre (0..100).
 */
export function bridgeEdges(left: readonly DependencyNode[], right: readonly DependencyNode[]): BridgeEdge[] {
  const edges: BridgeEdge[] = [];
  right.forEach((r, ri) => {
    for (const dep of r.dependsOn ?? []) {
      const li = left.findIndex((l) => l.id === dep);
      if (li >= 0) edges.push({ from: dep, to: r.id, y1: slotCenter(li, left.length), y2: slotCenter(ri, right.length) });
    }
  });
  return edges;
}

/** Ids that run in parallel with `id` (same column). */
export function parallelWith<T extends DependencyNode>(layers: readonly (readonly T[])[], id: string): string[] {
  const layer = layers.find((l) => l.some((n) => n.id === id));
  return layer ? layer.filter((n) => n.id !== id).map((n) => n.id) : [];
}
