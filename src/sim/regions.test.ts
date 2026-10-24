import { describe, expect, it } from 'vitest';
import { Tile, createGrid, largestRegion, regionSizeAt, regionsOf, setTile } from './grid';

describe('room regions', () => {
  it('splits a room into 4-connected regions, largest first', () => {
    const g = createGrid(6, 4, Tile.Floor);
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [4, 3],
      [5, 2],
    ] as const) {
      setTile(g, x, y, Tile.Lair);
    }
    const regions = regionsOf(g, Tile.Lair);
    expect(regions.map((r) => r.length)).toEqual([3, 1, 1]);
    expect(largestRegion(g, Tile.Lair)).toBe(3);
    expect(largestRegion(g, Tile.Hatchery)).toBe(0);
    expect(regionSizeAt(g, 1, 1, Tile.Lair)).toBe(3);
    expect(regionSizeAt(g, 4, 3, Tile.Lair)).toBe(1);
    expect(regionSizeAt(g, 2, 2, Tile.Lair)).toBe(0);
  });

  it('painting a tile that touches the room joins it; one that does not starts a new region', () => {
    const g = createGrid(5, 1, Tile.Floor);
    setTile(g, 0, 0, Tile.Treasury);
    setTile(g, 2, 0, Tile.Treasury);
    expect(regionsOf(g, Tile.Treasury)).toHaveLength(2);
    setTile(g, 1, 0, Tile.Treasury);
    expect(regionsOf(g, Tile.Treasury)).toHaveLength(1);
  });
});
