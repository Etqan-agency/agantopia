/**
 * Grid A* over walkable tiles. Pure and deterministic: identical inputs always
 * produce the identical path (ties are broken by insertion order).
 */
export type Tile = { x: number; y: number };

export type Grid = {
  width: number;
  height: number;
  /** 1 = walkable, 0 = blocked; index = y * width + x. */
  walkable: Uint8Array;
};

export function createGrid(width: number, height: number, fill: 0 | 1 = 0): Grid {
  return { width, height, walkable: new Uint8Array(width * height).fill(fill) };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function isWalkable(grid: Grid, x: number, y: number): boolean {
  return inBounds(grid, x, y) && grid.walkable[y * grid.width + x] === 1;
}

export function setWalkable(grid: Grid, x: number, y: number, value: boolean): void {
  if (inBounds(grid, x, y)) grid.walkable[y * grid.width + x] = value ? 1 : 0;
}

// Neighbour order is fixed (up, right, down, left) so paths are deterministic.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Minimal binary heap keyed by (f, h, order). */
class Heap {
  private items: Array<{ i: number; f: number; h: number; o: number }> = [];
  get size(): number {
    return this.items.length;
  }
  private less(a: { f: number; h: number; o: number }, b: { f: number; h: number; o: number }): boolean {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    return a.o < b.o;
  }
  push(item: { i: number; f: number; h: number; o: number }): void {
    const a = this.items;
    a.push(item);
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (!this.less(a[n]!, a[p]!)) break;
      [a[n], a[p]] = [a[p]!, a[n]!];
      n = p;
    }
  }
  pop(): { i: number; f: number; h: number; o: number } | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = 2 * n + 1;
        const r = l + 1;
        let m = n;
        if (l < a.length && this.less(a[l]!, a[m]!)) m = l;
        if (r < a.length && this.less(a[r]!, a[m]!)) m = r;
        if (m === n) break;
        [a[n], a[m]] = [a[m]!, a[n]!];
        n = m;
      }
    }
    return top;
  }
}

/**
 * 4-connected A* with a Manhattan heuristic. Returns the full path including
 * `from` and `to`, `[from]` when they are equal, or `null` when unreachable or
 * when either endpoint is blocked.
 */
export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  if (!isWalkable(grid, from.x, from.y) || !isWalkable(grid, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [{ x: from.x, y: from.y }];

  const w = grid.width;
  const size = w * grid.height;
  const g = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  const hOf = (i: number) => Math.abs((i % w) - to.x) + Math.abs(Math.floor(i / w) - to.y);

  const open = new Heap();
  let order = 0;
  g[start] = 0;
  open.push({ i: start, f: hOf(start), h: hOf(start), o: order++ });

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed[cur.i]) continue;
    if (cur.i === goal) break;
    closed[cur.i] = 1;
    const cx = cur.i % w;
    const cy = Math.floor(cur.i / w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(grid, nx, ny)) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const ng = g[cur.i]! + 1;
      if (ng < g[ni]!) {
        g[ni] = ng;
        came[ni] = cur.i;
        const h = hOf(ni);
        open.push({ i: ni, f: ng + h, h, o: order++ });
      }
    }
  }

  if (came[goal] === -1) return null;
  const path: Tile[] = [];
  for (let i = goal; i !== -1; i = came[i]!) {
    path.push({ x: i % w, y: Math.floor(i / w) });
    if (i === start) break;
  }
  path.reverse();
  return path;
}

/** Breadth-first search for the closest walkable tile (deterministic order). */
export function nearestWalkable(grid: Grid, from: Tile, exclude?: (t: Tile) => boolean): Tile | null {
  if (!inBounds(grid, from.x, from.y)) return null;
  const w = grid.width;
  const seen = new Uint8Array(w * grid.height);
  const queue: Tile[] = [from];
  seen[from.y * w + from.x] = 1;
  for (let q = 0; q < queue.length; q++) {
    const t = queue[q]!;
    if (isWalkable(grid, t.x, t.y) && !(exclude && exclude(t))) return t;
    for (const [dx, dy] of DIRS) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (!inBounds(grid, nx, ny) || seen[ny * w + nx]) continue;
      seen[ny * w + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Number of tiles reachable from `from` (used to validate connectivity). */
export function reachableCount(grid: Grid, from: Tile): number {
  if (!isWalkable(grid, from.x, from.y)) return 0;
  const w = grid.width;
  const seen = new Uint8Array(w * grid.height);
  const queue: Tile[] = [from];
  seen[from.y * w + from.x] = 1;
  for (let q = 0; q < queue.length; q++) {
    const t = queue[q]!;
    for (const [dx, dy] of DIRS) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (!isWalkable(grid, nx, ny) || seen[ny * w + nx]) continue;
      seen[ny * w + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return queue.length;
}
