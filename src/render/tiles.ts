/**
 * Tile art, on the same 2px pixel grid as the sprites (14x14 logical pixels
 * per 28px tile). Static art (stone, floor, rooms, landmarks) is produced as
 * a colour grid per tile and blitted into a cached layer (see tilelayer.ts);
 * animated parts (water, the Heart, the Portal, glints, coin stacks) are
 * drawn every frame on top.
 */
import { openEdges, sameRoom } from '../sim/autotile';
import { type Grid, Tile, inBounds, isRock, isRoom, isWalkable, tileAt } from '../sim/grid';
import { alpha, hexOf, rgbOf } from '../design/color';
import { B } from './colors';
import { type PixelName, drawPixels, mapSize, pixelMap } from './pixels';

export const TILE = 28;
/** Logical pixels per tile side. */
export const LP = 14;
/** Screen pixels per logical pixel. */
export const PX = TILE / LP;

/** Cheap stable hash so texture stays put between frames. */
export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// ---------- colour helpers ----------

/** Mix `hex` towards `to` by f (0..1), quantised so neighbouring pixels share colours. */
export function mix(hex: string, to: string, f: number): string {
  const q = Math.round(f * 8) / 8;
  if (q <= 0) return hex;
  const a = rgbOf(hex);
  const b = rgbOf(to);
  return hexOf(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q);
}

// ---------- palettes ----------


// ---------- the stone field (shared by rock tiles so stones cross tile edges) ----------

const CELL = 6;

interface Stone {
  id: number;
  d1: number;
  d2: number;
}

function stoneAt(X: number, Y: number): Stone {
  const cx = Math.floor(X / CELL);
  const cy = Math.floor(Y / CELL);
  let d1 = Infinity;
  let d2 = Infinity;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      const gy = cy + j;
      const sx = gx * CELL + hash2(gx, gy, 11) * CELL;
      const sy = gy * CELL + hash2(gx, gy, 12) * CELL;
      const d = (sx - X) * (sx - X) * 1.0 + (sy - Y) * (sy - Y) * 1.4;
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = gx * 7919 + gy * 104729;
      } else if (d < d2) d2 = d;
    }
  }
  return { id, d1: Math.sqrt(d1), d2: Math.sqrt(d2) };
}

const open = (g: Grid, x: number, y: number): boolean => inBounds(g, x, y) && !isRock(tileAt(g, x, y));
const rockAt = (g: Grid, x: number, y: number): boolean => inBounds(g, x, y) && isRock(tileAt(g, x, y));

type Px = string | null;
type TileGrid = Px[][];

const blank = (): TileGrid => Array.from({ length: LP }, () => Array<Px>(LP).fill(null));

// ---------- rock and gold ----------

function rockGrid(g: Grid, x: number, y: number, gold: boolean): TileGrid {
  const out = blank();
  const faceBelow = open(g, x, y + 1);
  const lipAbove = open(g, x, y - 1);
  const openL = open(g, x - 1, y);
  const openR = open(g, x + 1, y);
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      const X = x * LP + lx;
      const Y = y * LP + ly;
      let c: string;
      if (faceBelow && ly >= 9) {
        // The wall face, seen from the floor below: strata, lit top, dark foot.
        if (ly === 9) c = B.stone.faceTop;
        else if (ly === LP - 1) c = B.stone.faceFoot;
        else c = B.stone.face[(ly + Math.floor(hash2(Math.floor(X / 3), ly, 5) * 2)) % 3] as string;
        if (gold && hash2(X, Y, 31) < 0.12) c = hash2(X, Y, 32) < 0.6 ? B.gold : B.goldDark;
      } else {
        const st = stoneAt(X, Y);
        const shade = Math.floor(hash2(st.id, 0, 3) * B.stone.shades.length);
        if (st.d2 - st.d1 < 1.1) c = B.stone.crack;
        else {
          const above = stoneAt(X, Y - 1);
          c = above.id !== st.id ? (B.stone.lit[shade] as string) : (B.stone.shades[shade] as string);
          if (gold && hash2(st.id, 1, 7) < 0.55) {
            const h = hash2(X, Y, 33);
            if (h < 0.22) c = B.gold;
            else if (h < 0.36) c = B.goldDark;
          }
        }
        if (lipAbove && ly === 0) c = B.stone.lip;
        if (openL && lx === 0) c = mix(c, B.stone.edgeLit, 0.5);
        if (openR && lx === LP - 1) c = mix(c, B.stone.dark, 0.35);
      }
      (out[ly] as Px[])[lx] = c;
    }
  }
  return out;
}

