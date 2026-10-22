import { BESTIARY } from '../data/bestiary';
import type { Entity } from '../sim/entities';
import { CORPSE_SECONDS, type GameState, RUBBLE_SECONDS, type SimEvent, heartOf, portalOf, treasuryCapacity, vaultGold, warded } from '../sim/game';
import { GATE_POS, type Vec, inBounds, isRock, markedTiles, tileAt } from '../sim/grid';
import { type Light, type LightingOptions, collectLights, createLightMap, drawLighting, lightAt } from './lighting';
import { alpha } from '../design/color';
import { B, look } from './colors';
import { Particles } from './particles';
import { drawPixels } from './pixels';
import { type BeastTint, drawBeast, drawEngine } from './sprites';
import { TileLayer, createTileLayer, syncTileLayer } from './tilelayer';
import { PX, TILE, drawAnimatedTile, drawEmissiveTile, drawRubble, isAnimated } from './tiles';

export interface BoardView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: CanvasRenderingContext2D;
  lighting: LightingOptions;
  tiles: TileLayer;
  particles: Particles;
  /** Colour-blind safe bars: blue for the hall, orange for mortals, with a stripe for the damaged part. */
  safeColours: boolean;
  /** Milliseconds spent this frame on tiles, entities and lighting, for the profiler. */
  timings: { tiles: number; entities: number; lighting: number };
  /** Render clock of the previous frame, for particle steps. */
  lastT: number;
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
    tiles: createTileLayer(),
    particles: new Particles(),
    safeColours: false,
    timings: { tiles: 0, entities: 0, lighting: 0 },
    lastT: -1,
  };
}

/** Feed this frame's sim events to the particles. */
export function boardReact(view: BoardView, s: GameState, events: readonly SimEvent[]): void {
  view.particles.react(events, { heart: heartOf(s), portal: portalOf(s) });
}

export const SPRITE_PX = 2;

interface Placed {
  e: Entity;
  cx: number;
  baseY: number;
}

function place(e: Entity, alpha: number): Placed {
  const ix = e.px + (e.x - e.px) * alpha;
  const iy = e.py + (e.y - e.py) * alpha;
  return { e, cx: (ix + 0.5) * TILE, baseY: (iy + 1) * TILE - 2 };
}

function actionOf(e: Entity): 'sleep' | 'eat' | 'attack' | 'walk' | 'idle' {
  if (e.task === 'sleep') return 'sleep';
  if (e.task === 'eat') return 'eat';
  if ((e.task === 'chase' || e.task === 'strike') && e.cooldown > 0.55) return 'attack';
  return e.path.length > 0 ? 'walk' : 'idle';
}

