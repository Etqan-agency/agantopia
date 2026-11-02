/**
 * Pure geometry for the homepage hero scene ("Hero B", owner-approved concept in
 * artifacts/hero-concept-b/assets/scene.js).
 *
 * The concept draws into the hero's own pixel space and recomputes on resize. Here the same
 * maths is evaluated once, at render time on the server, for the two canonical layouts the
 * concept has (wide >= 900px measured at 1440x900, narrow < 900px measured at 390x844 for phones
 * and 768x1024 for tablets). The SVG
 * keeps that fixed viewBox and CSS slices it to the hero, so first paint is server HTML and there
 * is no layout shift.
 *
 * Relative imports only: unit-tested by vitest without the `@/` alias.
 */
import { DEFAULT_ROOMS } from "@agentopia/shared";

export type SceneLayout = {
  /** viewBox width and height (the concept hero at the canonical viewport). */
  W: number;
  H: number;
  /** Top and height of the concept's empty "stage" below the copy, in the same units. */
  stageY: number;
  stageH: number;
  narrow: boolean;
};

/**
 * Canonical layouts, measured from the concept (Playwright, getBoundingClientRect of #hero and
 * #stage) at 1440x900 and 390x844. The concept's own top bar sits inside its hero; on the site the
 * real navbar sits above the hero, so the SVG is anchored to the bottom and its top band (the
 * concept's top bar height) falls outside the section.
 */
export const WIDE_LAYOUT: SceneLayout = { W: 1440, H: 900, stageY: 522, stageH: 378, narrow: false };
export const NARROW_LAYOUT: SceneLayout = { W: 390, H: 853, stageY: 563, stageH: 290, narrow: true };
/**
 * The concept's narrow layout evaluated at 768x1024 (tablets, 561-899px). Slicing the 390 drawing
 * up to 768 doubles the role tags and pill and crops the HUD, so tablets get their own evaluation
 * of the same formulas, exactly as the concept renders at that width.
 */
export const TABLET_LAYOUT: SceneLayout = { W: 768, H: 1024, stageY: 468, stageH: 556, narrow: true };

export type Facing = "down" | "up" | "left" | "right";
export type OutfitName = "moss" | "brick" | "sky" | "saffron" | "ink" | "plum" | "teal";

export type Member = {
  name?: string;
  /** CHARACTER_PALETTES name. */
  o: OutfitName;
  /** SKIN_TONES / HAIR_COLORS index. */
  skin: number;
  hair: number;
  /** Hair style 0..3. */
  st: number;
  f: Facing;
  /** Glance toward the owner (eyes shifted left). */
  g?: boolean;
  p?: "laptop" | "folder";
  lamp?: "steady" | "seq";
  pill?: string;
  /** Offset from the group centre, design px at scale 1. */
  at: readonly [number, number];
};

type Group = {
  id: string;
  label: string | null;
  wide: readonly [number, number];
  narrow: readonly [number, number];
  members: readonly Member[];
};

