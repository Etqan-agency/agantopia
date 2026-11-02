/**
 * Pure geometry for the marketing office floor (hero, final CTA callback).
 *
 * Reuses the product's own floor builder (`src/office/floor-plan.ts`) on
 * `DEFAULT_LAYOUT` / `DEFAULT_ROOMS`, so rooms, walls, doors, desks, seats and
 * decor sit exactly where the real office puts them. Everything is converted
 * from tiles to SVG user units with a `tile` scale (16 by default, which makes
 * one user unit roughly one CSS pixel at desktop hero size).
 *
 * Relative imports only: this module is unit-tested by vitest without the `@/` alias.
 */
import { DEFAULT_LAYOUT, DEFAULT_ROOMS, type RoomKind, type RoomView } from "@agentopia/shared";
import { buildFloorPlan, FACING_DELTA, type DecorKind, type Facing } from "../../../office/floor-plan";

export const HERO_TILE = 16;
/** Navy frame around the floor, in user units. */
export const FRAME_PAD = 8;

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type FloorRoom = { index: number; name: string; kind: RoomKind; rect: Rect; interior: Rect };
export type FloorDesk = {
  id: string;
  room: number;
  roomName: string;
  /** Index of the desk inside its room (DEFAULT_ROOMS deskSlots order). */
  slot: number;
  facing: Facing;
  /** Top-left of the desk tile. */
  x: number;
  y: number;
  /** Centre of the desk tile. */
  cx: number;
  cy: number;
};
export type FloorSeat = { deskId: string; facing: Facing; tile: Point; /** Feet position of a seated employee. */ feet: Point };
export type FloorDecor = { kind: DecorKind; x: number; y: number; wall: boolean };
export type FloorDoor = Rect & { room: number };

export type FloorGeometry = {
  tile: number;
  width: number;
  height: number;
  /** viewBox including the frame padding. */
  viewBox: { x: number; y: number; w: number; h: number };
  rooms: FloorRoom[];
  /** Wall tiles grouped as one rect per wall tile (doors excluded). */
  walls: Array<Rect & { room: number }>;
  doors: FloorDoor[];
  /** Centre of each contiguous door opening. */
  doorMidpoints: Array<Point & { room: number }>;
  desks: FloorDesk[];
  seats: Record<string, FloorSeat>;
  decor: FloorDecor[];
};

/** Stable desk id: `${roomIndex}-${slotIndex}`. */
export function deskId(roomIndex: number, slot: number): string {
  return `${roomIndex}-${slot}`;
}

export function roomIndexByName(name: string): number {
  const i = DEFAULT_ROOMS.findIndex((r) => r.name === name);
  if (i < 0) throw new Error(`Unknown room: ${name}`);
  return i;
}

function defaultRoomViews(): RoomView[] {
  return DEFAULT_ROOMS.map((r, i) => ({
    id: `room-${i}`,
    name: r.name,
    kind: r.kind,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    desks: r.deskSlots.map((d, k) => ({ id: deskId(i, k), x: d.x, y: d.y, facing: d.facing, employeeId: null })),
  }));
}

const cache = new Map<number, FloorGeometry>();

export function buildFloorGeometry(tile: number = HERO_TILE): FloorGeometry {
  const hit = cache.get(tile);
  if (hit) return hit;
  const views = defaultRoomViews();
  const plan = buildFloorPlan(DEFAULT_LAYOUT, views);
  const t = tile;
  // Seat offset toward the desk (product: 5px at a 32px tile).
  const lean = (5 * t) / 32;

  const rooms: FloorRoom[] = views.map((r, i) => ({
    index: i,
    name: r.name,
    kind: r.kind,
    rect: { x: r.x * t, y: r.y * t, w: r.w * t, h: r.h * t },
    interior: { x: (r.x + 1) * t, y: (r.y + 1) * t, w: (r.w - 2) * t, h: (r.h - 2) * t },
  }));

  const desks: FloorDesk[] = plan.desks.map((d) => {
    const [ri, slot] = d.id.split("-").map(Number) as [number, number];
    return {
      id: d.id,
      room: ri,
      roomName: views[ri]!.name,
      slot,
      facing: d.facing,
      x: d.x * t,
      y: d.y * t,
      cx: (d.x + 0.5) * t,
      cy: (d.y + 0.5) * t,
    };
  });

  const seats: Record<string, FloorSeat> = {};
  for (const [id, p] of plan.seats) {
    const delta = FACING_DELTA[p.facing];
    seats[id] = {
      deskId: id,
      facing: p.facing,
      tile: { x: p.tile.x, y: p.tile.y },
      feet: { x: (p.tile.x + 0.5) * t + delta.x * lean, y: (p.tile.y + 1) * t - (5 * t) / 32 + delta.y * lean },
    };
  }

  const doors: FloorDoor[] = plan.doors.map((d) => ({ x: d.x * t, y: d.y * t, w: t, h: t, room: d.room }));

  // Group 4-connected door tiles into openings and take each group's centre.
  const doorMidpoints: FloorGeometry["doorMidpoints"] = [];
  const seen = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const doorTiles = new Map(plan.doors.map((d) => [key(d.x, d.y), d]));
  for (const d of plan.doors) {
    if (seen.has(key(d.x, d.y))) continue;
    const stack = [d];
    const group: typeof plan.doors = [];
    seen.add(key(d.x, d.y));
    while (stack.length) {
      const cur = stack.pop()!;
      group.push(cur);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = key(cur.x + dx, cur.y + dy);
        const next = doorTiles.get(k);
        if (next && !seen.has(k)) {
          seen.add(k);
          stack.push(next);
        }
      }
    }
    const cx = group.reduce((s, g) => s + g.x + 0.5, 0) / group.length;
    const cy = group.reduce((s, g) => s + g.y + 0.5, 0) / group.length;
    doorMidpoints.push({ x: cx * t, y: cy * t, room: d.room });
  }

  const geometry: FloorGeometry = {
    tile: t,
    width: plan.width * t,
    height: plan.height * t,
    viewBox: { x: -FRAME_PAD, y: -FRAME_PAD, w: plan.width * t + FRAME_PAD * 2, h: plan.height * t + FRAME_PAD * 2 },
    rooms,
    walls: plan.walls.map((w) => ({ x: w.x * t, y: w.y * t, w: t, h: t, room: w.room })),
    doors,
    doorMidpoints,
    desks,
    seats,
    decor: plan.decor.map((d) => ({ kind: d.kind, x: d.x * t, y: d.y * t, wall: d.wall })),
  };
  cache.set(tile, geometry);
  return geometry;
}

