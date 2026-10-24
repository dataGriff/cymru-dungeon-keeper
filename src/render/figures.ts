/**
 * The game's reader for art/figures.json (16x16 pixel rows per figure, each
 * with its own palette). scripts/lib/figures.mjs mirrors this for the build
 * scripts. The sprite sheet is baked from the same data; these runs are the
 * fallback renderer and the source for tinted silhouettes.
 */
import figuresJson from '../../art/figures.json';
import type { BeastKind } from '../data/bestiary';
import { B } from './colors';

export interface FigureSource {
  width: number;
  height: number;
  outline: string;
  frames: string[];
  figures: Record<string, { palette: Record<string, string>; rows: string[] }>;
}

export const FIGURES = figuresJson as unknown as FigureSource;

/** [x, y, w, h, colour] horizontal runs, outline included. */
export type Run = [number, number, number, number, string];

export function figureGrid(kind: BeastKind): (string | null)[][] {
  const fig = FIGURES.figures[kind];
  if (!fig) return [];
  return fig.rows.map((row) => [...row].map((ch) => (ch === '.' ? null : (fig.palette[ch] ?? B.missing))));
}

export function outlined(grid: (string | null)[][], color: string): (string | null)[][] {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && (grid[y]?.[x] ?? null) !== null;
  return grid.map((row, y) =>
    row.map((c, x) => (c !== null ? c : solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1) ? color : null)),
  );
}

export function runs(grid: (string | null)[][]): Run[] {
  const out: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x] ?? null;
      if (c === null) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      out.push([x, y, end - x, 1, c]);
      x = end;
    }
  });
  return out;
}

const cache = new Map<BeastKind, Run[]>();

/** Outlined runs for a kind, cached. */
export function figureRuns(kind: BeastKind): Run[] {
  let r = cache.get(kind);
  if (!r) {
    r = runs(outlined(figureGrid(kind), FIGURES.outline));
    cache.set(kind, r);
  }
  return r;
}
