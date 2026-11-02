/**
 * Derives the walkable grid and static decoration of a floor from its
 * FloorView (rooms + desks + layout). Pure: no Pixi, no DOM.
 *
 * Conventions
 * - A room's outer ring of tiles is its wall; the interior is walkable.
 * - Tiles that are in no room are corridors (walkable).
 * - Doors are carved at the midpoint (and quarter points on long sides) of
 *   each wall side, through to the next walkable tile (corridor or the
 *   interior of an adjacent room).
 * - A desk blocks its tile. The employee sits on the tile opposite the desk's
 *   `facing` (facing "down" → seat is above the desk, looking down at it).
 *   Visitors stand on the tile on the `facing` side, looking back.
 */
import type { DeskView, FloorLayout, RoomView } from "@agentopia/shared";
import type { RoomKind } from "@agentopia/shared";
import { createGrid, inBounds, isWalkable, nearestWalkable, setWalkable, type Grid, type Tile } from "./pathfinding";

export type Facing = DeskView["facing"];

export type DecorKind = "plant" | "bookshelf" | "coffee" | "whiteboard";

export type Decor = { kind: DecorKind; x: number; y: number; blocking: boolean; wall: boolean };

export type Placement = { tile: Tile; facing: Facing };

export type FloorPlan = {
  width: number;
  height: number;
  tileSize: number;
  grid: Grid;
  /** Room index per tile (-1 = corridor). */
  roomAt: Int16Array;
  /** Room kind per room index. */
  roomKinds: RoomKind[];
  walls: Array<Tile & { room: number }>;
  doors: Array<Tile & { room: number }>;
  desks: Array<DeskView & { room: number }>;
  seats: Map<string, Placement>;
  visits: Map<string, Placement>;
  decor: Decor[];
  /** Ordered free tiles for employees without a desk (lounge first). */
  spawnTiles: Tile[];
};

export const FACING_DELTA: Record<Facing, Tile> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

export function facingBetween(from: Tile, to: Tile, fallback: Facing = "down"): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

const KNOWN_PROPS: Record<string, DecorKind> = {
  plant: "plant",
  bookshelf: "bookshelf",
  shelf: "bookshelf",
  coffee: "coffee",
  coffee_machine: "coffee",
  coffeeMachine: "coffee",
  whiteboard: "whiteboard",
};