/** The team (12), grouped by role. Development is a pair with nobody behind Daniel, so his lamp sits over his own head (owner feedback). */
export const GROUPS: readonly Group[] = [
  { id: "dev", label: "Development", wide: [-196, -36], narrow: [-118, -78], members: [
    { name: "Daniel", o: "ink", skin: 1, hair: 0, st: 0, f: "down", p: "laptop", lamp: "seq", at: [0, 0] },
    { o: "saffron", skin: 3, hair: 1, st: 1, f: "right", at: [-46, 4] },
  ] },
  { id: "design", label: "Design", wide: [186, -46], narrow: [118, -82], members: [
    { name: "Maya", o: "teal", skin: 2, hair: 0, st: 2, f: "down", p: "folder", lamp: "steady", at: [0, 0] },
    { o: "brick", skin: 0, hair: 3, st: 0, f: "left", at: [38, -6] },
    { o: "sky", skin: 5, hair: 1, st: 3, f: "down", g: true, p: "laptop", at: [-38, 6] },
  ] },
  { id: "research", label: "Research", wide: [290, 50], narrow: [128, 52], members: [
    { name: "Nour", o: "moss", skin: 1, hair: 5, st: 1, f: "down", g: true, p: "folder", lamp: "seq", at: [0, 0] },
    { o: "ink", skin: 3, hair: 4, st: 0, f: "right", at: [-40, -4] },
    { o: "plum", skin: 2, hair: 0, st: 2, f: "down", at: [36, -16] },
  ] },
  { id: "qa", label: "QA", wide: [-268, 56], narrow: [-120, 48], members: [
    { name: "Kenji", o: "sky", skin: 0, hair: 0, st: 3, f: "down", g: true, p: "laptop", lamp: "steady", at: [0, 0] },
    { o: "brick", skin: 4, hair: 2, st: 1, f: "right", at: [-38, -8] },
  ] },
  { id: "lead", label: "Manager", wide: [-12, 36], narrow: [4, 4], members: [
    { name: "Morgan", o: "plum", skin: 0, hair: 1, st: 0, f: "down", g: true, p: "folder", lamp: "steady", pill: "Morgan · planning", at: [0, 0] },
  ] },
  { id: "shared", label: null, wide: [104, -78], narrow: [30, -112], members: [
    { name: "Theo", o: "saffron", skin: 5, hair: 4, st: 0, f: "right", p: "folder", at: [0, 0] },
  ] },
];

/** Activity feed, in the product's own phrasing. */
export const FEED = [
  "Morgan Hale planned ‘Build a landing page…’",
  "Daniel Reid started ‘Hero section’",
  "Maya Brooks handed the layout to Theo Park",
  "Kenji Watanabe asked for a review",
] as const;

/** Agent network nodes, fractions of the network box. Indices 4, 7 and 10 are gold. */
const NET: ReadonlyArray<readonly [number, number]> = [
  [0.06, 0.58], [0.18, 0.26], [0.3, 0.66], [0.4, 0.14], [0.5, 0.46], [0.61, 0.24], [0.69, 0.7], [0.79, 0.08],
  [0.86, 0.44], [0.96, 0.22], [0.57, 0.9], [0.24, 0.94], [0.92, 0.8], [0.12, 0.02], [0.75, 0.4],
];
const NET_GOLD = new Set([4, 7, 10]);
/** Desk lamps marked on the ghosted plan (tile coordinates of DEFAULT_ROOMS desk slots). */
const PLAN_LAMPS: ReadonlyArray<readonly [number, number]> = [[5, 4], [14, 3], [18, 3], [22, 3], [32, 3], [36, 3], [3, 12], [32, 13]];

export const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export type Pt = { x: number; y: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number };

/** Scale, spotlight centre, pool and horizon (concept `render()` preamble). */
export function sceneFrame(l: SceneLayout) {
  const { W, H, stageY, stageH, narrow } = l;
  const s = narrow ? clamp(Math.min(stageH / 380, W / 600), 0.55, 1.3) : clamp(Math.min(stageH / 330, W / 1280), 0.8, 1.4);
  const cx = narrow ? W * 0.58 : W * 0.56;
  const poolY = stageY + stageH * (narrow ? 0.5 : 0.54);
  const poolRx = (narrow ? 270 : 440) * s;
  const poolRy = (narrow ? 120 : 128) * s;
  const horizon = narrow ? Math.min(H * 0.47, stageY - 20) : Math.min(H * 0.47, stageY - 30);
  return { s, cx, poolY, poolRx, poolRy, horizon, vpx: W / 2 };
}
export type SceneFrame = ReturnType<typeof sceneFrame>;

