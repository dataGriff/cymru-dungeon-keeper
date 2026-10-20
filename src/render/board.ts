import { BESTIARY } from '../data/bestiary';
import type { Entity } from '../sim/entities';
import { type GameState, treasuryCapacity, vaultGold, warded } from '../sim/game';
import { GATE_POS, type Vec, inBounds, isRock, markedTiles, tileAt } from '../sim/grid';
import { type LightingOptions, createLightMap, drawLighting } from './lighting';
import { PALETTE as P } from './palette';
import { drawBeast, drawEngine } from './sprites';
import { TILE, drawRubble, drawTile } from './tiles';
import { CORPSE_SECONDS, RUBBLE_SECONDS } from '../sim/game';

export interface BoardView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: CanvasRenderingContext2D;
  lighting: LightingOptions;
  /** Colour-blind safe bars: blue for the hall, orange for mortals, with a stripe for the damaged part. */
  safeColours: boolean;
  /** Milliseconds spent this frame on tiles, entities and lighting, for the profiler. */
  timings: { tiles: number; entities: number; lighting: number };
}

export function createBoardView(canvas: HTMLCanvasElement, w: number, h: number): BoardView {
  canvas.width = w * TILE;
  canvas.height = h * TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    canvas,
    ctx,
    light: createLightMap(canvas.width, canvas.height),
    lighting: { reducedMotion: reduced },
    safeColours: false,
    timings: { tiles: 0, entities: 0, lighting: 0 },
  };
}

export const SPRITE_PX = 2;

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, t: number, alpha: number, selected: boolean, safe: boolean): void {
  const ix = e.px + (e.x - e.px) * alpha;
  const iy = e.py + (e.y - e.py) * alpha;
  const cx = (ix + 0.5) * TILE;
  const baseY = (iy + 1) * TILE - 1;
  const sleeping = e.task === 'sleep';
  // A soft blob shadow under the feet.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (selected) {
    ctx.strokeStyle = P.bone;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 1, 11, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const action = sleeping
    ? 'sleep'
    : e.task === 'eat'
      ? 'eat'
      : (e.task === 'chase' || e.task === 'strike') && e.cooldown > 0.55
        ? 'attack'
        : e.path.length > 0
          ? 'walk'
          : 'idle';
  drawBeast(ctx, e.kind, cx, baseY, SPRITE_PX, {
    t: t + e.id,
    facing: e.facing,
    moving: e.path.length > 0,
    sleeping,
    action,
  });
  if (e.held > 0) {
    ctx.strokeStyle = P.gateLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 7, baseY - 6, 14, 5);
  }
  if (e.flash > 0) {
    ctx.fillStyle = P.blood;
    ctx.globalAlpha = Math.min(1, e.flash * 4);
    ctx.fillRect(cx - 10, baseY - 26, 20, 24);
    ctx.globalAlpha = 1;
  }
  if (sleeping) {
    const bob = Math.sin((t + e.id) * 3) * 3;
    ctx.fillStyle = P.bone;
    ctx.font = '12px VT323, monospace';
    ctx.fillText('z', cx + 8, baseY - 24 + bob);
  }
  if (e.task === 'eat') {
    ctx.fillStyle = P.hatcheryEgg;
    const crumb = Math.floor((t * 6) % 3);
    ctx.fillRect(cx + 6 + crumb * 2, baseY - 8 + crumb, 2, 2);
  }
  if (e.carrying > 0) {
    ctx.fillStyle = P.goldDark;
    ctx.fillRect(cx - 3, baseY - 31, 6, 4);
    ctx.fillStyle = P.gold;
    ctx.fillRect(cx - 2, baseY - 30, 4, 2);
  }
  // Mood glyph: ! angry, ? afraid, ~ hungry, z tired (a sleeping creature already shows a z).
  if (e.mood !== 'content' && !sleeping) {
    const glyph = e.mood === 'angry' ? '!' : e.mood === 'afraid' ? '?' : e.mood === 'hungry' ? '~' : 'z';
    ctx.fillStyle = e.mood === 'angry' ? P.blood : e.mood === 'hungry' ? P.gold : P.bone;
    ctx.font = 'bold 12px VT323, monospace';
    ctx.fillText(glyph, cx - 11, baseY - 24);
  }
  if (e.hp < e.maxHp) {
    const frac = Math.max(0, e.hp / e.maxHp);
    const hero = BESTIARY[e.kind].stats.allegiance === 'mortal';
    ctx.fillStyle = P.hpBack;
    ctx.fillRect(cx - 8, baseY - 32, 16, 3);
    if (safe) {
      // Allegiance by hue (blue/orange read for every common colour vision), damage by length and a stripe.
      ctx.fillStyle = hero ? '#f0a030' : '#5aa9ff';
      ctx.fillRect(cx - 8, baseY - 32, Math.round(16 * frac), 3);
      ctx.fillStyle = P.bone;
      for (let x = Math.round(16 * frac); x < 16; x += 3) ctx.fillRect(cx - 8 + x, baseY - 31, 1, 1);
    } else {
      ctx.fillStyle = frac > 0.4 ? P.hpGood : P.hpBad;
      ctx.fillRect(cx - 8, baseY - 32, Math.round(16 * frac), 3);
    }
  }
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const px = x * TILE;
  const py = y * TILE;
  const glint = Math.sin(t * 5 + x) > 0.6;
  ctx.fillStyle = P.goldDark;
  ctx.fillRect(px + 9, py + 17, 10, 4);
  ctx.fillStyle = P.gold;
  ctx.fillRect(px + 11, py + 14, 6, 3);
  if (glint) ctx.fillRect(px + 8, py + 12, 2, 2);
}

