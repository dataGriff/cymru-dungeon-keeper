/**
 * Lighting as a coloured light map. The scene is drawn first; then an
 * offscreen map (half resolution, smoothed) is filled with the ambient dark
 * and coloured radial lights are added with 'lighter'; the map is multiplied
 * onto the scene. The Heart glows red, the Portal violet, torches orange,
 * Pools cold blue. Torches flicker on two sines unless motion is reduced.
 */
import type { Entity } from '../sim/entities';
import { type Grid, Tile, tilesOf } from '../sim/grid';
import { alpha } from '../design/color';
import { B } from './colors';
import { TILE } from './tiles';

/** Fraction of the light map scale: 0.5 means half resolution. */
export const LIGHTMAP_SCALE = 0.5;
/** The hall's own dark: low enough to hide, high enough that undug rock still reads as rock. */
/** The ambient as a 0..1 brightness, for sampling the light at a point. */
export const AMBIENT_LEVEL = 0.34;

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  phase: number;
  /** Flicker amplitude; 0 for steady lights. */
  flicker: number;
  /** Warm lights shed embers; cold ones hold motes. */
  temper: 'warm' | 'cold' | 'none';
}

export interface LightingOptions {
  /** Disable flicker (prefers-reduced-motion). */
  reducedMotion: boolean;
  /** The Hunt has returned: every torch burns white and the ambient goes cold. */
  hunt?: boolean;
}

export function collectLights(g: Grid, entities: readonly Entity[]): Light[] {
  const lights: Light[] = [];
  const add = (x: number, y: number, r: number, color: string, phase: number, flicker = 0.06, temper: Light['temper'] = 'none'): void => {
    lights.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r, color, phase, flicker, temper });
  };
  for (const p of tilesOf(g, Tile.Heart)) add(p.x, p.y, 120, alpha(B.light.heart, 0.95), 0, 0.04, 'warm');
  for (const p of tilesOf(g, Tile.Portal)) add(p.x, p.y, 74, alpha(B.light.portal, 0.9), 1.3, 0.05);
  for (const p of tilesOf(g, Tile.Gate)) add(p.x, p.y, 66, alpha(B.light.gate, 0.85), 2.1, 0.02, 'cold');
  tilesOf(g, Tile.Lair).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 58, alpha(B.light.lair, 0.9), i, 0.06, 'warm');
  });
  tilesOf(g, Tile.Hatchery).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 54, alpha(B.light.hatchery, 0.85), i + 0.5, 0.06, 'warm');
  });
  tilesOf(g, Tile.Treasury).forEach((p, i) => {
    if (i % 4 === 0) add(p.x, p.y, 54, alpha(B.light.treasury, 0.85), i + 0.7);
  });
  tilesOf(g, Tile.Pool).forEach((p, i) => {
    if (i % 3 === 0) add(p.x, p.y, 48, alpha(B.light.pool, 0.8), i + 0.9, 0.02);
  });
  for (const e of entities) {
    if (e.kind === 'coblyn') add(e.x, e.y, 48, alpha(B.light.coblyn, 0.8), e.id);
    else if (e.kind === 'knight' || e.kind === 'priest' || e.kind === 'lord' || e.kind === 'levy' || e.kind === 'relic')
      add(e.x, e.y, 60, alpha(B.light.mortal, 0.8), e.id);
    else if (e.kind === 'pwca') add(e.x, e.y, 22, alpha(B.light.pwca, 0.7), e.id, 0.1);
    else if (e.kind === 'teg') add(e.x, e.y, 42, alpha(B.light.teg, 0.7), e.id, 0.02);
  }
  return lights;
}

/**
 * How lit a point is, 0 (the ambient dark) to 1 (fully lit), from the same
 * lights the map is painted with. Used to dim creatures standing in the dark
 * without staining their colours the way the multiplied map stains the floor.
 */
export function lightAt(lights: readonly Light[], x: number, y: number): number {
  let sum = AMBIENT_LEVEL;
  for (const l of lights) {
    const r = l.r * 1.2;
    const d = Math.hypot(l.x - x, l.y - y);
    if (d >= r) continue;
    sum += (1 - d / r) * 1.4;
  }
  return Math.min(1, sum);
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
  lights: readonly Light[],
  t: number,
  opts: LightingOptions = { reducedMotion: false },
): void {
  const w = g.w * TILE;
  const h = g.h * TILE;
  const k = LIGHTMAP_SCALE;
  map.globalCompositeOperation = 'source-over';
  map.fillStyle = opts.hunt ? B.light.ambientHunt : B.light.ambient;
  map.fillRect(0, 0, map.canvas.width, map.canvas.height);
  map.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const flicker = opts.reducedMotion
      ? 1
      : 1 + l.flicker * Math.sin(t * 7.3 + l.phase) + l.flicker * 0.7 * Math.sin(t * 13.1 + l.phase * 1.7);
    const r = l.r * 1.2 * flicker * k;
    const x = l.x * k;
    const y = l.y * k;
    const grad = map.createRadialGradient(x, y, 0, x, y, r);
    const color = opts.hunt ? alpha(B.light.hunt, 0.95) : l.color;
    grad.addColorStop(0, color);
    grad.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.55)'));
    grad.addColorStop(1, alpha(B.shadow, 0));
    map.fillStyle = grad;
    map.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(map.canvas, 0, 0, w, h);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = alpha(B.light.wash, 0.035);
  ctx.fillRect(0, 0, w, h);
  // A soft vignette, so the eye stays on the hall and off the frame.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, alpha(B.light.vignette, 0));
  v.addColorStop(1, alpha(B.light.vignette, 0.45));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
