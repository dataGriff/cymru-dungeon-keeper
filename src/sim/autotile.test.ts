import { describe, expect, it } from 'vitest';
import { DOWN, LEFT, RIGHT, SHAPE_NAMES, UP, autotileMask, openEdges, sameRoom } from './autotile';
import { Tile, createGrid, setTile } from './grid';

describe('4-bit autotiling', () => {
  it('names all sixteen shapes once each', () => {
    expect(new Set(SHAPE_NAMES).size).toBe(16);
    expect(SHAPE_NAMES[15]).toBe('inner');
    expect(SHAPE_NAMES[0]).toBe('open-up-right-down-left');
  });

  it('computes every mask on a 3x3 of rock with floor around it', () => {
    // A 5x5 of floor with a 3x3 rock block in the middle.
    const g = createGrid(5, 5, Tile.Floor);
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) setTile(g, x, y, Tile.Rock);
    expect(autotileMask(g, 2, 2)).toBe(15); // inner
    expect(autotileMask(g, 2, 1)).toBe(RIGHT | DOWN | LEFT); // top edge: open up
    expect(autotileMask(g, 1, 1)).toBe(RIGHT | DOWN); // top-left corner
    expect(autotileMask(g, 3, 3)).toBe(UP | LEFT); // bottom-right corner
    expect(autotileMask(g, 1, 2)).toBe(UP | RIGHT | DOWN); // left edge
    const seen = new Set<number>();
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) seen.add(autotileMask(g, x, y));
    expect(seen.size).toBeGreaterThanOrEqual(9);
  });

  it('round-trips every one of the sixteen shapes', () => {
    for (let mask = 0; mask < 16; mask++) {
      const g = createGrid(3, 3, Tile.Floor);
      setTile(g, 1, 1, Tile.Rock);
      if (mask & UP) setTile(g, 1, 0, Tile.Rock);
      if (mask & RIGHT) setTile(g, 2, 1, Tile.Rock);
      if (mask & DOWN) setTile(g, 1, 2, Tile.Rock);
      if (mask & LEFT) setTile(g, 0, 1, Tile.Rock);
      expect(autotileMask(g, 1, 1)).toBe(mask);
      const e = openEdges(g, 1, 1);
      expect([e.up, e.right, e.down, e.left]).toEqual([!(mask & UP), !(mask & RIGHT), !(mask & DOWN), !(mask & LEFT)]);
    }
  });

  it('treats gold as rock for faces, and rooms as themselves for edges', () => {
    const g = createGrid(3, 1, Tile.Rock);
    setTile(g, 1, 0, Tile.Gold);
    expect(autotileMask(g, 1, 0)).toBe(15);
    const r = createGrid(3, 1, Tile.Floor);
    setTile(r, 1, 0, Tile.Lair);
    expect(openEdges(r, 1, 0, sameRoom)).toEqual({ up: false, right: true, down: false, left: true });
    setTile(r, 2, 0, Tile.Lair);
    expect(openEdges(r, 1, 0, sameRoom).right).toBe(false);
  });
});
