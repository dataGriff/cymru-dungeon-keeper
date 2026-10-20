import { describe, expect, it } from 'vitest';
import { ARRIVAL_INTERVAL, chooseArrival, countKind, createGame, removeEntity, spawn } from './game';
import { PORTAL_POS, type RoomTile, Tile, setTile } from './grid';
import { tick } from './index';

/** Lay `n` tiles of a room over the starting chamber's floor. */
function build(s: ReturnType<typeof createGame>, room: RoomTile, n: number): void {
  let placed = 0;
  for (let y = 0; y < s.grid.h && placed < n; y++) {
    for (let x = 0; x < s.grid.w && placed < n; x++) {
      if (s.grid.tiles[y * s.grid.w + x] === Tile.Floor) {
        setTile(s.grid, x, y, room);
        placed++;
      }
    }
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
    build(s, Tile.Hatchery, 2);
    expect(chooseArrival(s)).toBeNull();
    build(s, Tile.Lair, 1);
    expect(chooseArrival(s)).toBe('cwn');
    for (let i = 0; i < 3; i++) spawn(s, 'cwn', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('Pwca needs Lair ≥ 2 and Treasury ≥ 2, capped at two', () => {
    const s = createGame(4);
    build(s, Tile.Lair, 2);
    build(s, Tile.Treasury, 1);
    expect(chooseArrival(s)).toBeNull();
    build(s, Tile.Treasury, 1);
    expect(chooseArrival(s)).toBe('pwca');
    spawn(s, 'pwca', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('Afanc needs Lair ≥ 9, Treasury ≥ 4 and 300 gold, only one ever', () => {
    const s = createGame(5);
    build(s, Tile.Lair, 9);
    build(s, Tile.Treasury, 4);
    spawn(s, 'pwca', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    s.gold = 299;
    expect(chooseArrival(s)).toBeNull();
    s.gold = 300;
    expect(chooseArrival(s)).toBe('afanc');
    spawn(s, 'afanc', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('checks the rules in order: a missing Coblyn comes before a hound', () => {
    const s = createGame(6);
    build(s, Tile.Lair, 4);
    build(s, Tile.Hatchery, 2);
    removeEntity(s, s.entities[0]!);
    expect(chooseArrival(s)).toBe('coblyn');
  });
});
