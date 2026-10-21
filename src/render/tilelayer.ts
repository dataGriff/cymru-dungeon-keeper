/**
 * The static tile layer: an offscreen canvas holding every tile's static
 * art, redrawn only where the map changed. A change repaints the tile and
 * its eight neighbours, since faces, shadows and room edges depend on them.
 * Compared by value each frame (the grid is small), so the editor, digs,
 * room painting and loads all invalidate it without being told.
 */
import type { Grid } from '../sim/grid';
import { TILE, drawStaticTile } from './tiles';

export interface TileLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** What the layer currently shows. */
  tiles: Uint8Array;
}

export function createTileLayer(): TileLayer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return { canvas, ctx, w: 0, h: 0, tiles: new Uint8Array(0) };
}

/** Bring the layer up to date with the grid; returns how many tiles were repainted. */
export function syncTileLayer(layer: TileLayer, g: Grid): number {
  if (layer.w !== g.w || layer.h !== g.h) {
    layer.w = g.w;
    layer.h = g.h;
    layer.canvas.width = g.w * TILE;
    layer.canvas.height = g.h * TILE;
    layer.ctx.imageSmoothingEnabled = false;
    layer.tiles = new Uint8Array(g.tiles.length).fill(255);
  }
  const dirty = new Uint8Array(g.tiles.length);
  let any = false;
  for (let i = 0; i < g.tiles.length; i++) {
    if (layer.tiles[i] === g.tiles[i]) continue;
    any = true;
    const x = i % g.w;
    const y = (i - x) / g.w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) dirty[ny * g.w + nx] = 1;
      }
    }
  }
  if (!any) return 0;
  let n = 0;
  for (let i = 0; i < dirty.length; i++) {
    if (!dirty[i]) continue;
    const x = i % g.w;
    const y = (i - x) / g.w;
    drawStaticTile(layer.ctx, g, x, y);
    n++;
  }
  layer.tiles.set(g.tiles);
  return n;
}
