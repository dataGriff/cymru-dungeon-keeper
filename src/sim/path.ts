import { type Grid, type Vec, idx, inBounds, isRock, isWalkable, tileAt } from './grid';

/**
 * Who is walking decides what a tile costs:
 *  - floor:  rooms and floor only.
 *  - hero:   may cross rock at cost 4 (they tunnel at quarter speed).
 *  - worker: like floor, but may step onto the goal tile even if it is rock.
 */
export type Mover = 'floor' | 'hero' | 'worker';

export const ROCK_COST = 4;

function stepCost(g: Grid, x: number, y: number, mover: Mover, goal: Vec | undefined): number {
  const t = tileAt(g, x, y);
  if (goal && goal.x === x && goal.y === y) return isRock(t) && mover === 'hero' ? ROCK_COST : 1;
  if (isWalkable(t)) return 1;
  if (isRock(t) && mover === 'hero') return ROCK_COST;
  return Infinity;
}

/** Minimal binary heap keyed on a number, storing tile indices. */
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((this.keys[p] as number) <= (this.keys[i] as number)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.vals[0] as number;
    const lastKey = this.keys.pop() as number;
    const lastVal = this.vals.pop() as number;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.vals[0] = lastVal;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && (this.keys[l] as number) < (this.keys[m] as number)) m = l;
        if (r < this.keys.length && (this.keys[r] as number) < (this.keys[m] as number)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    const k = this.keys[a] as number;
    this.keys[a] = this.keys[b] as number;
    this.keys[b] = k;
    const v = this.vals[a] as number;
    this.vals[a] = this.vals[b] as number;
    this.vals[b] = v;
  }
}

export interface DistanceField {
  dist: Float64Array;
  prev: Int32Array;
}

/** Dijkstra from `from` over the whole grid (or until `goal` is settled). */
export function dijkstra(g: Grid, from: Vec, mover: Mover, goal?: Vec): DistanceField {
  const n = g.w * g.h;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new Heap();
  const start = idx(g, from.x, from.y);
  dist[start] = 0;
  heap.push(0, start);
  const goalIdx = goal ? idx(g, goal.x, goal.y) : -1;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === goalIdx) break;
    const cx = cur % g.w;
    const cy = (cur - cx) / g.w;
    const base = dist[cur] as number;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(g, nx, ny)) continue;
      const c = stepCost(g, nx, ny, mover, goal);
      if (c === Infinity) continue;
      const ni = idx(g, nx, ny);
      const nd = base + c;
      if (nd < (dist[ni] as number)) {
        dist[ni] = nd;
        prev[ni] = cur;
        heap.push(nd, ni);
      }
    }
  }
  return { dist, prev };
}

/**
 * Shortest path from `from` to `to`, excluding `from`, including `to`.
 * Returns null when unreachable for this mover.
 */
export function findPath(g: Grid, from: Vec, to: Vec, mover: Mover): Vec[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const { dist, prev } = dijkstra(g, from, mover, to);
  const goalIdx = idx(g, to.x, to.y);
  if (dist[goalIdx] === Infinity) return null;
  const path: Vec[] = [];
  for (let i = goalIdx; i !== idx(g, from.x, from.y); i = prev[i] as number) {
    path.push({ x: i % g.w, y: Math.floor(i / g.w) });
  }
  return path.reverse();
}

/** Path cost (sum of step costs) or Infinity. */
export function pathCost(g: Grid, from: Vec, to: Vec, mover: Mover): number {
  const { dist } = dijkstra(g, from, mover, to);
  return dist[idx(g, to.x, to.y)] as number;
}
