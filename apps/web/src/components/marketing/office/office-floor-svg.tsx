import type { KeyboardEvent, ReactNode } from "react";
import type { RoomKind, VisualState } from "@agentopia/shared";
import { AnimatedConnector } from "@/components/marketing/primitives/animated-connector";
import { VISUAL_LABEL } from "@/office/describe";
import { cn } from "@/lib/utils";
import {
  buildFloorGeometry,
  croppedViewBox,
  headOf,
  HERO_TILE,
  type FloorDecor,
  type FloorDesk,
  type FloorGeometry,
  type HeroCastMember,
  type Point,
} from "./floor-geometry";

/**
 * A server-renderable SVG of the default office floor, drawn in the style of the
 * product's Pixi atlas (src/office/atlas.ts): light room washes inside a navy frame,
 * grey walls and slatted doors, desks with monitors and chairs, plants, bookshelves,
 * whiteboards, and round-headed characters seated at their desks. Each occupied desk
 * has the gold lamp: an outline when off, filled with a soft glow when on, dimmed when done.
 *
 * No hooks and no client directive: it renders in server HTML (the hero's first frame,
 * the final CTA callback) and inside client components (the animated hero). The viewBox
 * is fixed, so the box never changes size.
 *
 * Colours come from tokens (`var(--color-…)` / Tailwind fill classes); floor washes are
 * `color-mix` tints of the brand hues, matching FLOOR_COLORS in src/office/palette.ts.
 */

export type LampLevel = "off" | "on" | "done";
export type FloorConnector = { id?: string; from: string; to: string; active: boolean };

type Props = {
  cast: readonly HeroCastMember[];
  states: Record<string, VisualState>;
  /** Optional explicit lamp levels; otherwise derived from `states`. */
  lamps?: Record<string, LampLevel>;
  highlightRoom?: string;
  /** Connectors to draw. Pass `present: false` entries via `connectorSlots` to keep them mounted for fades. */
  connectors?: FloorConnector[];
  /** Every connector that may appear; absent ones render transparent so they can fade in and out. */
  connectorSlots?: ReadonlyArray<{ id?: string; from: string; to: string }>;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  interactive?: boolean;
  /** Show name/state tags above employees. */
  tags?: boolean;
  /** Unique prefix for defs ids when several floors share a page. */
  idPrefix?: string;
  /** Extra SVG content drawn on top, in floor coordinates (e.g. a travelling artifact). */
  children?: ReactNode;
  /** Registers employee <g> elements (for focus return from a popover). */
  employeeRef?: (id: string, el: SVGGElement | null) => void;
  title?: string;
  className?: string;
  tile?: number;
  /** Crop the floor to this many tile rows from the top (fixed viewBox). */
  rows?: number;
};

/* ---------------------------------------------------------------- colours */

const v = (token: string) => `var(--color-${token})`;
const wash = (token: string, pct: number) => `color-mix(in srgb, ${v(token)} ${pct}%, white)`;

type FloorKey = RoomKind | "CORRIDOR";
/** Mirrors FLOOR_COLORS (tint(c, t) == c mixed (1 - t) with white). */
const FLOOR: Record<FloorKey, [string, string]> = {
  MANAGER_OFFICE: [wash("violet", 14), wash("violet", 18)],
  DEVELOPMENT: [wash("violet", 6), wash("violet", 9)],
  DESIGN: [wash("gold", 20), wash("gold", 25)],
  RESEARCH: [wash("mist", 22), wash("mist", 28)],
  QA: [wash("mist", 40), wash("mist", 45)],
  SHARED: ["white", wash("mist", 8)],
  LOUNGE: ["white", wash("mist", 12)],
  CORRIDOR: [wash("mist", 32), wash("mist", 36)],
};

const WALL: Partial<Record<FloorKey, string>> = {
  MANAGER_OFFICE: `color-mix(in srgb, ${v("violet")} 14%, ${v("stone-300")})`,
  DEVELOPMENT: `color-mix(in srgb, ${v("violet")} 14%, ${v("stone-300")})`,
  QA: `color-mix(in srgb, ${v("navy")} 8%, ${v("stone-300")})`,
};