/**
 * Draw everything: tiles, drops, beasts (back to front), then the lighting pass.
 * `alpha` is the fraction of the way from the previous sim tick to the current one.
 */
export function drawBoard(
  view: BoardView,
  s: GameState,
  t: number,
  hover: Vec | null,
  alpha = 1,
  selectedId: number | null = null,
  lit = true,
): void {
  const { ctx } = view;
  const g = s.grid;
  const cap = treasuryCapacity(g);
  const fill = cap > 0 ? Math.min(1, vaultGold(s) / cap) : 0;
  const t0 = performance.now();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) drawTile(ctx, g, x, y, t, fill);
  const t1 = performance.now();
  view.timings.tiles = t1 - t0;
  for (const r of s.rubble) drawRubble(ctx, r.x, r.y, s.time - r.t, RUBBLE_SECONDS);
  for (const c of s.corpses) {
    ctx.globalAlpha = Math.max(0, 1 - (s.time - c.t) / CORPSE_SECONDS);
    drawBeast(ctx, c.kind, (c.x + 0.5) * TILE, (c.y + 1) * TILE - 1, SPRITE_PX, { facing: c.facing, action: 'dead' });
    ctx.globalAlpha = 1;
  }
  for (const d of s.drops) drawDrop(ctx, d.x, d.y, t);
  for (const trap of s.traps) {
    drawEngine(ctx, trap.kind, (trap.x + 0.5) * TILE, (trap.y + 0.5) * TILE, 2, trap.built);
    if (!trap.built) {
      ctx.fillStyle = P.hpBack;
      ctx.fillRect(trap.x * TILE + 6, trap.y * TILE + TILE - 5, 16, 3);
      ctx.fillStyle = P.mark;
      ctx.fillRect(trap.x * TILE + 6, trap.y * TILE + TILE - 5, Math.round(16 * trap.progress), 3);
    }
  }
  for (const b of s.boulders) drawEngine(ctx, 'boulder', (b.x + 0.5) * TILE, (b.y + 0.5) * TILE, 2);
  const sorted = [...s.entities].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEntity(ctx, e, t, alpha, e.id === selectedId, view.safeColours);
  if (warded(s)) {
    // The emissary's ward: a cold ring on the Gate.
    const gx = (GATE_POS.x + 0.5) * TILE;
    const gy = (GATE_POS.y + 0.5) * TILE;
    ctx.strokeStyle = P.ward;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5);
    ctx.beginPath();
    ctx.arc(gx, gy, 12 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const t2 = performance.now();
  view.timings.entities = t2 - t1;
  if (lit) drawLighting(ctx, view.light, g, s.entities, t, { ...view.lighting, hunt: s.hunt });
  view.timings.lighting = performance.now() - t2;
  // The steward's own marks stay legible in the dark: redraw them over the lighting.
  ctx.strokeStyle = P.mark;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  for (const m of markedTiles(g)) {
    const px = m.x * TILE;
    const py = m.y * TILE;
    ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4);
    ctx.lineTo(px + TILE - 4, py + TILE - 4);
    ctx.moveTo(px + TILE - 4, py + 4);
    ctx.lineTo(px + 4, py + TILE - 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (hover && inBounds(g, hover.x, hover.y)) {
    ctx.strokeStyle = isRock(tileAt(g, hover.x, hover.y)) ? P.mark : P.bone;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.strokeRect(hover.x * TILE + 0.5, hover.y * TILE + 0.5, TILE - 1, TILE - 1);
    ctx.globalAlpha = 1;
  }
}

/** The entity under a board pixel, if any (for opening the manual). */
export function entityAt(s: GameState, px: number, py: number): Entity | null {
  let best: Entity | null = null;
  let bestD = 12;
  for (const e of s.entities) {
    const cx = (e.x + 0.5) * TILE;
    const cy = (e.y + 0.5) * TILE;
    const d = Math.hypot(cx - px, cy - py);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export const beastName = (e: Entity): string => BESTIARY[e.kind].name;