// ---------- floor ----------

function floorColour(X: number, Y: number): string {
  const row = Math.floor(Y / 7);
  const offset = (row % 2) * 3 + Math.floor(hash2(row, 0, 41) * 3);
  const col = Math.floor((X + offset) / 7);
  if (Y % 7 === 0 || (X + offset) % 7 === 0) return B.floor.grout;
  const shade = Math.floor(hash2(row, col, 42) * B.floor.shades.length);
  // Some stones carry a crack.
  if (hash2(row, col, 43) < 0.18) {
    const lx = (X + offset) % 7;
    const ly = Y % 7;
    if (lx === ly + 1 || (lx === ly && ly > 3)) return B.floor.grout;
  }
  if (Y % 7 === 1) return B.floor.lit[shade] as string;
  if (hash2(X, Y, 44) < 0.015) return B.floor.pebble;
  return B.floor.shades[shade] as string;
}

/** Floor with ambient occlusion where walls stand beside or above it. */
function floorGrid(g: Grid, x: number, y: number, base: (X: number, Y: number) => string = floorColour): TileGrid {
  const out = blank();
  const wallAbove = rockAt(g, x, y - 1);
  const wallL = rockAt(g, x - 1, y);
  const wallR = rockAt(g, x + 1, y);
  const AO_TOP = [0.55, 0.35, 0.2, 0.1];
  const AO_SIDE = [0.35, 0.15];
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      let c = base(x * LP + lx, y * LP + ly);
      let f = 0;
      if (wallAbove && ly < AO_TOP.length) f = Math.max(f, AO_TOP[ly] as number);
      if (wallL && lx < AO_SIDE.length) f = Math.max(f, AO_SIDE[lx] as number);
      if (wallR && LP - 1 - lx < AO_SIDE.length) f = Math.max(f, AO_SIDE[LP - 1 - lx] as number);
      if (f > 0) c = mix(c, B.stone.dark, f);
      (out[ly] as Px[])[lx] = c;
    }
  }
  return out;
}

/** A thin bright rule where a room meets anything that is not itself, so regions read as rooms. */
function roomEdges(out: TileGrid, g: Grid, x: number, y: number, light: string, dark: string): void {
  const e = openEdges(g, x, y, sameRoom);
  for (let i = 0; i < LP; i++) {
    if (e.up) (out[0] as Px[])[i] = light;
    if (e.left) (out[i] as Px[])[0] = light;
    if (e.down) (out[LP - 1] as Px[])[i] = dark;
    if (e.right) (out[i] as Px[])[LP - 1] = dark;
  }
}

function put(out: TileGrid, lx: number, ly: number, c: string): void {
  if (lx >= 0 && ly >= 0 && lx < LP && ly < LP) (out[ly] as Px[])[lx] = c;
}

/** Stamp a named pixel map onto a tile grid. */
function stamp(out: TileGrid, name: PixelName, ox: number, oy: number): void {
  const { rows, palette: pal } = pixelMap(name);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] as string;
      if (ch !== '.') put(out, ox + i, oy + j, pal[ch] ?? B.missing);
    }
  });
}

// ---------- rooms ----------


function lairGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => mix(floorColour(X, Y), B.lair.tint, 0.5));
  for (let ly = 1; ly < LP - 1; ly++) {
    for (let lx = 1; lx < LP - 1; lx++) {
      const X = x * LP + lx;
      const Y = y * LP + ly;
      const dx = lx - 6.5;
      const dy = (ly - 7) * 1.2;
      const r = Math.sqrt(dx * dx + dy * dy);
      // A nest: dense straw in a ring, a dark hollow in the middle.
      if (r < 2.2) put(out, lx, ly, hash2(X, Y, 51) < 0.3 ? B.lair.hollowSpeck : B.lair.hollow);
      else if (r < 6.2) {
        const strand = hash2(Math.floor((X + Y) / 2), Y % 3, 52);
        if (strand < 0.55) put(out, lx, ly, B.lair.straw[Math.floor(hash2(X, Y, 53) * B.lair.straw.length)] as string);
      } else if (hash2(X, Y, 54) < 0.15) put(out, lx, ly, B.lair.straw[2] as string);
    }
  }
  roomEdges(out, g, x, y, B.lair.edge, B.lair.edgeDark);
  return out;
}

function hatcheryGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => {
    const h = hash2(X, Y, 61);
    const moss = hash2(Math.floor(X / 4), Math.floor(Y / 4), 62) < 0.35;
    if (moss && h < 0.6) return h < 0.3 ? B.hatchery.moss[0] : B.hatchery.moss[1];
    return h < 0.5 ? B.hatchery.loam[0] : B.hatchery.loam[1];
  });
  const n = 1 + Math.floor(hash2(x, y, 63) * 2);
  for (let i = 0; i < n + 1; i++) {
    const ex = 1 + Math.floor(hash2(x, y, 64 + i) * 9);
    const ey = 2 + Math.floor(hash2(x, y, 70 + i) * 7);
    for (let k = 0; k < 4; k++) put(out, ex + k, ey + 5, B.hatchery.eggShadow);
    stamp(out, 'tile.egg', ex, ey);
  }
  roomEdges(out, g, x, y, B.hatchery.edge, B.hatchery.edgeDark);
  return out;
}

function treasuryGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => {
    // Polished dark stone in a diamond lattice.
    const d = ((X + Y) % 7 === 0 || (X - Y + 700) % 7 === 0) ? B.treasury.lattice : hash2(X, Y, 81) < 0.5 ? B.treasury.stone[0] : B.treasury.stone[1];
    return d;
  });
  const e = openEdges(g, x, y, sameRoom);
  for (let i = 0; i < LP; i++) {
    if (e.up) {
      put(out, i, 1, B.treasury.inlay);
      put(out, i, 0, B.treasury.rim);
    }
    if (e.down) {
      put(out, i, LP - 2, B.treasury.inlay);
      put(out, i, LP - 1, B.treasury.rim);
    }
    if (e.left) {
      put(out, 1, i, B.treasury.inlayLit);
      put(out, 0, i, B.treasury.rim);
    }
    if (e.right) {
      put(out, LP - 2, i, B.treasury.inlay);
      put(out, LP - 1, i, B.treasury.rim);
    }
  }
  return out;
}

function poolGrid(g: Grid, x: number, y: number): TileGrid {
  const out = blank();
  const e = openEdges(g, x, y, sameRoom);
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      const X = x * LP + lx;
      const Y = y * LP + ly;
      const depth = Math.min(lx, ly, LP - 1 - lx, LP - 1 - ly);
      let c = hash2(Math.floor(X / 2), Math.floor(Y / 2), 91) < 0.5 ? B.pool.deep[0] : B.pool.deep[1];
      const nearShore = (e.up && ly < 2) || (e.down && ly > LP - 3) || (e.left && lx < 2) || (e.right && lx > LP - 3);
      if (nearShore) c = B.pool.shallow;
      if ((e.up && ly === 0) || (e.down && ly === LP - 1) || (e.left && lx === 0) || (e.right && lx === LP - 1)) c = B.pool.shore;
      if (!nearShore && depth > 4 && hash2(X, Y, 92) < 0.4) c = B.pool.deepest;
      (out[ly] as Px[])[lx] = c;
    }
  }
  if (rockAt(g, x, y - 1)) for (let lx = 0; lx < LP; lx++) put(out, lx, 0, B.pool.shadow);
  return out;
}

// ---------- landmarks ----------

function heartGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y);
  stamp(out, 'tile.dais', 0, 0);
  return out;
}

function portalGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y);
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      const dx = lx - 6.5;
      const dy = ly - 6.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 5.2) put(out, lx, ly, r < 4 ? B.portal.pit : B.portal.rim);
    }
  }
  // A ring of eight small standing stones.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.round(6.5 + Math.cos(a) * 5.6 - 0.5);
    const sy = Math.round(6.5 + Math.sin(a) * 5.6 - 1);
    put(out, sx, sy, B.portal.stones[0]);
    put(out, sx, sy + 1, B.portal.stones[1]);
    put(out, sx + 1, sy, B.portal.stones[2]);
    put(out, sx + 1, sy + 1, B.portal.stones[3]);
  }
  return out;
}

function gateGrid(): TileGrid {
  const out = blank();
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      let c: string = B.gate.dark;
      // Cold daylight beyond the bars, brightest at the middle.
      if (lx >= 3 && lx <= 10 && ly >= 3) c = ly > 9 ? B.gate.daylight[1] : B.gate.daylight[0];
      // Portcullis.
      if (lx >= 3 && lx <= 10 && ly >= 3 && (lx % 2 === 1 || ly === 7 || ly === 11)) c = B.gate.bars;
      // Stone jambs and lintel.
      if (lx < 3 || lx > 10 || ly < 3) {
        const block = (Math.floor((ly + (lx < 3 ? 0 : 2)) / 3) + (lx < 3 ? 0 : 1)) % 2;
        c = block ? B.gate.jamb[0] : B.gate.jamb[1];
        if (ly % 3 === 0 && ly > 2) c = B.gate.joint;
        if (ly < 3 && (lx + 2) % 5 === 0) c = B.gate.joint;
        if (ly === 0) c = B.gate.lintel;
      }
      (out[ly] as Px[])[lx] = c;
    }
  }
  return out;
}