/** Character outfits, mirroring CHARACTER_PALETTES in src/office/palette.ts. */
const OUTFIT: Record<HeroCastMember["palette"], { shirt: string; pants: string; accent: string }> = {
  moss: { shirt: v("gold"), pants: v("navy"), accent: v("white") },
  brick: { shirt: v("navy"), pants: v("stone-700"), accent: v("gold") },
  sky: { shirt: v("mist"), pants: v("navy"), accent: v("white") },
  saffron: { shirt: v("white"), pants: v("navy"), accent: v("violet") },
  ink: { shirt: v("stone-700"), pants: v("navy"), accent: v("lavender") },
  plum: { shirt: v("violet"), pants: v("stone-700"), accent: v("gold") },
  teal: { shirt: v("lavender"), pants: v("navy"), accent: v("violet-deep") },
};

/** SKIN_TONES: pale gold tints and cool neutrals. */
const SKIN = [wash("gold", 12), wash("gold", 24), v("stone-100"), "color-mix(in srgb, var(--color-stone-300) 60%, white)", v("mist"), v("stone-500")];
/** HAIR_COLORS. */
const HAIR = [v("navy"), v("stone-700"), v("violet"), v("gold"), v("stone-500"), v("violet-deep")];

const STATE_DOT: Partial<Record<VisualState, string>> = {
  THINKING: v("lavender"),
  WORKING: v("gold"),
  COLLABORATING: v("gold"),
  REVIEWING: v("lavender"),
  WAITING_APPROVAL: v("gold"),
  COMPLETED: v("success"),
  BLOCKED: v("danger"),
};

export function lampLevelFor(state: VisualState | undefined): LampLevel {
  if (state === "THINKING" || state === "WORKING" || state === "COLLABORATING" || state === "REVIEWING" || state === "WAITING_APPROVAL") return "on";
  if (state === "COMPLETED") return "done";
  return "off";
}

/* ---------------------------------------------------------------- pieces */

/** Trig results differ in the last bits between Node and browsers; round so hydration matches. */
const round2 = (n: number) => Math.round(n * 100) / 100;

function Desk({ desk, s }: { desk: FloorDesk; s: number }) {
  const horizontal = desk.facing === "up" || desk.facing === "down";
  return (
    <g transform={`translate(${desk.x} ${desk.y}) scale(${s})`}>
      {horizontal ? (
        <>
          <rect x={1} y={4} width={30} height={22} rx={2} className="fill-stone-700" />
          <rect x={1} y={4} width={30} height={18} rx={2} className="fill-stone-300" />
          <rect x={3} y={6} width={26} height={1} className="fill-white" opacity={0.35} />
          <rect x={desk.facing === "down" ? 20 : 4} y={23} width={8} height={2} className="fill-navy" opacity={0.25} />
          <rect x={10} y={desk.facing === "down" ? 7 : 15} width={12} height={4} rx={1} className="fill-navy" />
          <rect x={4} y={desk.facing === "down" ? 8 : 14} width={5} height={6} className="fill-white" />
        </>
      ) : (
        <>
          <rect x={5} y={1} width={22} height={30} rx={2} className="fill-stone-700" />
          <rect x={5} y={1} width={22} height={26} rx={2} className="fill-stone-300" />
          <rect x={desk.facing === "right" ? 8 : 20} y={10} width={4} height={12} rx={1} className="fill-navy" />
          <rect x={desk.facing === "right" ? 19 : 8} y={18} width={5} height={6} className="fill-white" />
        </>
      )}
    </g>
  );
}

function Chair({ at, s }: { at: Point; s: number }) {
  return (
    <g transform={`translate(${at.x - 10 * s} ${at.y - 20 * s}) scale(${s})`}>
      <ellipse cx={10} cy={17} rx={7} ry={2} className="fill-navy" opacity={0.15} />
      <rect x={3} y={3} width={14} height={13} rx={4} className="fill-stone-800" />
      <rect x={5} y={5} width={10} height={8} rx={3} className="fill-stone-700" />
    </g>
  );
}