export function buildFloorPlan(layout: FloorLayout, rooms: RoomView[]): FloorPlan {
  const width = Math.max(1, layout.width);
  const height = Math.max(1, layout.height);
  const grid = createGrid(width, height, 1); // corridors walkable by default
  const roomAt = new Int16Array(width * height).fill(-1);
  const isWall = new Uint8Array(width * height);
  const walls: FloorPlan["walls"] = [];
  const doors: FloorPlan["doors"] = [];

  rooms.forEach((room, r) => {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (!inBounds(grid, x, y)) continue;
        roomAt[y * width + x] = r;
        const edge = x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1;
        if (edge) {
          isWall[y * width + x] = 1;
          setWalkable(grid, x, y, false);
        } else {
          setWalkable(grid, x, y, true);
        }
      }
    }
  });

  // Carve doors.
  const doorSet = new Set<number>();
  const carve = (x: number, y: number, dx: number, dy: number, r: number) => {
    // inward tile must be interior of this room
    if (!isWalkable(grid, x - dx, y - dy)) return;
    const chain: Tile[] = [];
    let cx = x;
    let cy = y;
    for (let step = 0; step < 3; step++) {
      if (!inBounds(grid, cx, cy)) return;
      const i = cy * width + cx;
      if (isWall[i]) {
        chain.push({ x: cx, y: cy });
      } else if (grid.walkable[i]) {
        for (const t of chain) {
          const ti = t.y * width + t.x;
          if (doorSet.has(ti)) continue;
          doorSet.add(ti);
          setWalkable(grid, t.x, t.y, true);
          doors.push({ x: t.x, y: t.y, room: roomAt[ti]! >= 0 ? roomAt[ti]! : r });
        }
        return;
      } else {
        return;
      }
      cx += dx;
      cy += dy;
    }
  };
  rooms.forEach((room, r) => {
    const sides: Array<{ along: "x" | "y"; fixed: number; start: number; len: number; dx: number; dy: number }> = [
      { along: "x", fixed: room.y, start: room.x, len: room.w, dx: 0, dy: -1 },
      { along: "x", fixed: room.y + room.h - 1, start: room.x, len: room.w, dx: 0, dy: 1 },
      { along: "y", fixed: room.x, start: room.y, len: room.h, dx: -1, dy: 0 },
      { along: "y", fixed: room.x + room.w - 1, start: room.y, len: room.h, dx: 1, dy: 0 },
    ];
    for (const s of sides) {
      const offsets = s.len > 12 ? [Math.floor(s.len / 4), Math.floor(s.len / 2), Math.floor((3 * s.len) / 4)] : [Math.floor(s.len / 2)];
      for (const o of offsets) {
        const p = s.start + o;
        const x = s.along === "x" ? p : s.fixed;
        const y = s.along === "x" ? s.fixed : p;
        carve(x, y, s.dx, s.dy, r);
      }
    }
  });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isWall[i] && !doorSet.has(i)) walls.push({ x, y, room: roomAt[i]! });
    }
  }

  // Desks, seats, visitor spots.
  const desks: FloorPlan["desks"] = [];
  rooms.forEach((room, r) => room.desks.forEach((d) => desks.push({ ...d, room: r })));
  for (const d of desks) setWalkable(grid, d.x, d.y, false);
  const reserved = new Set<number>(); // tiles that must stay free (seats, visits, door approaches)
  const seats = new Map<string, Placement>();
  const visits = new Map<string, Placement>();
  for (const d of desks) {
    const back = FACING_DELTA[OPPOSITE[d.facing]];
    const seatTile = { x: d.x + back.x, y: d.y + back.y };
    const seat = isWalkable(grid, seatTile.x, seatTile.y) ? seatTile : nearestWalkable(grid, { x: d.x, y: d.y }) ?? seatTile;
    seats.set(d.id, { tile: seat, facing: d.facing });
    reserved.add(seat.y * width + seat.x);
  }
  for (const d of desks) {
    const front = FACING_DELTA[d.facing];
    const want = { x: d.x + front.x, y: d.y + front.y };
    const tile =
      isWalkable(grid, want.x, want.y) && !reserved.has(want.y * width + want.x)
        ? want
        : nearestWalkable(grid, want, (t) => reserved.has(t.y * width + t.x)) ?? want;
    visits.set(d.id, { tile, facing: facingBetween(tile, { x: d.x, y: d.y }, OPPOSITE[d.facing]) });
    reserved.add(tile.y * width + tile.x);
  }
  for (const door of doors) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) reserved.add((door.y + dy) * width + (door.x + dx));
    reserved.add(door.y * width + door.x);
  }

  // Decor.
  const decor: Decor[] = [];
  const free = (x: number, y: number) => isWalkable(grid, x, y) && !reserved.has(y * width + x) && roomAt[y * width + x] !== -1;
  const place = (kind: DecorKind, x: number, y: number) => {
    if (!free(x, y)) return;
    decor.push({ kind, x, y, blocking: true, wall: false });
    setWalkable(grid, x, y, false);
    reserved.add(y * width + x);
  };
  const wallMount = (kind: DecorKind, x: number, y: number, span = 1) => {
    for (let k = 0; k < span; k++) {
      const i = y * width + x + k;
      if (!inBounds(grid, x + k, y) || !isWall[i] || doorSet.has(i)) return;
    }
    decor.push({ kind, x, y, blocking: false, wall: true });
  };
  rooms.forEach((room) => {
    const x0 = room.x + 1;
    const y0 = room.y + 1;
    const x1 = room.x + room.w - 2;
    const y1 = room.y + room.h - 2;
    if (x1 < x0 || y1 < y0) return;
    switch (room.kind) {
      case "MANAGER_OFFICE":
        wallMount("bookshelf", room.x + 2, room.y);
        place("plant", x0, y1);
        place("plant", x1, y0);
        break;
      case "DEVELOPMENT":
        wallMount("whiteboard", room.x + 2, room.y, 2);
        place("plant", x1, y1);
        place("plant", x0, y1);
        break;
      case "DESIGN":
        wallMount("whiteboard", room.x + room.w - 4, room.y, 2);
        place("plant", x0, y1);
        break;
      case "RESEARCH":
        wallMount("bookshelf", room.x + 2, room.y);
        wallMount("bookshelf", room.x + room.w - 3, room.y);
        place("plant", x1, y1);
        break;
      case "QA":
        wallMount("whiteboard", room.x + 2, room.y, 2);
        place("plant", x1, y1);
        break;
      case "SHARED":
        place("coffee", x1, y0);
        place("plant", x0, y0);
        place("plant", x0, y1);
        break;
      case "LOUNGE":
        place("coffee", x0, y0);
        for (let x = x0 + 4; x <= x1; x += 7) place("plant", x, y1);
        place("plant", x1, y0);
        break;
    }
  });
  for (const p of layoutProps(layoutPropsOf(layout))) place(p.kind, p.x, p.y);

  // Spawn tiles for desk-less employees: lounge, then shared, then corridors.
  const spawnTiles: Tile[] = [];
  const kindOrder: RoomKind[] = ["LOUNGE", "SHARED"];
  for (const kind of kindOrder) {
    rooms.forEach((room) => {
      if (room.kind !== kind) return;
      for (let y = room.y + 2; y <= room.y + room.h - 3; y += 2) {
        for (let x = room.x + 2; x <= room.x + room.w - 3; x += 2) {
          if (free(x, y)) spawnTiles.push({ x, y });
        }
      }
    });
  }
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 3) {
      if (isWalkable(grid, x, y) && roomAt[y * width + x] === -1 && !reserved.has(y * width + x)) spawnTiles.push({ x, y });
    }
  }

  return {
    width,
    height,
    tileSize: layout.tileSize || 32,
    grid,
    roomAt,
    roomKinds: rooms.map((r) => r.kind),
    walls,
    doors,
    desks,
    seats,
    visits,
    decor,
    spawnTiles,
  };
}

function layoutPropsOf(layout: FloorLayout): Array<{ kind: string; x: number; y: number }> {
  return Array.isArray(layout.props) ? layout.props : [];
}

function layoutProps(props: Array<{ kind: string; x: number; y: number }>): Array<{ kind: DecorKind; x: number; y: number }> {
  const out: Array<{ kind: DecorKind; x: number; y: number }> = [];
  for (const p of props) {
    const kind = KNOWN_PROPS[p.kind];
    if (kind && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push({ kind, x: p.x, y: p.y });
  }
  return out;
}
