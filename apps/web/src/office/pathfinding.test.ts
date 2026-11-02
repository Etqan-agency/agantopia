import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, DEFAULT_ROOMS, type RoomView } from "@agentopia/shared";
import { createGrid, findPath, isWalkable, nearestWalkable, reachableCount, setWalkable } from "./pathfinding";
import { buildFloorPlan } from "./floor-plan";

function defaultRooms(): RoomView[] {
  return DEFAULT_ROOMS.map((r, i) => ({
    id: `room-${i}`,
    name: r.name,
    kind: r.kind,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    desks: r.deskSlots.map((d, j) => ({ id: `desk-${i}-${j}`, x: d.x, y: d.y, facing: d.facing, employeeId: null })),
  }));
}

describe("findPath", () => {
  it("returns a straight path on an open grid", () => {
    const g = createGrid(5, 5, 1);
    const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[4]).toEqual({ x: 4, y: 0 });
  });

  it("returns [from] when from equals to", () => {
    const g = createGrid(3, 3, 1);
    expect(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });

  it("routes around walls with an optimal length", () => {
    const g = createGrid(5, 5, 1);
    for (let y = 0; y < 4; y++) setWalkable(g, 2, y, false); // wall with a gap at the bottom
    const p = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(p).not.toBeNull();
    expect(p.length - 1).toBe(4 + 4 + 4); // down 4, across 4, up 4
    for (const t of p) expect(isWalkable(g, t.x, t.y)).toBe(true);
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i]!.x - p[i - 1]!.x) + Math.abs(p[i]!.y - p[i - 1]!.y)).toBe(1);
    }
  });

  it("returns null when unreachable or endpoints blocked", () => {
    const g = createGrid(5, 5, 1);
    for (let y = 0; y < 5; y++) setWalkable(g, 2, y, false);
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 4 })).toBeNull();
    expect(findPath(g, { x: 2, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it("is deterministic", () => {
    const g = createGrid(12, 12, 1);
    setWalkable(g, 5, 5, false);
    const a = findPath(g, { x: 0, y: 0 }, { x: 11, y: 11 });
    const b = findPath(g, { x: 0, y: 0 }, { x: 11, y: 11 });
    expect(a).toEqual(b);
  });

  it("nearestWalkable finds the closest open tile", () => {
    const g = createGrid(5, 5, 1);
    setWalkable(g, 2, 2, false);
    const t = nearestWalkable(g, { x: 2, y: 2 })!;
    expect(Math.abs(t.x - 2) + Math.abs(t.y - 2)).toBe(1);
  });
});

describe("buildFloorPlan (default rooms)", () => {
  const plan = buildFloorPlan(DEFAULT_LAYOUT, defaultRooms());

  it("blocks desks and keeps seats walkable", () => {
    for (const d of plan.desks) {
      expect(isWalkable(plan.grid, d.x, d.y)).toBe(false);
      const seat = plan.seats.get(d.id)!;
      expect(isWalkable(plan.grid, seat.tile.x, seat.tile.y)).toBe(true);
      expect(seat.facing).toBe(d.facing);
    }
  });

  it("seat sits opposite the desk facing", () => {
    const manager = plan.desks.find((d) => plan.roomKinds[d.room] === "MANAGER_OFFICE")!;
    expect(plan.seats.get(manager.id)!.tile).toEqual({ x: manager.x, y: manager.y - 1 });
    expect(plan.visits.get(manager.id)!.tile).toEqual({ x: manager.x, y: manager.y + 1 });
    expect(plan.visits.get(manager.id)!.facing).toBe("up");
  });

  it("carves doors so every room is connected", () => {
    expect(plan.doors.length).toBeGreaterThan(0);
    const start = plan.seats.values().next().value!.tile;
    let walkableCount = 0;
    for (let i = 0; i < plan.grid.walkable.length; i++) walkableCount += plan.grid.walkable[i]!;
    expect(reachableCount(plan.grid, start)).toBe(walkableCount);
  });

  it("every seat can reach the manager's visitor spot", () => {
    const manager = plan.desks.find((d) => plan.roomKinds[d.room] === "MANAGER_OFFICE")!;
    const visit = plan.visits.get(manager.id)!.tile;
    for (const d of plan.desks) {
      const seat = plan.seats.get(d.id)!.tile;
      const path = findPath(plan.grid, seat, visit);
      expect(path, `desk ${d.id}`).not.toBeNull();
    }
  });

  it("decor never blocks seats, visitor spots or doors", () => {
    const occupied = new Set(plan.decor.filter((d) => d.blocking).map((d) => `${d.x},${d.y}`));
    for (const s of plan.seats.values()) expect(occupied.has(`${s.tile.x},${s.tile.y}`)).toBe(false);
    for (const v of plan.visits.values()) expect(occupied.has(`${v.tile.x},${v.tile.y}`)).toBe(false);
    for (const d of plan.doors) expect(occupied.has(`${d.x},${d.y}`)).toBe(false);
  });

  it("offers spawn tiles for desk-less employees", () => {
    expect(plan.spawnTiles.length).toBeGreaterThan(40);
    for (const t of plan.spawnTiles) expect(isWalkable(plan.grid, t.x, t.y)).toBe(true);
  });
});
