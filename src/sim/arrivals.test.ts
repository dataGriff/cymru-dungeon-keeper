import { describe, expect, it } from 'vitest';
import { ARRIVAL_INTERVAL, chooseArrival, countKind, createGame, removeEntity, spawn } from './game';
import { PORTAL_POS, type RoomTile, Tile, setTile } from './grid';
import { tick } from './index';

/** Lay `n` tiles of a room as one contiguous strip starting at (x0, y0), snaking right then down. */
function build(s: ReturnType<typeof createGame>, room: RoomTile, n: number, x0 = 6, y0 = 1): void {
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 6);
    const col = row % 2 === 0 ? i % 6 : 5 - (i % 6);
    setTile(s.grid, x0 + col, y0 + row, room);
  }
}

describe('arrival rules', () => {
  it('starts with three Coblynau and replaces them only below three', () => {
    const s = createGame(1);
    expect(countKind(s, 'coblyn')).toBe(3);
    expect(chooseArrival(s)).toBeNull();
    removeEntity(s, s.entities[0]!);
    expect(chooseArrival(s)).toBe('coblyn');
  });

  it('sends a Coblyn through the portal on the 7s check', () => {
    const s = createGame(2);
    removeEntity(s, s.entities[0]!);
    for (let t = 0; t < ARRIVAL_INTERVAL - 0.1; t += 0.1) tick(s, 0.1);
    expect(countKind(s, 'coblyn')).toBe(2);
    tick(s, 0.2);
    expect(countKind(s, 'coblyn')).toBe(3);
    const newest = s.entities.at(-1)!;
    expect({ x: newest.x, y: newest.y }).toEqual(PORTAL_POS);
    expect(s.log.at(-1)?.text).toMatch(/Coblyn/);
  });

  it('Cŵn Annwn needs Lair ≥ 4 and Hatchery ≥ 2, capped at three', () => {
    const s = createGame(3);
    build(s, Tile.Lair, 3);
    build(s, Tile.Hatchery, 2, 6, 5);
    expect(chooseArrival(s)).toBeNull();
    build(s, Tile.Lair, 4);
    expect(chooseArrival(s)).toBe('cwn');
    for (let i = 0; i < 3; i++) spawn(s, 'cwn', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('Pwca needs Lair ≥ 2 and Treasury ≥ 2, capped at two', () => {
    const s = createGame(4);
    build(s, Tile.Lair, 2);
    build(s, Tile.Treasury, 1, 6, 5);
    expect(chooseArrival(s)).toBeNull();
    build(s, Tile.Treasury, 2, 6, 5);
    expect(chooseArrival(s)).toBe('pwca');
    spawn(s, 'pwca', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('Afanc needs Lair ≥ 9, Treasury ≥ 4 and 300 gold, only one ever', () => {
    const s = createGame(5);
    build(s, Tile.Lair, 9);
    build(s, Tile.Treasury, 4, 6, 5);
    spawn(s, 'pwca', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    s.gold = 299;
    expect(chooseArrival(s)).toBeNull();
    s.gold = 300;
    expect(chooseArrival(s)).toBe('afanc');
    spawn(s, 'afanc', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('counts the largest contiguous region, not scattered tiles', () => {
    const s = createGame(7);
    // Four Lair tiles that touch nothing: four regions of one.
    for (const [x, y] of [
      [6, 1],
      [8, 1],
      [6, 3],
      [8, 3],
    ] as const) {
      setTile(s.grid, x, y, Tile.Lair);
    }
    build(s, Tile.Hatchery, 2, 6, 5);
    expect(chooseArrival(s)).toBeNull();
    setTile(s.grid, 7, 1, Tile.Lair);
    setTile(s.grid, 9, 1, Tile.Lair);
    expect(chooseArrival(s)).toBe('cwn');
  });

  it('checks the rules in order: a missing Coblyn comes before a hound', () => {
    const s = createGame(6);
    build(s, Tile.Lair, 4);
    build(s, Tile.Hatchery, 2, 6, 5);
    removeEntity(s, s.entities[0]!);
    expect(chooseArrival(s)).toBe('coblyn');
  });
});
