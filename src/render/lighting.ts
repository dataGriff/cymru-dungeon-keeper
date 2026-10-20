import type { Entity } from '../sim/entities';
import { type Grid, Tile, tilesOf } from '../sim/grid';
import { TILE } from './tiles';

export const DARKNESS = 0.86;

interface Light {
  x: number;
  y: number;
  r: number;
  /** Phase so torches don't all flicker in step. */
  phase: number;
}

function collectLights(g: Grid, entities: readonly Entity[]): Light[] {
  const lights: Light[] = [];
  const add = (x: number, y: number, r: number, phase: number): void => {
    lights.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r, phase });
  };
  for (const p of tilesOf(g, Tile.Heart)) add(p.x, p.y, 110, 0);
  for (const p of tilesOf(g, Tile.Portal)) add(p.x, p.y, 70, 1.3);
  for (const p of tilesOf(g, Tile.Gate)) add(p.x, p.y, 64, 2.1);
  tilesOf(g, Tile.Lair).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 56, i);
  });
  tilesOf(g, Tile.Hatchery).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 52, i + 0.5);
  });
  tilesOf(g, Tile.Treasury).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 52, i + 0.7);
  });
  tilesOf(g, Tile.Pool).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 44, i + 0.9);
  });
  for (const e of entities) {
    if (e.kind === 'coblyn') add(e.x, e.y, 46, e.id);
    else if (e.kind === 'knight' || e.kind === 'priest') add(e.x, e.y, 58, e.id);
    else if (e.kind === 'pwca') add(e.x, e.y, 22, e.id);
    else if (e.kind === 'teg') add(e.x, e.y, 40, e.id);
  }
  return lights;
}

/**
 * Draw the scene first, then call this: it lays an 86% dark layer over the
 * board and cuts radial holes with destination-out, torches flickering by
 * two sines on time, then finishes with a faint ember wash.
 */
export function drawLighting(
  ctx: CanvasRenderingContext2D,
  layer: CanvasRenderingContext2D,
  g: Grid,
  entities: readonly Entity[],
  t: number,
): void {
  const w = g.w * TILE;
  const h = g.h * TILE;
  layer.globalCompositeOperation = 'source-over';
  layer.clearRect(0, 0, w, h);
  layer.fillStyle = `rgba(6, 3, 12, ${DARKNESS})`;
  layer.fillRect(0, 0, w, h);
  layer.globalCompositeOperation = 'destination-out';
  for (const l of collectLights(g, entities)) {
    const flicker = 1 + 0.06 * Math.sin(t * 7.3 + l.phase) + 0.04 * Math.sin(t * 13.1 + l.phase * 1.7);
    const r = l.r * flicker;
    const grad = layer.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    layer.fillStyle = grad;
    layer.fillRect(l.x - r, l.y - r, r * 2, r * 2);
  }
  layer.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.fillStyle = 'rgba(255, 122, 31, 0.035)';
  ctx.fillRect(0, 0, w, h);
}
