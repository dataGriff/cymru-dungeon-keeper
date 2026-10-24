import { type Grid, type Tile, type Vec, idx, isRock, isWalkable } from './grid';

/**
 * Who is walking decides what a tile costs:
 *  - floor:  rooms and floor only.
 *  - hero:   may cross rock at cost 4 (they tunnel at quarter speed).
 *  - worker: like floor, but may step onto the goal tile even if it is rock.
 */
export type Mover = 'floor' | 'hero' | 'worker';

export const ROCK_COST = 4;

/** Minimal binary heap on typed arrays: keys are costs, values are tile indices. */
class Heap {
  private keys = new Float64Array(1024);
  private vals = new Int32Array(1024);
  private n = 0;
  get size(): number {
    return this.n;
  }
  clear(): void {
    this.n = 0;
  }
  push(key: number, val: number): void {
    if (this.n === this.keys.length) {
      const keys = new Float64Array(this.n * 2);
      const vals = new Int32Array(this.n * 2);
      keys.set(this.keys);
      vals.set(this.vals);
      this.keys = keys;
      this.vals = vals;
    }
    const keys = this.keys;
    const vals = this.vals;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((keys[p] as number) <= key) break;
      keys[i] = keys[p] as number;
      vals[i] = vals[p] as number;
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0] as number;
    const n = --this.n;
    if (n > 0) {
      const key = keys[n] as number;
      const val = vals[n] as number;
      let i = 0;
      for (;;) {
        let m = i * 2 + 1;
        if (m >= n) break;
        if (m + 1 < n && (keys[m + 1] as number) < (keys[m] as number)) m++;
        if ((keys[m] as number) >= key) break;
        keys[i] = keys[m] as number;
        vals[i] = vals[m] as number;
        i = m;
      }
      keys[i] = key;
      vals[i] = val;
    }
    return top;
  }
}

export interface DistanceField {
  dist: Float64Array;
  prev: Int32Array;
}

/** Scratch buffers reused between searches, sized to the largest grid seen. */
let scratchDist = new Float64Array(0);
let scratchPrev = new Int32Array(0);
let scratchDone = new Uint8Array(0);
const heap = new Heap();

/**
 * Dijkstra from `from` over the whole grid, or A* when a `goal` is given:
 * the heap is keyed on cost plus Manhattan distance, which is admissible
 * because no step costs less than 1. The returned arrays are scratch
 * buffers and are overwritten by the next search.
 */
export function dijkstra(g: Grid, from: Vec, mover: Mover, goal?: Vec): DistanceField {
  const w = g.w;
  const n = w * g.h;
  if (scratchDist.length < n) {
    scratchDist = new Float64Array(n);
    scratchPrev = new Int32Array(n);
    scratchDone = new Uint8Array(n);
  }
  const dist = scratchDist;
  const prev = scratchPrev;
  const done = scratchDone;
  dist.fill(Infinity, 0, n);
  prev.fill(-1, 0, n);
  done.fill(0, 0, n);
  heap.clear();
  const tiles = g.tiles;
  const heroWalk = mover === 'hero';
  const start = from.y * w + from.x;
  const goalIdx = goal ? goal.y * w + goal.x : -1;
  const gx = goal ? goal.x : 0;
  const gy = goal ? goal.y : 0;
  dist[start] = 0;
  heap.push(0, start);
  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    if (cur === goalIdx) break;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const base = dist[cur] as number;
    // Four neighbours, unrolled: no per-node allocation.
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? cx + 1 : k === 1 ? cx - 1 : cx;
      const ny = k === 2 ? cy + 1 : k === 3 ? cy - 1 : cy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= g.h) continue;
      const ni = ny * w + nx;
      if (done[ni]) continue;
      const t = tiles[ni] as Tile;
      let c: number;
      if (ni === goalIdx) c = isRock(t) && heroWalk ? ROCK_COST : 1;
      else if (isWalkable(t)) c = 1;
      else if (heroWalk && isRock(t)) c = ROCK_COST;
      else continue;
      const nd = base + c;
      if (nd < (dist[ni] as number)) {
        dist[ni] = nd;
        prev[ni] = cur;
        heap.push(goal ? nd + Math.abs(gx - nx) + Math.abs(gy - ny) : nd, ni);
      }
    }
  }
  return { dist, prev };
}

/**
 * Shortest path from `from` to `to`, excluding `from`, including `to`.
 * Returns null when unreachable for this mover. Uses A*.
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

/** Does a map change at `at` touch this path? Changes next to a path can shorten it. */
export function pathTouches(path: readonly Vec[], from: Vec, at: Vec): boolean {
  if (Math.abs(from.x - at.x) <= 1 && Math.abs(from.y - at.y) <= 1) return true;
  for (const p of path) if (Math.abs(p.x - at.x) <= 1 && Math.abs(p.y - at.y) <= 1) return true;
  return false;
}

/** Path cost (sum of step costs) or Infinity. */
export function pathCost(g: Grid, from: Vec, to: Vec, mover: Mover): number {
  const { dist } = dijkstra(g, from, mover, to);
  return dist[idx(g, to.x, to.y)] as number;
}
