/**
 * Lighting as a coloured light map. The scene is drawn first; then an
 * offscreen map (half resolution, smoothed) is filled with the ambient dark
 * and coloured radial lights are added with 'lighter'; the map is multiplied
 * onto the scene. The Heart glows red, the Portal violet, torches orange,
 * Pools cold blue. Torches flicker on two sines unless motion is reduced.
 */
import type { Entity } from '../sim/entities';
import { type Grid, Tile, tilesOf } from '../sim/grid';
import { TILE } from './tiles';

/** Fraction of the light map scale: 0.5 means half resolution. */
export const LIGHTMAP_SCALE = 0.5;
export const AMBIENT = 'rgb(36, 27, 48)';

interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  phase: number;
  /** Flicker amplitude; 0 for steady lights. */
  flicker: number;
}

export interface LightingOptions {
  /** Disable flicker (prefers-reduced-motion). */
  reducedMotion: boolean;
}

function collectLights(g: Grid, entities: readonly Entity[]): Light[] {
  const lights: Light[] = [];
  const add = (x: number, y: number, r: number, color: string, phase: number, flicker = 0.06): void => {
    lights.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r, color, phase, flicker });
  };
  for (const p of tilesOf(g, Tile.Heart)) add(p.x, p.y, 120, 'rgba(255, 70, 70, 0.95)', 0, 0.04);
  for (const p of tilesOf(g, Tile.Portal)) add(p.x, p.y, 74, 'rgba(170, 110, 255, 0.9)', 1.3, 0.05);
  for (const p of tilesOf(g, Tile.Gate)) add(p.x, p.y, 66, 'rgba(210, 220, 255, 0.85)', 2.1, 0.02);
  tilesOf(g, Tile.Lair).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 58, 'rgba(255, 150, 60, 0.9)', i);
  });
  tilesOf(g, Tile.Hatchery).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 54, 'rgba(255, 170, 80, 0.85)', i + 0.5);
  });
  tilesOf(g, Tile.Treasury).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 54, 'rgba(255, 200, 90, 0.85)', i + 0.7);
  });
  tilesOf(g, Tile.Pool).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 48, 'rgba(90, 170, 255, 0.8)', i + 0.9, 0.02);
  });
  for (const e of entities) {
    if (e.kind === 'coblyn') add(e.x, e.y, 48, 'rgba(255, 180, 90, 0.8)', e.id);
    else if (e.kind === 'knight' || e.kind === 'priest' || e.kind === 'lord' || e.kind === 'levy' || e.kind === 'relic')
      add(e.x, e.y, 60, 'rgba(255, 220, 160, 0.8)', e.id);
    else if (e.kind === 'pwca') add(e.x, e.y, 22, 'rgba(255, 230, 80, 0.7)', e.id, 0.1);
    else if (e.kind === 'teg') add(e.x, e.y, 42, 'rgba(200, 255, 200, 0.7)', e.id, 0.02);
  }
  return lights;
}

export function createLightMap(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * LIGHTMAP_SCALE);
  c.height = Math.ceil(h * LIGHTMAP_SCALE);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}

/**
 * Draw the scene first, then call this. Finishes with a faint ember wash.
 */
export function drawLighting(
  ctx: CanvasRenderingContext2D,
  map: CanvasRenderingContext2D,
  g: Grid,
  entities: readonly Entity[],
  t: number,
  opts: LightingOptions = { reducedMotion: false },
): void {
  const w = g.w * TILE;
  const h = g.h * TILE;
  const k = LIGHTMAP_SCALE;
  map.globalCompositeOperation = 'source-over';
  map.fillStyle = AMBIENT;
  map.fillRect(0, 0, map.canvas.width, map.canvas.height);
  map.globalCompositeOperation = 'lighter';
  for (const l of collectLights(g, entities)) {
    const flicker = opts.reducedMotion
      ? 1
      : 1 + l.flicker * Math.sin(t * 7.3 + l.phase) + l.flicker * 0.7 * Math.sin(t * 13.1 + l.phase * 1.7);
    const r = l.r * 1.2 * flicker * k;
    const x = l.x * k;
    const y = l.y * k;
    const grad = map.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, l.color);
    grad.addColorStop(0.45, l.color.replace(/[\d.]+\)$/, '0.55)'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    map.fillStyle = grad;
    map.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(map.canvas, 0, 0, w, h);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(255, 122, 31, 0.035)';
  ctx.fillRect(0, 0, w, h);
}
