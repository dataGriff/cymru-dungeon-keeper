import { describe, expect, it } from 'vitest';
import { createGame } from './game';
import { Tile, setTile } from './grid';
import { TICK, advance } from './index';

const snapshot = (s: ReturnType<typeof createGame>): string =>
  JSON.stringify({ t: s.time, gold: s.gold, hp: s.heartHp, ents: s.entities.map((e) => [e.id, e.x, e.y, e.hp, e.task]) });

function prepared(seed: number): ReturnType<typeof createGame> {
  const s = createGame(seed);
  for (let x = 6; x <= 21; x++) s.grid.marked[8 * s.grid.w + x] = 1;
  setTile(s.grid, 2, 6, Tile.Treasury);
  return s;
}

describe('fixed-step clock', () => {
  it('produces the same outcome at 30, 60 and an irregular frame rate', () => {
    const a = prepared(77);
    const b = prepared(77);
    const c = prepared(77);
    const ca = { acc: 0 };
    const cb = { acc: 0 };
    const cc = { acc: 0 };
    let elapsedC = 0;
    for (let i = 0; i < 45 * 30; i++) {
      advance(a, ca, 1 / 30);
      advance(b, cb, 1 / 60);
      advance(b, cb, 1 / 60);
      const jitter = i % 3 === 0 ? 0.011 : i % 3 === 1 ? 0.037 : 1 / 30 + 0.0001 - 0.048;
      advance(c, cc, Math.max(0.001, jitter));
      elapsedC += Math.max(0.001, jitter);
    }
    expect(a.time).toBeCloseTo(45, 5);
    expect(snapshot(a)).toBe(snapshot(b));
    // c has simulated a slightly different total; bring it level and compare.
    while (c.time < a.time - 1e-9) advance(c, cc, TICK);
    expect(elapsedC).toBeGreaterThan(0);
    expect(snapshot(c)).toBe(snapshot(a));
  });

  it('caps the time simulated in one frame so a hidden tab does not fast-forward', () => {
    const s = createGame(78);
    advance(s, { acc: 0 }, 10);
    expect(s.time).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it('returns the interpolation alpha between ticks', () => {
    const s = createGame(79);
    const clock = { acc: 0 };
    expect(advance(s, clock, TICK / 2)).toBeCloseTo(0.5);
    expect(advance(s, clock, TICK / 2)).toBeCloseTo(0);
  });
});
