import { describe, expect, it } from 'vitest';
import { BESTIARY, BESTIARY_ORDER, type BeastKind } from '../data/bestiary';
import { createGame, spawn } from './game';
import { PORTAL_POS, Tile, setTile } from './grid';
import { tick } from './index';

/** Everything that matters, with the RNG closure left out. */
const snapshot = (s: ReturnType<typeof createGame>): string =>
  JSON.stringify({
    time: s.time,
    gold: s.gold,
    heartHp: s.heartHp,
    status: s.status,
    wave: s.wave,
    tiles: Array.from(s.grid.tiles),
    marked: Array.from(s.grid.marked),
    drops: s.drops,
    entities: s.entities.map((e) => ({ ...e, path: e.path.length })),
    log: s.log,
  });

function busyGame(seed: number): ReturnType<typeof createGame> {
  const s = createGame(seed);
  for (let x = 6; x <= 21; x++) s.grid.marked[8 * s.grid.w + x] = 1;
  for (const [x, y] of [
    [1, 9],
    [2, 9],
    [1, 10],
    [2, 10],
  ] as const) {
    setTile(s.grid, x, y, Tile.Lair);
  }
  setTile(s.grid, 4, 6, Tile.Hatchery);
  setTile(s.grid, 5, 6, Tile.Hatchery);
  return s;
}

describe('determinism', () => {
  it('a 60-second fixed-step run from the start layout is identical for the same seed', () => {
    const a = busyGame(99);
    const b = busyGame(99);
    for (let i = 0; i < 60 * 60; i++) {
      tick(a, 1 / 60);
      tick(b, 1 / 60);
    }
    expect(a.wave).toBe(1);
    expect(snapshot(a)).toBe(snapshot(b));
  });

  it('different seeds produce different halls', () => {
    const a = createGame(1);
    const b = createGame(2);
    expect(Array.from(a.grid.tiles)).not.toEqual(Array.from(b.grid.tiles));
  });
});

describe('bestiary', () => {
  it('has an entry for every kind the sim can spawn, with every field filled', () => {
    const kinds = Object.keys(BESTIARY) as BeastKind[];
    expect(new Set(kinds)).toEqual(new Set(BESTIARY_ORDER));
    const s = createGame(5);
    for (const kind of kinds) {
      const e = spawn(s, kind, PORTAL_POS);
      const entry = BESTIARY[e.kind];
      expect(entry.kind).toBe(kind);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.gloss.length).toBeGreaterThan(0);
      expect(entry.flavour.length).toBeGreaterThan(50);
      expect(entry.notes).toHaveLength(3);
      expect(e.maxHp).toBe(entry.stats.hp);
      expect(entry.stats.speed).toBeGreaterThan(0);
    }
  });
});