/** The static art for one tile. */
export function tileGrid(g: Grid, x: number, y: number): TileGrid {
  switch (tileAt(g, x, y)) {
    case Tile.Rock:
      return rockGrid(g, x, y, false);
    case Tile.Gold:
      return rockGrid(g, x, y, true);
    case Tile.Floor:
      return floorGrid(g, x, y);
    case Tile.Lair:
      return lairGrid(g, x, y);
    case Tile.Hatchery:
      return hatcheryGrid(g, x, y);
    case Tile.Treasury:
      return treasuryGrid(g, x, y);
    case Tile.Pool:
      return poolGrid(g, x, y);
    case Tile.Heart:
      return heartGrid(g, x, y);
    case Tile.Portal:
      return portalGrid(g, x, y);
    case Tile.Gate:
      return gateGrid();
  }
}

/** Blit a tile grid as horizontal runs. */
export function blitGrid(ctx: CanvasRenderingContext2D, grid: TileGrid, px: number, py: number): void {
  for (let ly = 0; ly < LP; ly++) {
    const row = grid[ly] as Px[];
    let lx = 0;
    while (lx < LP) {
      const c = row[lx] ?? null;
      if (c === null) {
        lx++;
        continue;
      }
      let end = lx + 1;
      while (end < LP && row[end] === c) end++;
      ctx.fillStyle = c;
      ctx.fillRect(px + lx * PX, py + ly * PX, (end - lx) * PX, PX);
      lx = end;
    }
  }
}

/** Draw a tile's static art directly (used by the cache and by tests of the art). */
export function drawStaticTile(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number): void {
  blitGrid(ctx, tileGrid(g, x, y), x * TILE, y * TILE);
}

// ---------- animated, drawn every frame under the lighting ----------

const COIN_STACKS: readonly (readonly [number, number])[] = [
  [3, 8],
  [8, 7],
  [5, 3],
  [9, 2],
];

function coinStack(ctx: CanvasRenderingContext2D, px: number, py: number, lx: number, ly: number, h: number): void {
  for (let i = 0; i < h; i++) {
    const y = py + (ly + 3 - i) * PX;
    ctx.fillStyle = B.goldDark;
    ctx.fillRect(px + lx * PX, y, 3 * PX, PX);
    ctx.fillStyle = i === h - 1 ? B.goldLight : B.gold;
    ctx.fillRect(px + lx * PX, y - PX + PX, 2 * PX, PX / 2);
  }
}