function Monitor({ desk, s, on }: { desk: FloorDesk; s: number; on: boolean }) {
  const horizontal = desk.facing === "up" || desk.facing === "down";
  const cx = desk.cx + (horizontal ? 3 * s : 0);
  const cy = desk.cy - 3 * s;
  return (
    <g transform={`translate(${cx - 10 * s} ${cy - 9 * s}) scale(${s})`}>
      {desk.facing === "down" ? (
        <>
          <rect x={8} y={12} width={4} height={4} className="fill-stone-800" />
          <rect x={2} y={2} width={16} height={11} rx={2} className="fill-stone-800" />
          <rect x={4} y={4} width={12} height={7} rx={1} className="fill-stone-700" />
        </>
      ) : desk.facing === "up" ? (
        <>
          <rect x={8} y={12} width={4} height={4} className="fill-stone-800" />
          <rect x={2} y={2} width={16} height={11} rx={2} className="fill-navy" />
          <rect x={3.5} y={3.5} width={13} height={8} className={cn("transition-[fill] duration-[400ms]", on ? "fill-lavender" : "fill-stone-600")} />
          <rect x={5} y={5} width={7} height={1} className="fill-white" opacity={on ? 0.8 : 0.3} />
          <rect x={5} y={7.5} width={9} height={1} className="fill-white" opacity={on ? 0.6 : 0.2} />
        </>
      ) : (
        <>
          <rect x={(desk.facing === "left" ? 12 : 6) - 1} y={12} width={4} height={4} className="fill-stone-800" />
          <rect x={desk.facing === "left" ? 12 : 6} y={1} width={3} height={13} rx={1} className="fill-stone-800" />
        </>
      )}
    </g>
  );
}

/** Lamp centre for a desk (atlas: offset -9,-6 on horizontal desks, 0,-9 on vertical ones). */
function lampCentre(desk: FloorDesk, s: number): Point {
  const horizontal = desk.facing === "up" || desk.facing === "down";
  return horizontal ? { x: desk.cx - 10 * s, y: desk.cy - 7 * s } : { x: desk.cx, y: desk.cy - 10 * s };
}