/** Under the lighting: the shadow on the floor and the steward's selection ring. */
function drawGround(ctx: CanvasRenderingContext2D, p: Placed, selected: boolean): void {
  ctx.fillStyle = alpha(B.shadow, 0.5);
  ctx.fillRect(p.cx - 5 * PX, p.baseY - PX, 10 * PX, 2 * PX);
  ctx.fillRect(p.cx - 3 * PX, p.baseY, 6 * PX, PX);
  if (selected) {
    ctx.strokeStyle = B.bone;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.cx, p.baseY, 12, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Over the lighting: the figure, dimmed by the dark it stands in, then its readouts. */
function drawFigure(ctx: CanvasRenderingContext2D, p: Placed, t: number, lights: readonly Light[] | null, safe: boolean): void {
  const { e, cx, baseY } = p;
  const action = actionOf(e);
  const tints: BeastTint[] = [];
  if (lights) {
    const lit = lightAt(lights, cx, baseY - 10);
    tints.push({ color: B.ink, alpha: (1 - lit) * 0.72 });
    if (look.figureWash > 0) tints.push({ color: B.huntWash, alpha: look.figureWash });
  }
  if (e.flash > 0) tints.push({ color: B.hitFlash, alpha: Math.min(1, e.flash * 4) * 0.75 });
  drawBeast(ctx, e.kind, cx, baseY, SPRITE_PX, { t: t + e.id, facing: e.facing, moving: e.path.length > 0, action, tints });

  const top = baseY - 16 * PX;
  if (e.held > 0) {
    ctx.fillStyle = B.held;
    ctx.fillRect(cx - 5 * PX, baseY - 2 * PX, 10 * PX, PX);
    ctx.fillRect(cx - 5 * PX, baseY - 3 * PX, PX, 2 * PX);
    ctx.fillRect(cx + 4 * PX, baseY - 3 * PX, PX, 2 * PX);
  }
  if (action === 'sleep') {
    const bob = Math.round(Math.sin((t + e.id) * 2.5) * 2);
    drawPixels(ctx, 'glyph.z', cx + 4 * PX, top + 4 * PX + bob, 1.5, { color: B.bone });
  }
  if (action === 'eat') {
    ctx.fillStyle = B.crumb;
    const crumb = Math.floor((t * 6) % 3);
    ctx.fillRect(cx + (4 + crumb) * PX, baseY - (4 - crumb) * PX, PX, PX);
  }
  if (e.carrying > 0) {
    drawPixels(ctx, 'coin.carry', cx - 2 * PX, top - PX, PX);
  }
  // Mood glyph: ! angry, ? afraid, ~ hungry, z tired (a sleeping creature already shows a z).
  if (e.mood !== 'content' && action !== 'sleep') {
    const glyph = e.mood === 'angry' ? 'glyph.angry' : e.mood === 'afraid' ? 'glyph.afraid' : e.mood === 'hungry' ? 'glyph.hungry' : 'glyph.z';
    const color = e.mood === 'angry' ? B.mood.angry : e.mood === 'hungry' ? B.mood.hungry : B.mood.other;
    drawPixels(ctx, glyph, cx - 7 * PX, top + PX, 1.5, { color });
  }
  if (e.hp < e.maxHp) {
    const frac = Math.max(0, e.hp / e.maxHp);
    const hero = BESTIARY[e.kind].stats.allegiance === 'mortal';
    const w = 16;
    const x = Math.round(cx - w / 2);
    const y = Math.round(top - 4);
    ctx.fillStyle = B.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = B.hp.back;
    ctx.fillRect(x, y, w, 3);
    if (safe) {
      // Allegiance by hue (blue/orange read for every common colour vision), damage by length and a stripe.
      ctx.fillStyle = hero ? B.hpSafe.hero : B.hpSafe.hall;
      ctx.fillRect(x, y, Math.round(w * frac), 3);
      ctx.fillStyle = B.hpSafe.stripe;
      for (let i = Math.round(w * frac); i < w; i += 3) ctx.fillRect(x + i, y + 1, 1, 1);
    } else {
      ctx.fillStyle = frac > 0.4 ? (hero ? B.hp.hero : B.hp.good) : B.hp.bad;
      ctx.fillRect(x, y, Math.round(w * frac), 3);
      ctx.fillStyle = alpha(B.hp.shine, 0.25);
      ctx.fillRect(x, y, Math.round(w * frac), 1);
    }
  }
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, gold: number): void {
  const n = gold >= 40 ? 2 : 1;
  for (let i = 0; i < n; i++) drawPixels(ctx, 'pile.gold', x * TILE + (3 + i * 5) * PX, y * TILE + (7 + i) * PX, PX);
}

/** Corner brackets: the marked-for-digging pattern, the hover cursor. */
function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, len: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.fillStyle = color;
  const t = PX;
  for (const [ox, oy, sx, sy] of [
    [0, 0, 1, 1],
    [TILE, 0, -1, 1],
    [0, TILE, 1, -1],
    [TILE, TILE, -1, -1],
  ] as const) {
    ctx.fillRect(px + ox + (sx < 0 ? -len : 0), py + oy + (sy < 0 ? -t : 0), len, t);
    ctx.fillRect(px + ox + (sx < 0 ? -t : 0), py + oy + (sy < 0 ? -len : 0), t, len);
  }
}

/**
 * Draw everything. Order: the cached stone, animated water and coin, things
 * on the floor, shadows, then the light map; then what glows by its own
 * light, the figures (dimmed by the dark they stand in), particles, and the
 * steward's marks. `alpha` is the fraction of the way from the previous sim
 * tick to the current one.
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
  const reduced = view.lighting.reducedMotion;
  const dt = view.lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - view.lastT));
  view.lastT = t;
  const t0 = performance.now();

  syncTileLayer(view.tiles, g);
  ctx.drawImage(view.tiles.canvas, 0, 0);
  const cap = treasuryCapacity(g);
  const fill = cap > 0 ? Math.min(1, vaultGold(s) / cap) : 0;
  const animated: number[] = [];
  for (let i = 0; i < g.tiles.length; i++) if (isAnimated(g.tiles[i] as number)) animated.push(i);
  for (const i of animated) drawAnimatedTile(ctx, g, i % g.w, Math.floor(i / g.w), t, fill, reduced);
  const t1 = performance.now();
  view.timings.tiles = t1 - t0;

  for (const r of s.rubble) drawRubble(ctx, r.x, r.y, s.time - r.t, RUBBLE_SECONDS);
  for (const c of s.corpses) {
    ctx.globalAlpha = Math.max(0, 1 - (s.time - c.t) / CORPSE_SECONDS);
    drawBeast(ctx, c.kind, (c.x + 0.5) * TILE, (c.y + 1) * TILE - 2, SPRITE_PX, { facing: c.facing, action: 'dead' });
    ctx.globalAlpha = 1;
  }
  for (const d of s.drops) drawDrop(ctx, d.x, d.y, d.gold);
  for (const trap of s.traps) {
    drawEngine(ctx, trap.kind, (trap.x + 0.5) * TILE, (trap.y + 0.5) * TILE, PX, trap.built);
    if (!trap.built) {
      ctx.fillStyle = B.hp.back;
      ctx.fillRect(trap.x * TILE + 6, trap.y * TILE + TILE - 5, 16, 3);
      ctx.fillStyle = B.mark;
      ctx.fillRect(trap.x * TILE + 6, trap.y * TILE + TILE - 5, Math.round(16 * trap.progress), 3);
    }
  }
  for (const b of s.boulders) drawEngine(ctx, 'boulder', (b.x + 0.5) * TILE, (b.y + 0.5) * TILE, PX);
  const placed = [...s.entities].sort((a, b) => a.y - b.y).map((e) => place(e, alpha));
  for (const p of placed) drawGround(ctx, p, p.e.id === selectedId);

  const t2 = performance.now();
  const lights = lit ? collectLights(g, s.entities) : null;
  if (lights) drawLighting(ctx, view.light, g, lights, t, view.lighting);
  view.timings.lighting = performance.now() - t2;

  const t3 = performance.now();
  for (const i of animated) drawEmissiveTile(ctx, g, i % g.w, Math.floor(i / g.w), t, reduced, s.heartHp);
  for (const p of placed) drawFigure(ctx, p, t, lights, view.safeColours);
  if (warded(s)) {
    // The emissary's ward: a cold ring on the Gate.
    const gx = (GATE_POS.x + 0.5) * TILE;
    const gy = (GATE_POS.y + 0.5) * TILE;
    ctx.strokeStyle = B.ward;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5);
    ctx.beginPath();
    ctx.arc(gx, gy, 12 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (lights && !reduced) view.particles.ambient(lights, dt);
  view.particles.update(dt, t);
  view.particles.draw(ctx);
  view.timings.entities = performance.now() - t3 + (t2 - t1);

  // The steward's marks stay legible in the dark: brackets and a pick-cross, gently pulsing.
  const pulse = reduced ? 0.8 : 0.65 + 0.2 * Math.sin(t * 4);
  ctx.globalAlpha = pulse;
  for (const m of markedTiles(g)) {
    brackets(ctx, m.x, m.y, B.mark, 3 * PX);
    ctx.fillStyle = B.mark;
    const cx = m.x * TILE + TILE / 2;
    const cy = m.y * TILE + TILE / 2;
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(cx + k * PX - PX / 2, cy + k * PX - PX / 2, PX, PX);
      ctx.fillRect(cx + k * PX - PX / 2, cy - k * PX - PX / 2, PX, PX);
    }
  }
  ctx.globalAlpha = 1;
  if (hover && inBounds(g, hover.x, hover.y)) brackets(ctx, hover.x, hover.y, isRock(tileAt(g, hover.x, hover.y)) ? B.markHover : B.bone, 4 * PX);
}

/** The entity under a board pixel, if any (for opening the manual). */
export function entityAt(s: GameState, px: number, py: number): Entity | null {
  let best: Entity | null = null;
  let bestD = 14;
  for (const e of s.entities) {
    const cx = (e.x + 0.5) * TILE;
    const cy = (e.y + 0.5) * TILE - 4;
    const d = Math.hypot(cx - px, cy - py);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export const beastName = (e: Entity): string => BESTIARY[e.kind].name;