/** Perspective floor grid: radial lines from the vanishing point and depth-spaced cross lines. */
export function floorGrid(l: SceneLayout, f: SceneFrame) {
  const { W, H, narrow } = l;
  const D = H - f.horizon;
  const sp = (narrow ? 64 : 88) * Math.max(0.85, f.s);
  const nRad = Math.ceil((W * 2.6) / sp);
  const radial: Seg[] = [];
  for (let i = -nRad; i <= nRad; i++) {
    const bx = f.vpx + i * sp;
    radial.push({ x1: r2(f.vpx), y1: r2(f.horizon), x2: r2(f.vpx + (bx - f.vpx) * 1.25), y2: r2(f.horizon + D * 1.25) });
  }
  const cross: number[] = [];
  const dz = (sp * 0.5) / D;
  let z = 0.94;
  for (let n = 0; n < 80; n++) {
    const y = f.horizon + D / z;
    const yn = f.horizon + D / (z + dz);
    if (y - yn < 6) break; // stop before lines crowd into moiré
    if (y < H + 2) cross.push(r2(y));
    z += dz;
  }
  return { radial, cross };
}

/** Ghosted office plan (DEFAULT_ROOMS, 40x24 tiles) in the top-left HUD. */
export function officePlan(l: SceneLayout) {
  const { W, narrow } = l;
  const tu = narrow ? Math.min(7.5, (W - 32) / 40) : clamp(W * 0.0072, 9, 13);
  const ox = narrow ? 16 : Math.max(40, W * 0.035);
  const oy = narrow ? 84 : 104;
  return {
    ox: r2(ox),
    oy: r2(oy),
    outline: { w: r2(40 * tu), h: r2(24 * tu) },
    rooms: DEFAULT_ROOMS.map((rm) => ({ name: rm.name, x: r2(rm.x * tu), y: r2(rm.y * tu), w: r2(rm.w * tu), h: r2(rm.h * tu) })),
    lamps: PLAN_LAMPS.map(([x, y], j) => ({ cx: r2(x * tu), cy: r2(y * tu), r: r2(tu * 0.32), bright: j % 3 === 0 })),
    labels: !narrow,
    /** The manager's office on the plan, start of a connector. */
    manager: { x: ox + 9 * tu, y: oy + 4.5 * tu },
  };
}

