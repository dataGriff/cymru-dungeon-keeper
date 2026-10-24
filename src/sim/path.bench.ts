/**
 * Performance budget: 40 entities on a 48x32 map must path inside one tick.
 * Runs via `task bench` (no coverage instrumentation, which skews timings).
 */
import { describe, expect, it } from 'vitest';
import { Tile, createGrid, setTile } from './grid';
import { findPath } from './path';

export const PATH_BUDGET_MS = 4;

describe('A* budget', () => {
  it('plans 40 paths on a 48x32 map well inside one tick', () => {
    const g = createGrid(48, 32, Tile.Floor);
    // Some walls so the search has to think.
    for (let y = 0; y < 32; y++) if (y % 4 !== 1) setTile(g, 24, y, Tile.Rock);
    for (let x = 0; x < 48; x++) if (x % 5 !== 2) setTile(g, x, 16, Tile.Rock);
    const goals = Array.from({ length: 40 }, (_, i) => ({ x: 47 - (i % 7), y: 31 - ((i * 3) % 11) }));
    let best = Infinity;
    let found = 0;
    for (let run = 0; run < 10; run++) {
      found = 0;
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) {
        if (findPath(g, { x: i % 20, y: (i * 7) % 15 }, goals[i]!, i % 3 === 0 ? 'hero' : 'floor')) found++;
      }
      best = Math.min(best, performance.now() - t0);
    }
    expect(found).toBe(40);
    console.log(`40 paths: best ${best.toFixed(3)} ms (budget ${PATH_BUDGET_MS} ms)`);
    expect(best).toBeLessThan(PATH_BUDGET_MS);
  });
});