/* -------------------------------------------------------------------------- */
/* Hero cast                                                                  */
/* -------------------------------------------------------------------------- */

export type HeroProvider = "Claude Code" | "OpenAI Codex";

export type HeroCastMember = {
  id: string;
  name: string;
  role: string;
  specialty: string;
  skills: readonly [string, string, string];
  provider: HeroProvider;
  /** Avatar palette id from src/office/palette.ts CHARACTER_PALETTES. */
  palette: "moss" | "brick" | "sky" | "saffron" | "ink" | "plum" | "teal";
  hair: number;
  skin: number;
  deskId: string;
};

const MANAGER_ROOM = roomIndexByName("Manager's office");
const DEV_ROOM = roomIndexByName("Development");
const DESIGN_ROOM = roomIndexByName("Design");
const RESEARCH_ROOM = roomIndexByName("Research");
const QA_ROOM = roomIndexByName("QA lab");

/** Six example employees pinned to specific desks of the default floor. */
export const HERO_CAST: readonly HeroCastMember[] = [
  {
    id: "manager",
    name: "Morgan Hale",
    role: "AI Manager",
    specialty: "Management",
    skills: ["Planning", "Delegation", "Review"],
    provider: "Claude Code",
    palette: "sky",
    hair: 2,
    skin: 1,
    deskId: deskId(MANAGER_ROOM, 0),
  },
  {
    id: "researcher",
    name: "Nour Hany",
    role: "Researcher",
    specialty: "Research",
    skills: ["Competitor analysis", "Cited sources", "Summaries"],
    provider: "OpenAI Codex",
    palette: "plum",
    hair: 5,
    skin: 2,
    deskId: deskId(RESEARCH_ROOM, 0),
  },
  {
    id: "designer",
    name: "Maya Brooks",
    role: "Designer",
    specialty: "UI/UX",
    skills: ["Interaction specs", "Design tokens", "Accessibility"],
    provider: "Claude Code",
    palette: "saffron",
    hair: 1,
    skin: 0,
    deskId: deskId(DESIGN_ROOM, 0),
  },
  {
    id: "developer",
    name: "Daniel Reid",
    role: "Developer",
    specialty: "Frontend",
    skills: ["React", "Next.js", "TypeScript"],
    provider: "OpenAI Codex",
    palette: "teal",
    hair: 0,
    skin: 3,
    deskId: deskId(DEV_ROOM, 1),
  },
  {
    id: "qa",
    name: "Kenji Sato",
    role: "QA Engineer",
    specialty: "QA",
    skills: ["Test plans", "Playwright", "Vitest"],
    provider: "Claude Code",
    palette: "brick",
    hair: 3,
    skin: 4,
    deskId: deskId(QA_ROOM, 0),
  },
  {
    id: "developer-2",
    name: "Theo Park",
    role: "Developer",
    specialty: "Backend",
    skills: ["APIs", "Databases", "Migrations"],
    provider: "OpenAI Codex",
    palette: "ink",
    hair: 4,
    skin: 1,
    deskId: deskId(DEV_ROOM, 4),
  },
];

export type HeroId = (typeof HERO_CAST)[number]["id"];

export function castMember(id: string): HeroCastMember {
  const m = HERO_CAST.find((c) => c.id === id);
  if (!m) throw new Error(`Unknown cast member: ${id}`);
  return m;
}

/**
 * Rows of the floor the hero shows: the six story rooms (rows 0..16) plus a sliver of the
 * lounge wall, so the empty lounge falls out of frame.
 */
export const HERO_ROWS = 17.5;

/** Fixed viewBox for a floor cropped to `rows` tiles (no frame padding at the cropped bottom edge). */
export function croppedViewBox(geometry: FloorGeometry, rows?: number): { x: number; y: number; w: number; h: number } {
  if (rows === undefined || rows * geometry.tile >= geometry.height) return geometry.viewBox;
  return { x: geometry.viewBox.x, y: geometry.viewBox.y, w: geometry.viewBox.w, h: rows * geometry.tile - geometry.viewBox.y };
}

/** Head position (connector anchor) of a seated cast member, in user units. */
export function headOf(geometry: FloorGeometry, member: HeroCastMember): Point {
  const seat = geometry.seats[member.deskId]!;
  return { x: seat.feet.x, y: seat.feet.y - geometry.tile * 1.15 };
}
