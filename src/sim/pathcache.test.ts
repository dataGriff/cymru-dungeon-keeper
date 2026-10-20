import { describe, expect, it } from 'vitest';
import { setPath } from './ai';
import { createGame, digTile, spawn } from './game';
import { Tile, setTile } from './grid';
import { pathTouches } from './path';

describe('path caching', () => {
  it('reuses a path to the same goal and re-plans only when a nearby tile changes', () => {
    const s = createGame(50);
    const e = spawn(s, 'cwn', { x: 1, y: 7 });
    expect(setPath(s, e, { x: 5, y: 10 }, 'floor')).toBe(true);
    const first = e.path;
    expect(setPath(s, e, { x: 5, y: 10 }, 'floor')).toBe(true);
    expect(e.path).toBe(first); // same array: nothing was re-planned
    // A dig on the far side of the map does not touch this path.
    setTile(s.grid, 20, 2, Tile.Rock);
    digTile(s, 20, 2);
    expect(setPath(s, e, { x: 5, y: 10 }, 'floor')).toBe(true);
    expect(e.path).toBe(first);
    // A dig next to the path does.
    const mid = first[Math.floor(first.length / 2)]!;
    setTile(s.grid, mid.x, mid.y + 1, Tile.Rock);
    digTile(s, mid.x, mid.y + 1);
    expect(setPath(s, e, { x: 5, y: 10 }, 'floor')).toBe(true);
    expect(e.path).not.toBe(first);
    // A new goal always re-plans.
    const second = e.path;
    expect(setPath(s, e, { x: 2, y: 6 }, 'floor')).toBe(true);
    expect(e.path).not.toBe(second);
  });

  it('pathTouches is true only within one tile of the path or the walker', () => {
    const path = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(pathTouches(path, { x: 1, y: 0 }, { x: 3, y: 1 })).toBe(true);
    expect(pathTouches(path, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(true);
    expect(pathTouches(path, { x: 1, y: 0 }, { x: 6, y: 0 })).toBe(false);
  });
});