/** Connected agent nodes above the horizon on the right; each node links to its two nearest. */
export function agentNetwork(l: SceneLayout, f: SceneFrame) {
  const { W, narrow } = l;
  const nb = narrow
    ? { x: W * 0.52, y: 76, w: W * 0.44, h: Math.max(80, Math.min(170, f.horizon - 140)) }
    : { x: W * 0.66, y: 96, w: W * 0.31, h: Math.max(140, f.horizon - 96 - 70) };
  const pts: Pt[] = NET.map(([px, py]) => ({ x: nb.x + px * nb.w, y: nb.y + py * nb.h }));
  const seen = new Set<string>();
  const edges: Seg[] = [];
  pts.forEach((p, a) => {
    pts
      .map((q, b) => ({ b, d: Math.hypot(q.x - p.x, q.y - p.y) }))
      .filter((e) => e.b !== a)
      .sort((e1, e2) => e1.d - e2.d)
      .slice(0, 2)
      .forEach((e) => {
        const key = `${Math.min(a, e.b)}-${Math.max(a, e.b)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const q = pts[e.b]!;
        edges.push({ x1: r2(p.x), y1: r2(p.y), x2: r2(q.x), y2: r2(q.y) });
      });
  });
  const nodes = pts.map((p, a) => ({ cx: r2(p.x), cy: r2(p.y), r: (a % 3) + 2.5, gold: NET_GOLD.has(a) }));
  return { pts, edges, nodes };
}

/** Gold HUD arcs and tick marks around the vanishing point. */
export function hudArcs(l: SceneLayout, f: SceneFrame) {
  const R = l.narrow ? 120 : 210;
  const { vpx, horizon } = f;
  const main = `M${r2(vpx - R)} ${r2(horizon)} A${R} ${R} 0 0 1 ${r2(vpx + R)} ${r2(horizon)}`;
  const outer = `M${r2(vpx - R * 1.35)} ${r2(horizon)} A${R * 1.35} ${R * 1.35} 0 0 1 ${r2(vpx - R * 0.6)} ${r2(horizon - R * 1.2)}`;
  const ticks: Seg[] = [];
  for (let t = 0; t <= 12; t++) {
    const an = Math.PI + (t / 12) * Math.PI;
    const r1 = R * 1.08;
    const rr = R * (t % 3 === 0 ? 1.16 : 1.12);
    ticks.push({ x1: r2(vpx + Math.cos(an) * r1), y1: r2(horizon + Math.sin(an) * r1), x2: r2(vpx + Math.cos(an) * rr), y2: r2(horizon + Math.sin(an) * rr) });
  }
  return { main, outer, ticks };
}

/** Activity feed lines (wide only), right-aligned under the horizon. */
export function feedLines(l: SceneLayout, f: SceneFrame) {
  if (l.narrow) return [];
  const fx = l.W - Math.max(40, l.W * 0.035);
  const fy = f.horizon + 28;
  return FEED.map((text, j) => ({
    text,
    x: r2(fx - 12),
    y: r2(fy + j * 19),
    opacity: r2(0.24 - j * 0.04),
    dot: { cx: r2(fx - 2), cy: r2(fy + j * 19 - 4), opacity: r2(0.35 - j * 0.06) },
  }));
}

/** Faint beam from above, wide pool, breathing pool and the two floor rings. */
export function spotlight(f: SceneFrame) {
  const { cx, poolY, poolRx, poolRy, horizon, s } = f;
  const top = Math.max(0, horizon - 340);
  return {
    beam: `M${r2(cx - 60 * s)} ${r2(top)} L${r2(cx + 60 * s)} ${r2(top)} L${r2(cx + poolRx * 0.92)} ${r2(poolY)} L${r2(cx - poolRx * 0.92)} ${r2(poolY)} Z`,
    cx: r2(cx),
    cy: r2(poolY),
    wide: { rx: r2(poolRx * 1.9), ry: r2(poolRy * 1.9) },
    pool: { rx: r2(poolRx), ry: r2(poolRy) },
    ringInner: { rx: r2(poolRx * 1.06), ry: r2(poolRy * 1.06) },
    ringOuter: { rx: r2(poolRx * 1.3), ry: r2(poolRy * 1.3) },
  };
}

export type PlacedCharacter = { key: string; member: Member; x: number; y: number; k: number; lampDelay: number };
export type Tag = { key: string; x: number; y: number; text: string; fs: number; dot: boolean };

/** Approximate tag pill size (concept heuristic: Inter at ~0.56em per character). */
export function tagBox(text: string, fs: number, dot: boolean) {
  const w = Math.round(text.length * fs * 0.56 + (dot ? 26 : 16));
  const h = Math.round(fs * 1.9);
  return { w, h };
}

/**
 * The team: positions, depth scale, role tags, Morgan's status pill and the lamp sequence
 * (lamps light left to right, 0.55 s apart). Characters are sorted back to front.
 */
export function placeTeam(l: SceneLayout, f: SceneFrame) {
  const { narrow } = l;
  const { s, cx, poolY } = f;
  const off = narrow ? 0.82 : 1;
  const chars: PlacedCharacter[] = [];
  const tags: Tag[] = [];
  const anchors: Record<string, Pt> = {};
  for (const gr of GROUPS) {
    const gc = narrow ? gr.narrow : gr.wide;
    const gx = cx + gc[0] * s;
    const gy = poolY + gc[1] * s;
    let maxY = -Infinity;
    gr.members.forEach((m, i) => {
      const px = gx + m.at[0] * off * s;
      const py = gy + m.at[1] * off * s;
      const depth = 1 + (py - poolY) / (700 * s);
      const k = 2.0 * s * depth * (narrow ? 1.05 : 1.12);
      chars.push({ key: `${gr.id}-${i}`, member: m, x: px, y: py, k, lampDelay: 0 });
      if (py > maxY) maxY = py;
      if (m.name) anchors[m.name] = { x: px, y: py - 38 * k };
    });
    if (gr.label && gr.label !== "Manager") tags.push({ key: gr.id, x: gx, y: maxY + 14 * s, text: gr.label, fs: narrow ? 9.5 : 10.5, dot: false });
  }
  chars.sort((a, b) => a.y - b.y);
  chars
    .filter((c) => c.member.lamp)
    .sort((a, b) => a.x - b.x)
    .forEach((c, j) => {
      c.lampDelay = r2(j * 0.55);
    });
  const pills: Tag[] = chars
    .filter((c) => c.member.pill)
    .map((c) => ({ key: `pill-${c.key}`, x: c.x, y: c.y - 48 * c.k, text: c.member.pill!, fs: narrow ? 10 : 11.5, dot: true }));
  return { chars, tags, pills, anchors };
}

export type Connector = { key: string; x: number; y: number; angle: number; len: number; duration: number; delay: number };

/** Straight HUD connectors with a travelling dash (moves by translate only). */
export function connectors(l: SceneLayout, net: Pt[], anchors: Record<string, Pt>, planManager: Pt): Connector[] {
  const list: Array<[Pt | undefined, Pt | undefined, number, number]> = [
    [net[4], anchors.Maya ?? anchors.Morgan, 7, 0],
    [net[7], net[10], 5, 2.2],
  ];
  if (!l.narrow && anchors.Kenji) list.push([planManager, anchors.Kenji, 8, 3.6]);
  return list.flatMap(([a, b, duration, delay], i) =>
    a && b
      ? [{ key: `c${i}`, x: r2(a.x), y: r2(a.y), angle: r2((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI), len: r2(Math.hypot(b.x - a.x, b.y - a.y) - 14), duration, delay }]
      : [],
  );
}

/** The owner at the gold rail, front-left, and the balcony behind them. */
export function ownerAndRail(l: SceneLayout, f: SceneFrame) {
  const { W, H, narrow } = l;
  const { s, cx, poolRx } = f;
  const u = narrow ? clamp(s * 0.84, 0.5, 1.1) : clamp(s * 1.12, 0.9, 1.5);
  const ownerX = narrow ? Math.max(52 * u, W * 0.13) : Math.max(130 * u, cx - poolRx - 170 * u);
  const ownerY = H + 12 * u;
  const rx0 = -20;
  const ry0 = ownerY - 70 * u;
  const rx1 = ownerX + (narrow ? 170 : 190) * u;
  const ry1 = ownerY - 104 * u;
  const rh = 46 * u;
  const posts: Seg[] = [];
  for (let pp = 0; pp <= 6; pp++) {
    const t = pp / 6;
    const px = rx0 + (rx1 - rx0) * t;
    const py = ry0 + (ry1 - ry0) * t;
    posts.push({ x1: r2(px), y1: r2(py - rh), x2: r2(px), y2: r2(py) });
  }
  return {
    owner: { x: r2(ownerX), y: r2(ownerY), u: r2(u) },
    panel: `M${rx0} ${r2(ry0)} L${r2(rx1)} ${r2(ry1)} L${r2(rx1)} ${H + 4} L${rx0} ${H + 4} Z`,
    posts,
    postWidth: r2(Math.max(1, 1.6 * u)),
    endPost: { x1: r2(rx1), y1: r2(ry1 - rh), x2: r2(rx1), y2: H + 4 },
    endPostWidth: r2(Math.max(1.4, 2.2 * u)),
    baseRail: { x1: rx0, y1: r2(ry0), x2: r2(rx1), y2: r2(ry1) },
    handrail: { x1: rx0, y1: r2(ry0 - rh), x2: r2(rx1), y2: r2(ry1 - rh) },
    handrailWidth: r2(Math.max(2, 3.4 * u)),
  };
}

/** Everything the scene draws for one canonical layout. */
export function computeHeroScene(l: SceneLayout) {
  const frame = sceneFrame(l);
  const plan = officePlan(l);
  const network = agentNetwork(l, frame);
  const team = placeTeam(l, frame);
  return {
    layout: l,
    frame,
    grid: floorGrid(l, frame),
    plan,
    network,
    arcs: hudArcs(l, frame),
    feed: feedLines(l, frame),
    spotlight: spotlight(frame),
    team,
    connectors: connectors(l, network.pts, team.anchors, plan.manager),
    rail: ownerAndRail(l, frame),
  };
}
export type HeroScene = ReturnType<typeof computeHeroScene>;
