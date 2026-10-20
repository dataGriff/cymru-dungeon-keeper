/**
 * Performance budget for the sim: a 48x32 hall with 60 entities must tick
 * well inside a frame. docs/performance.md explains the numbers. Runs via
 * `task bench` (no coverage instrumentation).
 */
import { describe, expect, it } from 'vitest';
import { endlessSchedule } from '../data/levels';
import { createGame, spawn } from './game';
import { Tile, createGrid, rowsFromGrid, setTile } from './grid';
import { tick } from './index';
import { levelFromGrid } from './sandbox';

export const STEP_BUDGET_MS = 4;

describe('sim step budget', () => {
  it('ticks a 48x32 hall with 60 entities in under 4 ms on average', () => {
    const g = createGrid(48, 32);
    for (let y = 2; y < 30; y++) for (let x = 2; x < 46; x++) if ((x + y) % 7 !== 0) setTile(g, x, y, Tile.Floor);
    setTile(g, 6, 16, Tile.Heart);
    setTile(g, 3, 3, Tile.Portal);
    setTile(g, 47, 16, Tile.Gate);
    setTile(g, 47, 5, Tile.Gate);
    for (let y = 12; y < 20; y++) for (let x = 8; x < 12; x++) setTile(g, x, y, Tile.Lair);
    for (let y = 12; y < 16; y++) for (let x = 12; x < 15; x++) setTile(g, x, y, Tile.Hatchery);
    for (let y = 16; y < 20; y++) for (let x = 12; x < 15; x++) setTile(g, x, y, Tile.Treasury);
    const level = levelFromGrid(g, { id: 'bench', name: 'Bench', briefing: 'A hall for counting milliseconds in, which is no way to keep one.', lesson: 'x', startGold: 500, allowed: ['cwn', 'pwca', 'gwyllgi', 'ceffyl', 'afanc', 'teg'], schedule: endlessSchedule(2) });
    void rowsFromGrid;
    const s = createGame(77, undefined, level);
    const kinds = ['cwn', 'cwn', 'pwca', 'gwyllgi', 'afanc', 'ceffyl'] as const;
    for (let i = 0; i < 36; i++) spawn(s, kinds[i % kinds.length]!, { x: 10 + (i % 20), y: 5 + Math.floor(i / 20) * 3 });
    const heroes = ['knight', 'priest', 'levy', 'lord', 'relic'] as const;
    for (let i = 0; i < 21; i++) spawn(s, heroes[i % heroes.length]!, { x: 30 + (i % 14), y: 10 + Math.floor(i / 14) * 4 });
    // 3 coblyns already, 36 creatures, 21 mortals = 60.
    expect(s.entities.length).toBe(60);
    for (let x = 20; x < 44; x++) s.grid.marked[25 * s.grid.w + x] = 1;
    // Warm up, then measure a second's worth of ticks.
    for (let i = 0; i < 30; i++) tick(s, 1 / 30);
    let best = Infinity;
    for (let run = 0; run < 5; run++) {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) tick(s, 1 / 30);
      best = Math.min(best, (performance.now() - t0) / 30);
    }
    console.log(`sim tick with ${s.entities.length} entities on 48x32: best ${best.toFixed(3)} ms (budget ${STEP_BUDGET_MS} ms)`);
    expect(best).toBeLessThan(STEP_BUDGET_MS);
  });
});
