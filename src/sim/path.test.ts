import { describe, expect, it } from 'vitest';
import { Tile, createGrid, isRock, setTile, tileAt } from './grid';
import { findPath, pathCost } from './path';

describe('Dijkstra pathfinding', () => {
  it('finds the shortest path across open floor', () => {
    const g = createGrid(5, 5, Tile.Floor);
    const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 }, 'floor');
    expect(path).not.toBeNull();
    expect(path).toHaveLength(4);
    expect(path?.at(-1)).toEqual({ x: 4, y: 0 });
    expect(pathCost(g, { x: 0, y: 0 }, { x: 4, y: 4 }, 'floor')).toBe(8);
  });

  it('lets heroes route through rock when no corridor exists, but not floor-walkers', () => {
    const g = createGrid(6, 3, Tile.Rock);
    setTile(g, 0, 1, Tile.Floor);
    setTile(g, 5, 1, Tile.Floor);
    const from = { x: 0, y: 1 };
    const to = { x: 5, y: 1 };
    const hero = findPath(g, from, to, 'hero');
    expect(hero).not.toBeNull();
    expect(hero).toHaveLength(5);
    expect(pathCost(g, from, to, 'hero')).toBe(4 * 4 + 1);
    expect(findPath(g, from, to, 'floor')).toBeNull();
    expect(findPath(g, from, to, 'worker')).toBeNull();
  });

  it('heroes prefer a corridor to tunnelling when one exists', () => {
    const g = createGrid(5, 3, Tile.Rock);
    for (let x = 0; x < 5; x++) setTile(g, x, 0, Tile.Floor);
    for (let y = 0; y < 3; y++) {
      setTile(g, 0, y, Tile.Floor);
      setTile(g, 4, y, Tile.Floor);
    }
    const path = findPath(g, { x: 0, y: 2 }, { x: 4, y: 2 }, 'hero');
    expect(path).not.toBeNull();
    expect(path?.every((p) => !isRock(tileAt(g, p.x, p.y)))).toBe(true);
    expect(path).toHaveLength(8);
  });

  it('workers may step onto their target rock tile only', () => {
    const g = createGrid(4, 1, Tile.Rock);
    setTile(g, 0, 0, Tile.Floor);
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 0 }, 'worker')).toEqual([{ x: 1, y: 0 }]);
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, 'worker')).toBeNull();
  });

  it('treats the Heart as a structure nobody walks across', () => {
    const g = createGrid(3, 1, Tile.Floor);
    setTile(g, 1, 0, Tile.Heart);
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, 'floor')).toBeNull();
    // ...but it can still be the goal, so heroes can walk up to it.
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 0 }, 'hero')).toEqual([{ x: 1, y: 0 }]);
  });
});
