import type { Rng } from './rng';

export const GRID_W = 24;
export const GRID_H = 16;

export enum Tile {
  Rock = 0,
  Gold = 1,
  Floor = 2,
  Lair = 3,
  Hatchery = 4,
  Treasury = 5,
  Portal = 6,
  Heart = 7,
  Gate = 8,
}

export type RoomTile = Tile.Lair | Tile.Hatchery | Tile.Treasury;

export interface Vec {
  x: number;
  y: number;
}

export interface Grid {
  w: number;
  h: number;
  tiles: Uint8Array;
  /** 1 where the steward has marked rock for digging. */
  marked: Uint8Array;
}

export const HEART_POS: Vec = { x: 3, y: 8 };
export const PORTAL_POS: Vec = { x: 1, y: 6 };
export const GATE_POS: Vec = { x: GRID_W - 1, y: 8 };
export const GOLD_SEAM_FRACTION = 0.09;

export const idx = (g: Grid, x: number, y: number): number => y * g.w + x;
export const inBounds = (g: Grid, x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const tileAt = (g: Grid, x: number, y: number): Tile => g.tiles[idx(g, x, y)] as Tile;
export const setTile = (g: Grid, x: number, y: number, t: Tile): void => {
  g.tiles[idx(g, x, y)] = t;
};
export const isMarked = (g: Grid, x: number, y: number): boolean => g.marked[idx(g, x, y)] === 1;
export const setMarked = (g: Grid, x: number, y: number, on: boolean): void => {
  g.marked[idx(g, x, y)] = on ? 1 : 0;
};

export const isRock = (t: Tile): boolean => t === Tile.Rock || t === Tile.Gold;
export const isRoom = (t: Tile): t is RoomTile => t === Tile.Lair || t === Tile.Hatchery || t === Tile.Treasury;
/** Anything a creature may stand on. The Heart is a structure, not a floor. */
export const isWalkable = (t: Tile): boolean => !isRock(t) && t !== Tile.Heart;

export const sameTile = (a: Vec, b: Vec): boolean => a.x === b.x && a.y === b.y;
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

const DIRS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function neighbors4(g: Grid, x: number, y: number): Vec[] {
  const out: Vec[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(g, nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function createGrid(w = GRID_W, h = GRID_H, fill: Tile = Tile.Rock): Grid {
  return { w, h, tiles: new Uint8Array(w * h).fill(fill), marked: new Uint8Array(w * h) };
}

export function countTiles(g: Grid, t: Tile): number {
  let n = 0;
  for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === t) n++;
  return n;
}

export function tilesOf(g: Grid, t: Tile): Vec[] {
  const out: Vec[] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (tileAt(g, x, y) === t) out.push({ x, y });
  return out;
}

export function markedTiles(g: Grid): Vec[] {
  const out: Vec[] = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (isMarked(g, x, y)) out.push({ x, y });
  return out;
}

/**
 * Contiguous (4-connected) regions of one tile type, largest first.
 * Rooms are regions, not scattered tiles: painting a tile that touches no
 * tile of the same room starts a new region.
 */
export function regionsOf(g: Grid, t: Tile): Vec[][] {
  const seen = new Uint8Array(g.w * g.h);
  const out: Vec[][] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = idx(g, x, y);
      if (seen[i] || g.tiles[i] !== t) continue;
      const region: Vec[] = [];
      const stack: Vec[] = [{ x, y }];
      seen[i] = 1;
      while (stack.length > 0) {
        const p = stack.pop() as Vec;
        region.push(p);
        for (const n of neighbors4(g, p.x, p.y)) {
          const ni = idx(g, n.x, n.y);
          if (!seen[ni] && g.tiles[ni] === t) {
            seen[ni] = 1;
            stack.push(n);
          }
        }
      }
      out.push(region);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Size of the largest contiguous region of `t`, or 0. */
export function largestRegion(g: Grid, t: Tile): number {
  return regionsOf(g, t)[0]?.length ?? 0;
}

/** Size of the region containing (x, y), or 0 if that tile is not `t`. */
export function regionSizeAt(g: Grid, x: number, y: number, t: Tile): number {
  if (tileAt(g, x, y) !== t) return 0;
  for (const r of regionsOf(g, t)) if (r.some((p) => p.x === x && p.y === y)) return r.length;
  return 0;
}

/**
 * The starting hall: a 5x5 dug chamber on the left with the Heart in the centre
 * and the Portal in its corner; the Gate on the far right with one floor tile
 * in front of it; roughly 9% of the remaining rock is gold seam.
 */
export function createStartGrid(rng: Rng): Grid {
  const g = createGrid();
  for (let y = HEART_POS.y - 2; y <= HEART_POS.y + 2; y++) {
    for (let x = HEART_POS.x - 2; x <= HEART_POS.x + 2; x++) setTile(g, x, y, Tile.Floor);
  }
  setTile(g, HEART_POS.x, HEART_POS.y, Tile.Heart);
  setTile(g, PORTAL_POS.x, PORTAL_POS.y, Tile.Portal);
  setTile(g, GATE_POS.x, GATE_POS.y, Tile.Gate);
  setTile(g, GATE_POS.x - 1, GATE_POS.y, Tile.Floor);
  for (let i = 0; i < g.tiles.length; i++) {
    if (g.tiles[i] === Tile.Rock && rng() < GOLD_SEAM_FRACTION) g.tiles[i] = Tile.Gold;
  }
  return g;
}
