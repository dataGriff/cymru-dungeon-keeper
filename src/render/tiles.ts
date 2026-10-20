import { openEdges, sameRoom } from '../sim/autotile';
import { type Grid, Tile, isMarked, isRoom, tileAt } from '../sim/grid';
import { PALETTE as P } from './palette';

export const TILE = 28;

/** Cheap stable hash so flecks stay put between frames. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function flecks(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number, n: number, color: string, salt: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const fx = Math.floor(hash2(x, y, salt + i * 2) * (TILE - 4)) + 2;
    const fy = Math.floor(hash2(x, y, salt + i * 2 + 1) * (TILE - 4)) + 2;
    ctx.fillRect(px + fx, py + fy, 2, 2);
  }
}

function drawFloorBase(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = P.floorShadow;
  ctx.fillRect(px, py, TILE, 1);
  ctx.fillRect(px, py, 1, TILE);
}

/**
 * @param fill How full the Treasury is, 0..1; only Treasury tiles use it.
 */
export function drawTile(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number, t: number, fill = 0): void {
  const px = x * TILE;
  const py = y * TILE;
  const tile = tileAt(g, x, y);
  switch (tile) {
    case Tile.Rock:
    case Tile.Gold: {
      ctx.fillStyle = hash2(x, y, 7) < 0.5 ? P.rock : P.rockLight;
      ctx.fillRect(px, py, TILE, TILE);
      flecks(ctx, px, py, x, y, 3, P.rockDark, 11);
      // Rock faces: a lit lip where the rock meets open floor, a shadow underneath.
      const open = openEdges(g, x, y);
      ctx.fillStyle = P.rockFace;
      if (open.down) ctx.fillRect(px, py + TILE - 3, TILE, 3);
      if (open.right) ctx.fillRect(px + TILE - 2, py, 2, TILE);
      ctx.fillStyle = P.rockDark;
      if (open.up) ctx.fillRect(px, py, TILE, 2);
      if (open.left) ctx.fillRect(px, py, 2, TILE);
      if (tile === Tile.Gold) {
        flecks(ctx, px, py, x, y, 5, P.gold, 23);
        flecks(ctx, px, py, x, y, 3, P.goldDark, 41);
        // Glint: one fleck catches the light now and then.
        const phase = (t * 0.7 + hash2(x, y, 99) * 7) % 7;
        if (phase < 0.25) {
          ctx.fillStyle = P.bone;
          const gx = Math.floor(hash2(x, y, 23) * (TILE - 4)) + 2;
          const gy = Math.floor(hash2(x, y, 24) * (TILE - 4)) + 2;
          ctx.fillRect(px + gx - 1, py + gy, 4, 2);
          ctx.fillRect(px + gx, py + gy - 1, 2, 4);
        }
      }
      if (isMarked(g, x, y)) {
        ctx.strokeStyle = P.mark;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
        ctx.beginPath();
        ctx.moveTo(px + 4, py + 4);
        ctx.lineTo(px + TILE - 4, py + TILE - 4);
        ctx.moveTo(px + TILE - 4, py + 4);
        ctx.lineTo(px + 4, py + TILE - 4);
        ctx.stroke();
      }
      break;
    }
    case Tile.Floor:
      drawFloorBase(ctx, px, py, P.floor);
      break;
    case Tile.Lair:
      drawFloorBase(ctx, px, py, P.lair);
      ctx.fillStyle = P.lairStraw;
      for (let i = 0; i < 4; i++) {
        const sx = 4 + Math.floor(hash2(x, y, 50 + i) * 16);
        const sy = 5 + Math.floor(hash2(x, y, 60 + i) * 16);
        ctx.fillRect(px + sx, py + sy, 6, 2);
      }
      break;
    case Tile.Hatchery: {
      drawFloorBase(ctx, px, py, P.hatchery);
      const ex = 6 + Math.floor(hash2(x, y, 70) * 10);
      const ey = 8 + Math.floor(hash2(x, y, 71) * 8);
      ctx.fillStyle = P.hatcheryEggShade;
      ctx.fillRect(px + ex, py + ey, 8, 10);
      ctx.fillStyle = P.hatcheryEgg;
      ctx.fillRect(px + ex + 1, py + ey + 1, 6, 7);
      ctx.fillStyle = P.hatcheryEggShade;
      ctx.fillRect(px + ex + 2, py + ey + 4, 2, 2);
      break;
    }
    case Tile.Treasury: {
      drawFloorBase(ctx, px, py, P.treasury);
      ctx.fillStyle = P.goldDark;
      ctx.fillRect(px + 5, py + 20, 18, 3);
      // Coin stacks rise as the vault fills.
      const stacks = Math.round(fill * 4);
      ctx.fillStyle = P.gold;
      if (stacks >= 1) ctx.fillRect(px + 7, py + 16, 14, 4);
      if (stacks >= 2) ctx.fillRect(px + 9, py + 12, 10, 4);
      if (stacks >= 3) ctx.fillRect(px + 11, py + 8, 6, 4);
      if (stacks >= 4) ctx.fillRect(px + 4, py + 10, 3, 10);
      if (fill > 0) flecks(ctx, px, py, x, y, 2, P.gold, 80);
      break;
    }
    case Tile.Portal: {
      ctx.fillStyle = P.portal;
      ctx.fillRect(px, py, TILE, TILE);
      const cx = px + TILE / 2;
      const cy = py + TILE / 2;
      ctx.strokeStyle = P.portalRing;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const rr = 3 + ((t * 5 + i * 4) % 12);
        ctx.globalAlpha = 0.85 - (rr / 12) * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case Tile.Heart: {
      drawFloorBase(ctx, px, py, P.floor);
      const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      const half = Math.round(7 + pulse * 3);
      const cx = px + TILE / 2;
      const cy = py + TILE / 2;
      ctx.fillStyle = P.heartDark;
      ctx.fillRect(cx - 11, cy - 11, 22, 22);
      ctx.fillStyle = P.heart;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.fillStyle = P.heartGlow;
      ctx.fillRect(cx - half + 2, cy - half + 2, half - 2, half - 2);
      break;
    }
    case Tile.Pool: {
      drawFloorBase(ctx, px, py, P.pool);
      ctx.fillStyle = P.poolDeep;
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      // A ripple that drifts with time, and a still highlight.
      ctx.fillStyle = P.poolLight;
      const ry = 6 + Math.floor(((t * 3 + hash2(x, y, 90) * 10) % 10) * 1.6);
      ctx.fillRect(px + 6, py + ry, 10, 1);
      ctx.fillRect(px + 14, py + ((ry + 8) % 20) + 4, 8, 1);
      ctx.fillRect(px + 5, py + 5, 3, 1);
      break;
    }
    case Tile.Gate: {
      ctx.fillStyle = P.gate;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = P.gateLight;
      ctx.fillRect(px + 6, py + 4, 16, 24);
      ctx.fillStyle = P.gateIron;
      for (let i = 0; i < 4; i++) ctx.fillRect(px + 7 + i * 4, py + 4, 2, 24);
      ctx.fillRect(px + 4, py + 2, 20, 2);
      break;
    }
  }
  if (isRoom(tile)) drawRoomEdges(ctx, g, x, y, px, py);
}

/** A thin bright rule where a room meets anything that is not itself, so regions read as rooms. */
function drawRoomEdges(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number, px: number, py: number): void {
  const open = openEdges(g, x, y, sameRoom);
  ctx.fillStyle = P.roomEdge;
  if (open.up) ctx.fillRect(px + 1, py + 1, TILE - 2, 1);
  if (open.left) ctx.fillRect(px + 1, py + 1, 1, TILE - 2);
  ctx.fillStyle = P.roomEdgeDark;
  if (open.down) ctx.fillRect(px + 1, py + TILE - 2, TILE - 2, 1);
  if (open.right) ctx.fillRect(px + TILE - 2, py + 1, 1, TILE - 2);
}

/** Rubble left where a tile was dug, fading over a few seconds. */
export function drawRubble(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, life: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.globalAlpha = Math.max(0, 1 - age / life);
  for (let i = 0; i < 6; i++) {
    const rx = Math.floor(hash2(x, y, 300 + i) * (TILE - 6)) + 3;
    const ry = Math.floor(hash2(x, y, 320 + i) * (TILE - 6)) + 3;
    ctx.fillStyle = i % 2 === 0 ? P.rockLight : P.rockDark;
    ctx.fillRect(px + rx, py + ry, 3, 2);
  }
  ctx.globalAlpha = 1;
}