/** Under-light animation: water, coin stacks. Cheap: only these tiles. */
export function drawAnimatedTile(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number, t: number, fill: number, reduced: boolean): void {
  const px = x * TILE;
  const py = y * TILE;
  const tile = tileAt(g, x, y);
  if (tile === Tile.Pool) {
    // Caustics: bright threads drifting across the water.
    ctx.fillStyle = B.pool.caustic;
    const tt = reduced ? 0 : t;
    for (let i = 0; i < 3; i++) {
      const ly = 2 + ((Math.floor(tt * 2.2 + hash2(x, y, 95 + i) * 12) + i * 4) % 11);
      const lx = 1 + Math.floor(hash2(x, ly, 96 + i) * 8);
      ctx.fillRect(px + lx * PX, py + ly * PX, (2 + (i % 2) * 2) * PX, PX);
    }
    if (!reduced && hash2(x, y, Math.floor(t * 0.7)) < 0.08) {
      // An occasional ripple ring.
      const k = (t * 0.7) % 1;
      ctx.strokeStyle = alpha(B.pool.ripple, 0.5 * (1 - k));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(px + TILE / 2, py + TILE / 2, 3 + k * 9, 2 + k * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (tile === Tile.Treasury && fill > 0) {
    const stacks = Math.ceil(fill * 8);
    COIN_STACKS.forEach(([lx, ly], i) => {
      const h = Math.max(0, Math.min(4, stacks - i * 2));
      if (h > 0 && hash2(x, y, 100 + i) < 0.5 + fill * 0.5) coinStack(ctx, px, py, lx, ly, h);
    });
  }
}

// ---------- emissive, drawn every frame over the lighting ----------

/** Over-light: things that glow by their own light. Returns nothing; draws in place. */
export function drawEmissiveTile(ctx: CanvasRenderingContext2D, g: Grid, x: number, y: number, t: number, reduced: boolean, heartHp: number): void {
  const px = x * TILE;
  const py = y * TILE;
  const tile = tileAt(g, x, y);
  if (tile === Tile.Heart) {
    // Beats faster and paler as it is hurt.
    const rate = 3 + (1 - heartHp / 100) * 6;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * rate);
    const glow = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 1, px + TILE / 2, py + TILE / 2, 16 + pulse * 4);
    glow.addColorStop(0, alpha(B.heart.glow, 0.45 + pulse * 0.25));
    glow.addColorStop(1, alpha(B.heart.glowEdge, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(px - 8, py - 8, TILE + 16, TILE + 16);
    ctx.globalCompositeOperation = 'source-over';
    const { w, h } = mapSize('gem.heart');
    const ox = px + (TILE - w * PX) / 2;
    const oy = py + (TILE - h * PX) / 2 - (pulse > 0.75 ? 1 : 0);
    drawPixels(ctx, 'gem.heart', ox, oy, PX, pulse > 0.6 ? { variant: 'lit' } : {});
  } else if (tile === Tile.Portal) {
    // Three arms of violet motes winding into the dark.
    ctx.globalCompositeOperation = 'lighter';
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    const spin = reduced ? 0 : t * 1.6;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    core.addColorStop(0, alpha(B.portal.glow, 0.55));
    core.addColorStop(1, alpha(B.portal.glowEdge, 0));
    ctx.fillStyle = core;
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
    for (let arm = 0; arm < 3; arm++) {
      for (let k = 0; k < 8; k++) {
        const r = 0.6 + k * 0.62;
        const a = spin + arm * ((Math.PI * 2) / 3) + k * 0.55;
        const mx = Math.round((cx + Math.cos(a) * r * PX) / PX) * PX;
        const my = Math.round((cy + Math.sin(a) * r * PX) / PX) * PX;
        ctx.fillStyle = k < 2 ? B.portal.motes[0] : k < 4 ? B.portal.motes[1] : B.portal.motes[2];
        ctx.fillRect(mx - PX / 2, my - PX / 2, PX, PX);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (tile === Tile.Gold) {
    // Now and then a vein catches the light.
    const phase = (t * 0.6 + hash2(x, y, 99) * 9) % 9;
    if (!reduced && phase < 0.35) {
      const lx = 2 + Math.floor(hash2(x, y, 98) * 10);
      const ly = 2 + Math.floor(hash2(x, y, 97) * 6);
      const a = 1 - Math.abs(phase - 0.17) / 0.17;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = B.glint;
      ctx.fillRect(px + lx * PX, py + (ly - 1) * PX, PX, 3 * PX);
      ctx.fillRect(px + (lx - 1) * PX, py + ly * PX, 3 * PX, PX);
      ctx.globalAlpha = 1;
    }
  } else if (tile === Tile.Gate) {
    const shimmer = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3 + x);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = alpha(B.gate.shimmer, 0.12 + shimmer * 0.08);
    ctx.fillRect(px + 3 * PX, py + 3 * PX, 8 * PX, 11 * PX);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** True for tiles with under-light or emissive animation, so the board only visits those. */
export const isAnimated = (t: Tile): boolean =>
  t === Tile.Pool || t === Tile.Treasury || t === Tile.Heart || t === Tile.Portal || t === Tile.Gold || t === Tile.Gate;

/** Rubble left where a tile was dug, fading over a few seconds. */
export function drawRubble(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, life: number): void {
  const px = x * TILE;
  const py = y * TILE;
  ctx.globalAlpha = Math.max(0, 1 - age / life);
  for (let i = 0; i < 7; i++) {
    const rx = 1 + Math.floor(hash2(x, y, 300 + i) * 11);
    const ry = 2 + Math.floor(hash2(x, y, 320 + i) * 10);
    ctx.fillStyle = i % 3 === 0 ? B.stone.lit[1] as string : i % 3 === 1 ? B.stone.shades[2] as string : B.stone.crack;
    ctx.fillRect(px + rx * PX, py + ry * PX, (1 + (i % 2)) * PX, PX);
  }
  ctx.globalAlpha = 1;
}

export { isWalkable, isRoom };
