import { BESTIARY } from '../data/bestiary';
import type { Entity } from '../sim/entities';
import { type GameState, treasuryCapacity, vaultGold } from '../sim/game';
import { type Vec, inBounds, isRock, markedTiles, tileAt } from '../sim/grid';
import { drawLighting } from './lighting';
import { PALETTE as P } from './palette';
import { drawBeast } from './sprites';
import { TILE, drawTile } from './tiles';

export interface BoardView {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: CanvasRenderingContext2D;
}

export function createBoardView(canvas: HTMLCanvasElement, w: number, h: number): BoardView {
  canvas.width = w * TILE;
  canvas.height = h * TILE;
  const ctx = canvas.getContext('2d');
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  const light = lightCanvas.getContext('2d');
  if (!ctx || !light) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, light };
}

export const SPRITE_PX = 2;

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, t: number, alpha: number): void {
  const ix = e.px + (e.x - e.px) * alpha;
  const iy = e.py + (e.y - e.py) * alpha;
  const cx = (ix + 0.5) * TILE;
  const baseY = (iy + 1) * TILE - 1;
  const sleeping = e.task === 'sleep';
  drawBeast(ctx, e.kind, cx, baseY, SPRITE_PX, {
    t: t + e.id,
    facing: e.facing,
    moving: e.path.length > 0,
    sleeping,
  });
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
  if (e.unpaid > 0) {
    ctx.fillStyle = P.blood;
    ctx.font = 'bold 12px VT323, monospace';
    ctx.fillText('!', cx - 10, baseY - 24);
  }
  if (e.hp < e.maxHp) {
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = P.hpBack;
    ctx.fillRect(cx - 8, baseY - 32, 16, 3);
    ctx.fillStyle = frac > 0.4 ? P.hpGood : P.hpBad;
    ctx.fillRect(cx - 8, baseY - 32, Math.round(16 * frac), 3);
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
export function drawBoard(view: BoardView, s: GameState, t: number, hover: Vec | null, alpha = 1): void {
  const { ctx } = view;
  const g = s.grid;
  const cap = treasuryCapacity(g);
  const fill = cap > 0 ? Math.min(1, vaultGold(s) / cap) : 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) drawTile(ctx, g, x, y, t, fill);
  for (const d of s.drops) drawDrop(ctx, d.x, d.y, t);
  const sorted = [...s.entities].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEntity(ctx, e, t, alpha);
  drawLighting(ctx, view.light, g, s.entities, t);
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