function Lamp({ at, level, s }: { at: Point; level: LampLevel; s: number }) {
  // Drawn in a 64 unit frame centred on the bulb (as in the atlas), at lamp scale.
  const k = s * 1.75;
  const shade = "M-6 2 L6 2 L3.5 -4 L-3.5 -4 Z";
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${k})`} data-lamp={level}>
      <ellipse cx={0} cy={9} rx={4.5} ry={1.8} className="fill-navy" />
      <rect x={-0.75} y={1} width={1.5} height={8} className="fill-navy" />
      {/* Off: outline only. */}
      <path d={shade} className="fill-white stroke-stone-500" strokeWidth={1} opacity={level === "off" ? 1 : 0} />
      {/* On / done: filled shade. */}
      <path
        d={shade}
        className="fill-gold stroke-navy transition-opacity duration-[400ms] ease-brand"
        strokeWidth={0.6}
        strokeOpacity={0.45}
        opacity={level === "on" ? 1 : level === "done" ? 0.45 : 0}
      />
      <circle cx={0} cy={2.5} r={2.6} className="fill-white transition-opacity duration-[400ms]" opacity={level === "on" ? 0.9 : 0} />
      <circle cx={0} cy={2.5} r={1.6} className="fill-stone-500 transition-opacity duration-[400ms]" opacity={level === "on" ? 0 : 0.8} />
    </g>
  );
}

function Plant({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={16} cy={29} rx={9} ry={2.5} className="fill-navy" opacity={0.15} />
      <path d="M9 19 L23 19 L21 29 L11 29 Z" className="fill-navy" />
      <rect x={9} y={19} width={14} height={2} className="fill-stone-700" />
      <circle cx={16} cy={11} r={7} className="fill-violet" />
      <circle cx={10} cy={14} r={5} className="fill-violet" />
      <circle cx={22} cy={14} r={5} className="fill-violet" />
      <circle cx={13} cy={8} r={4} style={{ fill: wash("violet", 70) }} />
      <circle cx={19} cy={12} r={3} style={{ fill: wash("violet", 70) }} />
    </g>
  );
}

const BOOKS = ["violet", "gold", "white", "mist", "lavender", "stone-500", "violet-deep"];

function Bookshelf({ x, y, s }: { x: number; y: number; s: number }) {
  const books: ReactNode[] = [];
  for (let row = 0; row < 3; row++) {
    const by = 4 + row * 8;
    let bx = 4;
    let k = row * 3;
    while (bx < 27) {
      const w = 2 + ((k * 7) % 3);
      const h = 5 + ((k * 5) % 3);
      books.push(<rect key={`${row}-${k}`} x={bx} y={by + 7 - h} width={w} height={h} style={{ fill: v(BOOKS[k % BOOKS.length]!) }} />);
      bx += w + 0.6;
      k++;
    }
    books.push(<rect key={`shelf-${row}`} x={3} y={by + 7} width={26} height={1.2} className="fill-navy" />);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={1} y={2} width={30} height={28} className="fill-navy" />
      <rect x={3} y={4} width={26} height={24} className="fill-stone-700" />
      {books}
    </g>
  );
}

function Whiteboard({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" strokeLinecap="round">
      <rect x={2} y={3} width={60} height={24} rx={2} className="fill-mist" />
      <rect x={4} y={5} width={56} height={20} className="fill-white" />
      <path d="M8 10 H26 M8 14 H20 M8 20 H30" className="stroke-violet" strokeWidth={1.5} />
      <rect x={32} y={9} width={8} height={8} className="stroke-navy" strokeWidth={1.2} />
      <path d="M42 13 H48" className="stroke-navy" strokeWidth={1.2} />
      <rect x={50} y={9} width={6} height={8} className="fill-lavender stroke-navy" strokeWidth={1.2} />
    </g>
  );
}

function Coffee({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={16} cy={30} rx={10} ry={2} className="fill-navy" opacity={0.15} />
      <rect x={6} y={4} width={20} height={25} rx={3} className="fill-stone-800" />
      <rect x={8} y={6} width={16} height={6} rx={2} className="fill-stone-700" />
      <rect x={10} y={15} width={12} height={10} className="fill-navy" />
      <rect x={13} y={19} width={6} height={6} rx={1} className="fill-white" />
    </g>
  );
}

function DecorPiece({ d, s }: { d: FloorDecor; s: number }) {
  switch (d.kind) {
    case "plant":
      return <Plant x={d.x} y={d.y} s={s} />;
    case "bookshelf":
      return <Bookshelf x={d.x} y={d.y} s={s} />;
    case "whiteboard":
      return <Whiteboard x={d.x} y={d.y} s={s} />;
    case "coffee":
      return <Coffee x={d.x} y={d.y} s={s} />;
  }
}

/** Seated character in the atlas style ("type" frame), drawn in 32 unit atlas space around its feet. */
function Character({ member, facing, k }: { member: HeroCastMember; facing: FloorDesk["facing"]; k: number }) {
  const o = OUTFIT[member.palette];
  const skin = SKIN[member.skin % SKIN.length]!;
  const hair = HAIR[Math.floor(member.hair / 4) % HAIR.length]!;
  const style = member.hair % 4;
  const flip = facing === "left";
  const side = facing === "left" || facing === "right";
  return (
    <g transform={`scale(${k})`}>
      <g transform={`translate(-16 -32)${flip ? " translate(32 0) scale(-1 1)" : ""}`}>
        <ellipse cx={16} cy={30} rx={9} ry={2.6} className="fill-navy" opacity={0.18} />
        {/* legs tucked under (seated) */}
        <rect x={11.5} y={24} width={3.5} height={4} style={{ fill: o.pants }} />
        <rect x={17} y={24} width={3.5} height={4} style={{ fill: o.pants }} />
        <rect x={11.5} y={27} width={3.5} height={2} className="fill-stone-800" />
        <rect x={17} y={27} width={3.5} height={2} className="fill-stone-800" />
        {side ? (
          <>
            <rect x={11} y={15} width={10} height={11} rx={4} style={{ fill: o.shirt }} />
            <rect x={14} y={18} width={9} height={3.5} rx={1.7} style={{ fill: o.shirt }} />
            <circle cx={23} cy={19.7} r={1.5} style={{ fill: o.accent }} />
          </>
        ) : (
          <>
            <rect x={9} y={15} width={14} height={11} rx={4.5} style={{ fill: o.shirt }} />
            {facing === "down" ? (
              <>
                <path d="M13 15 L19 15 L16 18.5 Z" style={{ fill: o.accent }} />
                <rect x={8} y={17} width={4} height={7} rx={2} style={{ fill: o.shirt }} />
                <rect x={20} y={17} width={4} height={7} rx={2} style={{ fill: o.shirt }} />
                <rect x={10} y={22.5} width={5} height={3} rx={1.5} style={{ fill: o.shirt }} />
                <rect x={17} y={22.5} width={5} height={3} rx={1.5} style={{ fill: o.shirt }} />
                <circle cx={14.5} cy={24.5} r={1.4} style={{ fill: o.accent }} />
                <circle cx={17.5} cy={24.5} r={1.4} style={{ fill: o.accent }} />
              </>
            ) : (
              <>
                <rect x={10} y={22} width={12} height={1.2} className="fill-navy" opacity={0.12} />
                <rect x={7.5} y={16} width={4} height={5} rx={2} style={{ fill: o.shirt }} />
                <rect x={20.5} y={16} width={4} height={5} rx={2} style={{ fill: o.shirt }} />
              </>
            )}
          </>
        )}
        {/* torso outline so white and mist shirts read on light floors */}
        <rect x={side ? 11 : 9} y={15} width={side ? 10 : 14} height={11} rx={side ? 4 : 4.5} fill="none" className="stroke-navy" strokeOpacity={0.18} strokeWidth={0.8} />
        {/* head (centre 16,12 in this frame = atlas head at feet -20) */}
        <circle cx={16} cy={12} r={8.5} style={{ fill: skin }} className="stroke-navy" strokeOpacity={0.15} strokeWidth={0.6} />
        {facing === "down" ? (
          <>
            <circle cx={13} cy={13} r={1.25} className="fill-navy" />
            <circle cx={19} cy={13} r={1.25} className="fill-navy" />
          </>
        ) : side ? (
          <circle cx={20.5} cy={13} r={1.25} className="fill-navy" />
        ) : null}
        <Hair style={style} facing={flip ? "right" : facing} colour={hair} />
      </g>
    </g>
  );
}

function Hair({ style, facing, colour }: { style: number; facing: FloorDesk["facing"]; colour: string }) {
  // Head centre (16, 11) in the character frame; hair cap radius 9.
  const cx = 16;
  const cy = 11;
  const back = facing === "up";
  const f = { fill: colour };
  const parts: ReactNode[] = [];
  if (back) parts.push(<circle key="b" cx={cx} cy={cy} r={9} style={f} />);
  else {
    parts.push(<path key="cap" d={`M${cx - 9} ${cy} A9 9 0 0 1 ${cx + 9} ${cy} L${cx + 9} ${cy + 0.5} L${cx - 9} ${cy + 0.5} Z`} style={f} />);
    if (facing === "down") {
      parts.push(<circle key="b1" cx={cx - 4.5} cy={cy - 0.5} r={2.6} style={f} />, <circle key="b2" cx={cx} cy={cy - 1.5} r={2.6} style={f} />, <circle key="b3" cx={cx + 4.5} cy={cy - 0.5} r={2.6} style={f} />);
    } else {
      parts.push(<rect key="s" x={cx - 9} y={cy - 1} width={7} height={9} rx={3} style={f} />);
    }
  }
  if (style === 1) {
    if (back) parts.push(<rect key="l" x={cx - 8} y={cy} width={16} height={10} rx={4} style={f} />);
    else if (facing === "down") parts.push(<rect key="l1" x={cx - 10} y={cy - 2} width={4} height={11} rx={2} style={f} />, <rect key="l2" x={cx + 6} y={cy - 2} width={4} height={11} rx={2} style={f} />);
    else parts.push(<rect key="l" x={cx - 9} y={cy} width={7} height={10} rx={3} style={f} />);
  } else if (style === 2) {
    parts.push(<circle key="bun" cx={cx} cy={back ? cy - 6 : cy - 9} r={3.6} style={f} />);
  } else if (style === 3) {
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      parts.push(<circle key={`c${i}`} cx={round2(cx + Math.cos(a) * 8.5)} cy={round2(cy + Math.sin(a) * 8.5)} r={3} style={f} />);
    }
  }
  return <>{parts}</>;
}

/* ---------------------------------------------------------------- floor */

function roomPath(geometry: FloorGeometry, room: number): string {
  return geometry.walls
    .filter((w) => w.room === room)
    .map((w) => `M${w.x} ${w.y}h${w.w}v${w.h}h${-w.w}Z`)
    .join("");
}

function connectorPath(a: Point, b: Point, centre: Point): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Longer hops bend deeper, so connectors fanning out from one desk separate.
  const bend = Math.min(90, len * 0.26);
  // Bend toward the middle of the floor so curves never hug (or leave) the frame edge.
  let nx = -dy / len;
  let ny = dx / len;
  if ((centre.x - mx) * nx + (centre.y - my) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx + nx * bend).toFixed(1)} ${(my + ny * bend).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** Pre-computed static layers (floors, walls, doors, wall decor) per tile size. */
function StaticFloor({ geometry, idPrefix, vb }: { geometry: FloorGeometry; idPrefix: string; vb: { x: number; y: number; w: number; h: number } }) {
  const t = geometry.tile;
  const s = t / 32;
  const kinds = [...new Set<FloorKey>([...geometry.rooms.map((r) => r.kind), "CORRIDOR"])];
  return (
    <>
      <defs>
        {kinds.map((k) => (
          <pattern key={k} id={`${idPrefix}-floor-${k}`} width={t * 2} height={t * 2} patternUnits="userSpaceOnUse">
            <rect width={t * 2} height={t * 2} style={{ fill: FLOOR[k][0] }} />
            <rect x={t} width={t} height={t} style={{ fill: FLOOR[k][1] }} />
            <rect y={t} width={t} height={t} style={{ fill: FLOOR[k][1] }} />
            <path d={`M0 0.25H${t * 2}M0 ${t + 0.25}H${t * 2}M0.25 0V${t * 2}M${t + 0.25} 0V${t * 2}`} className="stroke-navy" strokeOpacity={0.05} strokeWidth={0.5} />
          </pattern>
        ))}
        <radialGradient id={`${idPrefix}-glow`}>
          {/* Warm lamp light: gold core easing into gold-deep (revision 1: warmer, 20% larger pools). */}
          <stop offset="0%" style={{ stopColor: v("gold"), stopOpacity: 0.85 }} />
          <stop offset="45%" style={{ stopColor: v("gold-deep"), stopOpacity: 0.38 }} />
          <stop offset="100%" style={{ stopColor: v("gold-deep"), stopOpacity: 0 }} />
        </radialGradient>
        <clipPath id={`${idPrefix}-clip`}>
          <rect width={geometry.width} height={geometry.height} rx={4} />
        </clipPath>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} rx={12} className="fill-navy-800" />
      <g clipPath={`url(#${idPrefix}-clip)`}>
        <rect width={geometry.width} height={geometry.height} fill={`url(#${idPrefix}-floor-CORRIDOR)`} />
        {geometry.rooms.map((r) => (
          <rect key={r.name} x={r.rect.x} y={r.rect.y} width={r.rect.w} height={r.rect.h} fill={`url(#${idPrefix}-floor-${r.kind})`} />
        ))}
        {geometry.rooms.map((r) => (
          <g key={`wall-${r.name}`}>
            <path d={roomPath(geometry, r.index)} style={{ fill: WALL[r.kind] ?? v("stone-300") }} />
            {/* light top band and baseboard of the inner wall face, as in the atlas wall tile */}
            <rect x={r.interior.x} y={r.interior.y - t * 0.22} width={r.interior.w} height={t * 0.22} className="fill-stone-500" opacity={0.55} />
          </g>
        ))}
        {/* doors: an opening in the wall (floor shows through) with two dark jambs */}
        {geometry.doors.map((d) => {
          const vertical = geometry.walls.some((w) => w.x === d.x && (w.y === d.y - d.h || w.y === d.y + d.h));
          return (
            <g key={`door-${d.x}-${d.y}`}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} style={{ fill: FLOOR.CORRIDOR[0] }} />
              {vertical ? (
                <>
                  <rect x={d.x} y={d.y} width={d.w} height={1.5} className="fill-stone-500" />
                  <rect x={d.x} y={d.y + d.h - 1.5} width={d.w} height={1.5} className="fill-stone-500" />
                </>
              ) : (
                <>
                  <rect x={d.x} y={d.y} width={1.5} height={d.h} className="fill-stone-500" />
                  <rect x={d.x + d.w - 1.5} y={d.y} width={1.5} height={d.h} className="fill-stone-500" />
                </>
              )}
            </g>
          );
        })}
        {geometry.decor
          .filter((d) => d.wall)
          .map((d) => (
            <DecorPiece key={`${d.kind}-${d.x}-${d.y}`} d={d} s={s} />
          ))}
      </g>
    </>
  );
}

