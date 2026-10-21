/**
 * Shared reader for art/figures.json: 16x16 pixel rows per figure with a
 * per-figure palette. Used by the sprite sheet, box and manual builders.
 * src/render/figures.ts mirrors these few functions for the game.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadFigures() {
  return JSON.parse(readFileSync(join(root, 'art', 'figures.json'), 'utf8'));
}

/** A figure as a 2D array of hex colours (null for transparent), without outline. */
export function figureGrid(src, kind) {
  const fig = src.figures[kind];
  return fig.rows.map((row) => [...row].map((ch) => (ch === '.' ? null : fig.palette[ch] ?? '#ff00ff')));
}

/** Add a 1px outline in `color` around every opaque pixel (4-neighbourhood), inside the grid. */
export function outlined(grid, color) {
  const h = grid.length;
  const w = grid[0].length;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y][x] !== null;
  return grid.map((row, y) =>
    row.map((c, x) => (c !== null ? c : solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1) ? color : null)),
  );
}

/** Horizontal runs [x, y, w, h, colour] of a grid: compact rectangles for SVG and PDF. */
export function runs(grid) {
  const out = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
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

/** Convenience: outlined runs for a kind. */
export function figureRuns(src, kind) {
  return runs(outlined(figureGrid(src, kind), src.outline));
}
