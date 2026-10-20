/**
 * 4-bit autotiling. A tile's mask says which of its four neighbours are "the
 * same" (up=1, right=2, down=4, left=8), giving one of sixteen edge shapes.
 * Rock faces look toward open floor; room edges draw where a neighbour is a
 * different room. Kept in the sim folder so it is unit-tested with the grid.
 */
import { type Grid, Tile, inBounds, isRock, tileAt } from './grid';

export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

export type Same = (t: Tile, neighbour: Tile) => boolean;

/** Rock is rock (gold included); open is anything you can stand on, plus the Heart. */
export const sameSolidity: Same = (t, n) => isRock(t) === isRock(n);
/** Rooms join only with their own kind; floor with floor. */
export const sameRoom: Same = (t, n) => t === n;

/** Out of bounds counts as "same", so the map edge never grows a face. */
export function autotileMask(g: Grid, x: number, y: number, same: Same = sameSolidity): number {
  const t = tileAt(g, x, y);
  let mask = 0;
  const check = (nx: number, ny: number, bit: number): void => {
    if (!inBounds(g, nx, ny) || same(t, tileAt(g, nx, ny))) mask |= bit;
  };
  check(x, y - 1, UP);
  check(x + 1, y, RIGHT);
  check(x, y + 1, DOWN);
  check(x - 1, y, LEFT);
  return mask;
}

/** The sixteen shapes, named for which edges are OPEN (face a different tile). */
export const SHAPE_NAMES: readonly string[] = Array.from({ length: 16 }, (_, mask) => {
  const open: string[] = [];
  if (!(mask & UP)) open.push('up');
  if (!(mask & RIGHT)) open.push('right');
  if (!(mask & DOWN)) open.push('down');
  if (!(mask & LEFT)) open.push('left');
  return open.length ? `open-${open.join('-')}` : 'inner';
});

/** Which edges of (x, y) face a different tile, as booleans, for a renderer. */
export function openEdges(g: Grid, x: number, y: number, same: Same = sameSolidity): { up: boolean; right: boolean; down: boolean; left: boolean } {
  const m = autotileMask(g, x, y, same);
  return { up: !(m & UP), right: !(m & RIGHT), down: !(m & DOWN), left: !(m & LEFT) };
}