export function OfficeFloorSvg({
  cast,
  states,
  lamps,
  highlightRoom,
  connectors = [],
  connectorSlots,
  onSelect,
  selectedId,
  interactive = false,
  tags = true,
  idPrefix = "floor",
  children,
  employeeRef,
  title,
  className,
  tile = HERO_TILE,
  rows,
}: Props) {
  const g = buildFloorGeometry(tile);
  const s = g.tile / 32;
  const k = s * 1.8; // characters drawn larger than the atlas so they read at hero size
  const vb = croppedViewBox(g, rows);
  const deskById = new Map(g.desks.map((d) => [d.id, d]));
  const memberByDesk = new Map(cast.map((m) => [m.deskId, m]));
  const levelOf = (id: string): LampLevel => lamps?.[id] ?? lampLevelFor(states[id]);
  const byId = new Map(cast.map((m) => [m.id, m]));

  // Y-sorted objects (as Pixi zIndex in scene.ts): chairs, desks, monitors, lamps, characters, floor decor.
  type Obj = { z: number; key: string; node: ReactNode };
  const objs: Obj[] = [];
  for (const desk of g.desks) {
    const seat = g.seats[desk.id]!;
    const member = memberByDesk.get(desk.id);
    const deskBottom = desk.y + g.tile;
    const chairAt = { x: (seat.tile.x + 0.5) * g.tile, y: (seat.tile.y + 1) * g.tile - 5 * s + 3 * s };
    const state = member ? states[member.id] : undefined;
    objs.push({ z: chairAt.y - 9 * s, key: `chair-${desk.id}`, node: <Chair at={chairAt} s={s} /> });
    objs.push({ z: deskBottom - 2 * s, key: `desk-${desk.id}`, node: <Desk desk={desk} s={s} /> });
    objs.push({ z: deskBottom - 1 * s, key: `mon-${desk.id}`, node: <Monitor desk={desk} s={s} on={state === "WORKING" || state === "COLLABORATING"} /> });
    if (member) {
      objs.push({ z: deskBottom, key: `lamp-${desk.id}`, node: <Lamp at={lampCentre(desk, s)} level={levelOf(member.id)} s={s} /> });
    }
  }
  for (const d of g.decor) {
    if (d.wall) continue;
    objs.push({ z: d.y + g.tile, key: `decor-${d.kind}-${d.x}-${d.y}`, node: <DecorPiece d={d} s={s} /> });
  }
  for (const m of cast) {
    const seat = g.seats[m.deskId];
    if (!seat) continue;
    const selected = selectedId === m.id;
    const state = states[m.id] ?? "IDLE";
    const label = `${m.name}, ${m.role}. ${VISUAL_LABEL[state]}. Show details`;
    const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(m.id);
      }
    };
    objs.push({
      z: seat.feet.y,
      key: `emp-${m.id}`,
      node: (
        <g
          ref={employeeRef ? (el) => employeeRef(m.id, el) : undefined}
          transform={`translate(${seat.feet.x.toFixed(1)} ${seat.feet.y.toFixed(1)})`}
          data-employee={m.id}
          data-state={state}
          {...(interactive
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": label,
                "aria-haspopup": "dialog" as const,
                "aria-expanded": selected,
                onClick: () => onSelect?.(m.id),
                onKeyDown,
                className: "group cursor-pointer outline-none",
              }
            : { "aria-hidden": true })}
        >
          {/* hit area + selection / focus ring */}
          <ellipse cx={0} cy={-1} rx={11 * k} ry={4.2 * k} className={cn("fill-violet/15 stroke-violet transition-opacity duration-[160ms]", selected ? "opacity-100" : "opacity-0")} strokeWidth={1.5} />
          {interactive ? (
            <rect x={-12 * k} y={-31 * k} width={24 * k} height={33 * k} rx={6} className="fill-transparent stroke-gold opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
          ) : null}
          <Character member={m} facing={seat.facing} k={k} />
        </g>
      ),
    });
  }
  objs.sort((a, b) => a.z - b.z);

  const tagFor = (m: HeroCastMember) => {
    const seat = g.seats[m.deskId];
    if (!seat) return null;
    const state = states[m.id] ?? "IDLE";
    const active = state !== "IDLE";
    const first = m.name.split(" ")[0]!;
    const stateText = active ? VISUAL_LABEL[state] : "";
    const charW = 5.5;
    const w = Math.round(12 + (active ? 10 : 0) + first.length * (charW + 0.4) + (active ? 4 + stateText.length * charW : 0));
    const h = 15;
    const half = w / 2;
    const cx = Math.min(Math.max(seat.feet.x, half + 3), g.width - half - 3);
    const y = Math.max(vb.y + 1, seat.feet.y - 31 * k - h - 1);
    return (
      <g key={`tag-${m.id}`} transform={`translate(${cx.toFixed(1)} ${y.toFixed(1)})`} className="pointer-events-none" aria-hidden>
        <g className="transition-opacity duration-[240ms]" opacity={active ? 1 : 0.82}>
          <rect x={-half} y={0} width={w} height={h} rx={7.5} className={active ? "fill-navy" : "fill-navy/70"} />
          {active ? <circle cx={-half + 9} cy={h / 2} r={2.6} style={{ fill: STATE_DOT[state] ?? v("mist") }} /> : null}
          <text x={-half + (active ? 16 : 6)} y={10.6} fontSize={9.5} className="fill-snow font-sans" fontWeight={600}>
            {first}
            {active ? (
              <tspan dx={4} fontWeight={500} className="fill-mist">
                {stateText}
              </tspan>
            ) : null}
          </text>
        </g>
      </g>
    );
  };

  const shown = new Map(connectors.map((c) => [c.id ?? `${c.from}>${c.to}`, c]));
  const slots = connectorSlots ?? connectors;
  const highlighted = highlightRoom ? g.rooms.find((r) => r.name === highlightRoom) : undefined;

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={cn("block h-auto w-full font-sans select-none", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title || interactive ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
    >
      <StaticFloor geometry={g} idPrefix={idPrefix} vb={vb} />
      <g clipPath={`url(#${idPrefix}-clip)`}>
        {/* lamp light pools under the objects */}
        {cast.map((m) => {
          const desk = deskById.get(m.deskId);
          if (!desk) return null;
          const c = lampCentre(desk, s);
          return (
            <circle
              key={`glow-${m.id}`}
              cx={c.x}
              cy={c.y + 4}
              r={g.tile * 2.64}
              fill={`url(#${idPrefix}-glow)`}
              className="transition-opacity duration-[400ms] ease-brand"
              opacity={levelOf(m.id) === "on" ? 1 : 0}
              data-glow={m.id}
            />
          );
        })}
        {/* the lit lamp warms the desk tile under it, so lit desks read from across the room */}
        {cast.map((m) => {
          const desk = deskById.get(m.deskId);
          if (!desk) return null;
          return (
            <ellipse
              key={`warm-${m.id}`}
              cx={desk.cx}
              cy={desk.cy + g.tile * 0.15}
              rx={g.tile * 1.5}
              ry={g.tile * 0.96}
              className="fill-gold transition-opacity duration-[400ms] ease-brand"
              opacity={levelOf(m.id) === "on" ? 0.42 : 0}
            />
          );
        })}
        {highlighted ? (
          <rect x={highlighted.rect.x + 1} y={highlighted.rect.y + 1} width={highlighted.rect.w - 2} height={highlighted.rect.h - 2} rx={3} fill="none" className="stroke-gold" strokeWidth={2.5} />
        ) : null}
        {objs.map((o) => (
          <g key={o.key}>{o.node}</g>
        ))}
        {/* small halo on lit shades, above the desks */}
        {cast.map((m) => {
          const desk = deskById.get(m.deskId);
          if (!desk) return null;
          const c = lampCentre(desk, s);
          return (
            <circle key={`halo-${m.id}`} cx={c.x} cy={c.y} r={g.tile * 0.66} fill={`url(#${idPrefix}-glow)`} className="pointer-events-none transition-opacity duration-[400ms]" opacity={levelOf(m.id) === "on" ? 0.9 : 0} />
          );
        })}
        {slots.map((slot) => {
          const id = slot.id ?? `${slot.from}>${slot.to}`;
          const from = byId.get(slot.from);
          const to = byId.get(slot.to);
          if (!from || !to) return null;
          const c = shown.get(id);
          const d = connectorPath(headOf(g, from), headOf(g, to), { x: g.width / 2, y: (vb.y + vb.h) / 2 });
          return (
            <g key={`conn-${id}`} className="pointer-events-none transition-opacity duration-[400ms] ease-brand" opacity={c ? 1 : 0} data-connector={id}>
              {/* navy halo keeps the lavender line legible on the light floor */}
              <path d={d} fill="none" className="stroke-navy" strokeOpacity={0.35} strokeWidth={4.5} strokeLinecap="round" />
              <AnimatedConnector d={d} active={!!c?.active} tone="lavender" strokeWidth={2} />
            </g>
          );
        })}
        {children}
      </g>
      {tags ? <g className="max-sm:hidden">{cast.map(tagFor)}</g> : null}
    </svg>
  );
}

export { buildFloorGeometry };
