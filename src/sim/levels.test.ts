import { describe, expect, it } from 'vitest';
import { CAMPAIGN, SIEGE_LEVEL, THE_CAIRN, THE_HUNT_RETURNS, THE_SEAM, endlessSchedule, levelById, validateLevel } from '../data/levels';
import { createBot } from './bot';
import { countKind, createGame, heroCount, spawn } from './game';
import { Tile, countTiles, createStartGrid, gatesOf, rowsFromGrid, tileAt } from './grid';
import { tick } from './index';
import { mulberry32 } from './rng';
import { deserialize, fromJSON, migrate, serialize, toJSON } from './save';
import { generateSandbox, levelFromGrid, parseLevel } from './sandbox';

const snapshot = (s: ReturnType<typeof createGame>): string =>
  JSON.stringify({
    t: s.time,
    gold: s.gold,
    hp: s.heartHp,
    wave: s.wave,
    tiles: Array.from(s.grid.tiles),
    ents: s.entities.map((e) => [e.id, e.kind, e.x, e.y, e.hp, e.task, e.hunger]),
    drops: s.drops,
    log: s.log.length,
  });

describe('level format', () => {
  it('every campaign level validates, has one new idea, and a briefing in the voice', () => {
    for (const level of CAMPAIGN) {
      expect(validateLevel(level), level.id).toEqual([]);
      expect(level.lesson.length).toBeGreaterThan(3);
      expect(level.briefing.length).toBeGreaterThan(100);
    }
    expect(CAMPAIGN).toHaveLength(5);
    expect(validateLevel(SIEGE_LEVEL)).toEqual([]);
    expect(levelById('pool')?.name).toBe('The Pool');
    expect(levelById('nope')).toBeUndefined();
  });

  it('each level after the first brings a creature or mortal the one before did not', () => {
    const seen = new Set<string>(['coblyn', 'knight', 'priest']);
    for (const level of CAMPAIGN) {
      const kinds = new Set<string>([...level.allowed, ...level.schedule.waves.flatMap((w) => w.heroes)]);
      const fresh = [...kinds].filter((k) => !seen.has(k));
      const newWin = !seen.has(`win:${level.win.kind}`);
      expect(fresh.length > 0 || newWin, `${level.id} introduces nothing new`).toBe(true);
      for (const k of kinds) seen.add(k);
      seen.add(`win:${level.win.kind}`);
    }
  });

  it('rejects a level with no Heart, a bad row, or a wave through a missing Gate', () => {
    const bad = { ...THE_SEAM, rows: THE_SEAM.rows.map((r) => r.replace('H', '.')) };
    expect(validateLevel(bad)).toContain('exactly one Heart required, found 0');
    const short = { ...THE_SEAM, rows: THE_SEAM.rows.map((r, i) => (i === 3 ? r.slice(1) : r)) };
    expect(validateLevel(short).some((e) => /row 3 has/.test(e))).toBe(true);
    const gate = { ...THE_SEAM, schedule: { name: 'x', waves: [{ at: 10, gate: 3, heroes: ['knight' as const] }] } };
    expect(validateLevel(gate).some((e) => /gate 3/.test(e))).toBe(true);
  });

  it('the Cairn level reproduces the POC start layout', () => {
    const s = createGame(5, undefined, THE_CAIRN);
    const poc = createStartGrid(mulberry32(5));
    expect(s.grid.w).toBe(24);
    expect(tileAt(s.grid, 3, 8)).toBe(Tile.Heart);
    expect(tileAt(s.grid, 1, 6)).toBe(Tile.Portal);
    expect(tileAt(s.grid, 23, 8)).toBe(Tile.Gate);
    expect(countTiles(s.grid, Tile.Floor)).toBe(countTiles(poc, Tile.Floor));
    expect(countKind(s, 'coblyn')).toBe(3);
  });

  it('loads any level by id with its size, Gates, purse and allowed denizens', () => {
    const s = createGame(6, undefined, levelById('pool')!);
    expect([s.grid.w, s.grid.h]).toEqual([32, 20]);
    expect(s.gates).toHaveLength(2);
    expect(s.gold).toBe(180);
    expect(s.level.allowed).toContain('afanc');
    const seam = createGame(7, undefined, THE_SEAM);
    expect(seam.level.allowed).not.toContain('afanc');
    expect(countTiles(seam.grid, Tile.Gold)).toBeGreaterThan(0);
    // The Cairn allows no Pwca, whatever the rooms say.
    const cairn = createGame(7, undefined, THE_CAIRN);
    for (const [x, y] of [[1,7],[2,7],[1,8],[2,8]] as const) cairn.grid.tiles[y * cairn.grid.w + x] = Tile.Lair;
    for (const [x, y] of [[4,7],[4,8]] as const) cairn.grid.tiles[y * cairn.grid.w + x] = Tile.Treasury;
    for (let i = 0; i < 3; i++) spawn(cairn, 'cwn', { x: 2, y: 6 });
    for (let t = 0; t < 8; t += 0.1) tick(cairn, 0.1);
    expect(countKind(cairn, 'pwca')).toBe(0);
  });

  it('plays the Seam and the Pool for a minute without error on their own maps', () => {
    for (const level of [THE_SEAM, levelById('pool')!]) {
      const s = createGame(8, undefined, level);
      for (let t = 0; t < 70; t += 1 / 30) tick(s, 1 / 30);
      expect(s.wave).toBeGreaterThanOrEqual(1);
      expect(heroCount(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the Hunt returns', () => {
  it('at the appointed time the hounds come through every Gate, the mortals break, and the hall is won', () => {
    const level = { ...THE_HUNT_RETURNS, win: { kind: 'hunt' as const, at: 5 }, schedule: { name: 'x', waves: [{ at: 1, gate: 0, heroes: ['knight' as const, 'knight' as const] }] } };
    const s = createGame(9, undefined, level);
    for (let t = 0; t < 4.5; t += 0.1) tick(s, 0.1);
    expect(s.hunt).toBe(false);
    expect(heroCount(s)).toBe(2);
    for (let t = 0; t < 1; t += 0.1) tick(s, 0.1);
    expect(s.hunt).toBe(true);
    expect(countKind(s, 'cwn')).toBe(s.gates.length * 4);
    expect(s.log.some((l) => /Horns on the stair/.test(l.text))).toBe(true);
    expect(s.entities.filter((e) => e.kind === 'knight').every((e) => e.morale === 0)).toBe(true);
    for (let t = 0; t < 60 && s.status === 'playing'; t += 0.1) tick(s, 0.1);
    expect(s.status).toBe('won');
  });
});

describe('save and load', () => {
  it('round-trips: save, load, and both halls agree for another minute', () => {
    const a = createGame(10, undefined, THE_CAIRN);
    const bot = createBot({ traps: true, trades: true });
    for (let i = 0; i < 30 * 50; i++) {
      bot(a);
      tick(a, 1 / 30);
    }
    const json = toJSON(a);
    const b = fromJSON(json);
    expect(snapshot(b)).toBe(snapshot(a));
    expect(b.rng.state).toBe(a.rng.state);
    for (let i = 0; i < 30 * 60; i++) {
      tick(a, 1 / 30);
      tick(b, 1 / 30);
    }
    expect(snapshot(b)).toBe(snapshot(a));
    expect(b.level.id).toBe('cairn');
  });

  it('carries the version and refuses one it does not know; sandbox levels travel with the save', () => {
    const s = createGame(11, undefined, generateSandbox(3));
    const data = serialize(s);
    expect(data.version).toBe(1);
    expect(typeof data.level).toBe('object');
    expect(deserialize(data).grid.w).toBe(s.grid.w);
    expect(() => migrate({ ...data, version: 99 })).toThrow(/not supported/);
  });
});

describe('sandbox and editor', () => {
  it('generates a sound level from a seed, with the seed in its name', () => {
    const level = generateSandbox(42);
    expect(validateLevel(level)).toEqual([]);
    expect(level.name).toContain('42');
    expect(generateSandbox(42).rows).toEqual(level.rows);
    expect(generateSandbox(43).rows).not.toEqual(level.rows);
    const s = createGame(1, undefined, level);
    expect(gatesOf(s.grid)).toHaveLength(2);
    expect(endlessSchedule().waves.length).toBeGreaterThan(10);
  });

  it("the editor's output loads via the level loader, and round-trips through JSON", () => {
    const s = createGame(12);
    const level = levelFromGrid(s.grid, { id: 'mine', name: 'Mine', briefing: 'A hall I painted myself, badly, which is still a hall.', lesson: 'x', startGold: 100, allowed: ['cwn'], schedule: THE_CAIRN.schedule });
    expect(rowsFromGrid(createGame(13, undefined, level).grid)).toEqual(level.rows);
    const again = parseLevel(JSON.stringify(level));
    expect(again.rows).toEqual(level.rows);
    expect(() => levelFromGrid(createGame(14).grid, { ...level, id: 'Bad Id' })).toThrow(/kebab/);
  });
});
