/**
 * Tile art, on the same 2px pixel grid as the sprites (14x14 logical pixels
 * per 28px tile). Static art (stone, floor, rooms, landmarks) is produced as
 * a colour grid per tile and blitted into a cached layer (see tilelayer.ts);
 * animated parts (water, the Heart, the Portal, glints, coin stacks) are
 * drawn every frame on top.
 */
import { openEdges, sameRoom } from '../sim/autotile';
import { type Grid, Tile, inBounds, isRock, isRoom, isWalkable, tileAt } from '../sim/grid';
import { PALETTE as P } from './palette';

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

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    rgbCache.set(hex, c);
  }
  return c;
}
const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Mix `hex` towards `to` by f (0..1), quantised so neighbouring pixels share colours. */
export function mix(hex: string, to: string, f: number): string {
  const q = Math.round(f * 8) / 8;
  if (q <= 0) return hex;
  const a = rgb(hex);
  const b = rgb(to);
  return toHex(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q);
}

// ---------- palettes ----------

const ROCK = ['#16111e', '#1a1423', '#1e1728', '#221a2d'];
const ROCK_LIT = ['#251c31', '#292036', '#2d233a', '#32273f'];
const ROCK_CRACK = '#0b0810';
const FACE = ['#40324f', '#382c46', '#30263d'];
const FACE_TOP = '#5a4870';
const FACE_FOOT = '#1d1626';
const FLOOR = ['#3d3242', '#423647', '#463a4b', '#3a2f3f'];
const FLOOR_LIT = ['#4a3e50', '#4f4255', '#534658', '#463a4c'];
const GROUT = '#211a27';
const PEBBLE = '#5a4d60';
const BLACK = '#000000';

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
        if (ly === 9) c = FACE_TOP;
        else if (ly === LP - 1) c = FACE_FOOT;
        else c = FACE[(ly + Math.floor(hash2(Math.floor(X / 3), ly, 5) * 2)) % 3] as string;
        if (gold && hash2(X, Y, 31) < 0.12) c = hash2(X, Y, 32) < 0.6 ? P.gold : P.goldDark;
      } else {
        const st = stoneAt(X, Y);
        const shade = Math.floor(hash2(st.id, 0, 3) * ROCK.length);
        if (st.d2 - st.d1 < 1.1) c = ROCK_CRACK;
        else {
          const above = stoneAt(X, Y - 1);
          c = above.id !== st.id ? (ROCK_LIT[shade] as string) : (ROCK[shade] as string);
          if (gold && hash2(st.id, 1, 7) < 0.55) {
            const h = hash2(X, Y, 33);
            if (h < 0.22) c = P.gold;
            else if (h < 0.36) c = P.goldDark;
          }
        }
        if (lipAbove && ly === 0) c = '#3e3250';
        if (openL && lx === 0) c = mix(c, '#4a3c5a', 0.5);
        if (openR && lx === LP - 1) c = mix(c, BLACK, 0.35);
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
  if (Y % 7 === 0 || (X + offset) % 7 === 0) return GROUT;
  const shade = Math.floor(hash2(row, col, 42) * FLOOR.length);
  // Some stones carry a crack.
  if (hash2(row, col, 43) < 0.18) {
    const lx = (X + offset) % 7;
    const ly = Y % 7;
    if (lx === ly + 1 || (lx === ly && ly > 3)) return GROUT;
  }
  if (Y % 7 === 1) return FLOOR_LIT[shade] as string;
  if (hash2(X, Y, 44) < 0.015) return PEBBLE;
  return FLOOR[shade] as string;
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
      if (f > 0) c = mix(c, BLACK, f);
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

/** Stamp a small pixel map (rows of palette keys) onto a tile grid. */
function stamp(out: TileGrid, rows: readonly string[], pal: Readonly<Record<string, string>>, ox: number, oy: number): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] as string;
      if (ch !== '.') put(out, ox + i, oy + j, pal[ch] ?? '#ff00ff');
    }
  });
}

// ---------- rooms ----------

const STRAW = ['#7a5e36', '#94743f', '#5e462a', '#a8844a'];

function lairGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => mix(floorColour(X, Y), '#3a1e26', 0.5));
  for (let ly = 1; ly < LP - 1; ly++) {
    for (let lx = 1; lx < LP - 1; lx++) {
      const X = x * LP + lx;
      const Y = y * LP + ly;
      const dx = lx - 6.5;
      const dy = (ly - 7) * 1.2;
      const r = Math.sqrt(dx * dx + dy * dy);
      // A nest: dense straw in a ring, a dark hollow in the middle.
      if (r < 2.2) put(out, lx, ly, hash2(X, Y, 51) < 0.3 ? '#5a3e26' : '#3a281c');
      else if (r < 6.2) {
        const strand = hash2(Math.floor((X + Y) / 2), Y % 3, 52);
        if (strand < 0.55) put(out, lx, ly, STRAW[Math.floor(hash2(X, Y, 53) * STRAW.length)] as string);
      } else if (hash2(X, Y, 54) < 0.15) put(out, lx, ly, STRAW[2] as string);
    }
  }
  roomEdges(out, g, x, y, '#7a5a3a', '#1e1218');
  return out;
}

const EGG = ['.EE.', 'EEEE', 'EEsE', 'eEEe', '.ee.'];
const EGG_PAL = { E: '#ece2c4', s: '#8f8464', e: '#b8a986' };

function hatcheryGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => {
    const h = hash2(X, Y, 61);
    const moss = hash2(Math.floor(X / 4), Math.floor(Y / 4), 62) < 0.35;
    if (moss && h < 0.6) return h < 0.3 ? '#3e4a2a' : '#465630';
    return h < 0.5 ? '#2a271c' : '#312d20';
  });
  const n = 1 + Math.floor(hash2(x, y, 63) * 2);
  for (let i = 0; i < n + 1; i++) {
    const ex = 1 + Math.floor(hash2(x, y, 64 + i) * 9);
    const ey = 2 + Math.floor(hash2(x, y, 70 + i) * 7);
    for (let k = 0; k < 4; k++) put(out, ex + k, ey + 5, '#16140e');
    stamp(out, EGG, EGG_PAL, ex, ey);
  }
  roomEdges(out, g, x, y, '#5a6a3a', '#12100a');
  return out;
}

function treasuryGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y, (X, Y) => {
    // Polished dark stone in a diamond lattice.
    const d = ((X + Y) % 7 === 0 || (X - Y + 700) % 7 === 0) ? '#22182a' : hash2(X, Y, 81) < 0.5 ? '#2e2232' : '#2a1f2e';
    return d;
  });
  const e = openEdges(g, x, y, sameRoom);
  for (let i = 0; i < LP; i++) {
    if (e.up) {
      put(out, i, 1, '#9a7120');
      put(out, i, 0, '#1a1018');
    }
    if (e.down) {
      put(out, i, LP - 2, '#9a7120');
      put(out, i, LP - 1, '#1a1018');
    }
    if (e.left) {
      put(out, 1, i, '#c8962c');
      put(out, 0, i, '#1a1018');
    }
    if (e.right) {
      put(out, LP - 2, i, '#9a7120');
      put(out, LP - 1, i, '#1a1018');
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
      let c = hash2(Math.floor(X / 2), Math.floor(Y / 2), 91) < 0.5 ? '#0f2a40' : '#123552';
      const nearShore = (e.up && ly < 2) || (e.down && ly > LP - 3) || (e.left && lx < 2) || (e.right && lx > LP - 3);
      if (nearShore) c = '#1d4e66';
      if ((e.up && ly === 0) || (e.down && ly === LP - 1) || (e.left && lx === 0) || (e.right && lx === LP - 1)) c = '#3a7a90';
      if (!nearShore && depth > 4 && hash2(X, Y, 92) < 0.4) c = '#0c2236';
      (out[ly] as Px[])[lx] = c;
    }
  }
  if (rockAt(g, x, y - 1)) for (let lx = 0; lx < LP; lx++) put(out, lx, 0, '#0a1622');
  return out;
}

// ---------- landmarks ----------

const DAIS = [
  '....oooooo....',
  '..ooSSSSSSoo..',
  '.oSSsssssSSSo.',
  '.oSsskkkksSSo.',
  'oSSskkkkkksSSo',
  'oSskkkkkkkksSo',
  'oSskkkkkkkksSo',
  'oSskkkkkkkksSo',
  'oSskkkkkkkksSo',
  'oSSskkkkkksSSo',
  '.oSsskkkksSSo.',
  '.oSSsssssSSSo.',
  '..ooSSSSSSoo..',
  '....oooooo....',
];
const DAIS_PAL = { o: '#1a1420', S: '#4a3e54', s: '#3a3044', k: '#241c2c' };

function heartGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y);
  stamp(out, DAIS, DAIS_PAL, 0, 0);
  // Knot-dots in the dais rim.
  for (const [lx, ly] of [
    [6, 1],
    [7, 1],
    [1, 6],
    [1, 7],
    [12, 6],
    [12, 7],
    [6, 12],
    [7, 12],
  ] as const)
    put(out, lx, ly, '#6a5a74');
  return out;
}

function portalGrid(g: Grid, x: number, y: number): TileGrid {
  const out = floorGrid(g, x, y);
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      const dx = lx - 6.5;
      const dy = ly - 6.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 5.2) put(out, lx, ly, r < 4 ? '#06040a' : '#120a1c');
    }
  }
  // A ring of eight small standing stones.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.round(6.5 + Math.cos(a) * 5.6 - 0.5);
    const sy = Math.round(6.5 + Math.sin(a) * 5.6 - 1);
    put(out, sx, sy, '#5a5064');
    put(out, sx, sy + 1, '#3e3648');
    put(out, sx + 1, sy, '#4a4254');
    put(out, sx + 1, sy + 1, '#2e2838');
  }
  return out;
}

function gateGrid(): TileGrid {
  const out = blank();
  for (let ly = 0; ly < LP; ly++) {
    for (let lx = 0; lx < LP; lx++) {
      let c = '#0a0812';
      // Cold daylight beyond the bars, brightest at the middle.
      if (lx >= 3 && lx <= 10 && ly >= 3) c = ly > 9 ? '#4a5468' : '#3a4256';
      // Portcullis.
      if (lx >= 3 && lx <= 10 && ly >= 3 && (lx % 2 === 1 || ly === 7 || ly === 11)) c = '#6a6a76';
      // Stone jambs and lintel.
      if (lx < 3 || lx > 10 || ly < 3) {
        const block = (Math.floor((ly + (lx < 3 ? 0 : 2)) / 3) + (lx < 3 ? 0 : 1)) % 2;
        c = block ? '#4a4252' : '#3e3746';
        if (ly % 3 === 0 && ly > 2) c = '#2a2432';
        if (ly < 3 && (lx + 2) % 5 === 0) c = '#2a2432';
        if (ly === 0) c = '#5a5262';
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
    ctx.fillStyle = P.goldDark;
    ctx.fillRect(px + lx * PX, y, 3 * PX, PX);
    ctx.fillStyle = i === h - 1 ? '#ffe08a' : P.gold;
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
    ctx.fillStyle = '#2f7896';
    const tt = reduced ? 0 : t;
    for (let i = 0; i < 3; i++) {
      const ly = 2 + ((Math.floor(tt * 2.2 + hash2(x, y, 95 + i) * 12) + i * 4) % 11);
      const lx = 1 + Math.floor(hash2(x, ly, 96 + i) * 8);
      ctx.fillRect(px + lx * PX, py + ly * PX, (2 + (i % 2) * 2) * PX, PX);
    }
    if (!reduced && hash2(x, y, Math.floor(t * 0.7)) < 0.08) {
      // An occasional ripple ring.
      const k = (t * 0.7) % 1;
      ctx.strokeStyle = `rgba(150, 210, 230, ${0.5 * (1 - k)})`;
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

const HEART_GEM = ['..rr.rr..', '.rRRrRRr.', 'rRWRRRRRr', 'rRRRRRRRr', '.rRRRRRr.', '..rRRRr..', '...rRr...', '....r....'];

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
    glow.addColorStop(0, `rgba(255, 80, 80, ${0.45 + pulse * 0.25})`);
    glow.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(px - 8, py - 8, TILE + 16, TILE + 16);
    ctx.globalCompositeOperation = 'source-over';
    const pal = { r: '#7a0f1a', R: pulse > 0.6 ? '#ff3a44' : '#d8202c', W: '#ffd0d0' };
    const ox = px + (TILE - 9 * PX) / 2;
    const oy = py + (TILE - 8 * PX) / 2 - (pulse > 0.75 ? 1 : 0);
    HEART_GEM.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i] as string;
        if (ch === '.') continue;
        ctx.fillStyle = pal[ch as 'r' | 'R' | 'W'];
        ctx.fillRect(ox + i * PX, oy + j * PX, PX, PX);
      }
    });
  } else if (tile === Tile.Portal) {
    // Three arms of violet motes winding into the dark.
    ctx.globalCompositeOperation = 'lighter';
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    const spin = reduced ? 0 : t * 1.6;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    core.addColorStop(0, 'rgba(190, 140, 255, 0.55)');
    core.addColorStop(1, 'rgba(90, 40, 160, 0)');
    ctx.fillStyle = core;
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
    for (let arm = 0; arm < 3; arm++) {
      for (let k = 0; k < 8; k++) {
        const r = 0.6 + k * 0.62;
        const a = spin + arm * ((Math.PI * 2) / 3) + k * 0.55;
        const mx = Math.round((cx + Math.cos(a) * r * PX) / PX) * PX;
        const my = Math.round((cy + Math.sin(a) * r * PX) / PX) * PX;
        ctx.fillStyle = k < 2 ? '#e8d0ff' : k < 4 ? '#a070ff' : '#5a30a0';
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
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(px + lx * PX, py + (ly - 1) * PX, PX, 3 * PX);
      ctx.fillRect(px + (lx - 1) * PX, py + ly * PX, 3 * PX, PX);
      ctx.globalAlpha = 1;
    }
  } else if (tile === Tile.Gate) {
    const shimmer = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.3 + x);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(150, 175, 220, ${0.12 + shimmer * 0.08})`;
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
    ctx.fillStyle = i % 3 === 0 ? ROCK_LIT[1] as string : i % 3 === 1 ? ROCK[2] as string : ROCK_CRACK;
    ctx.fillRect(px + rx * PX, py + ry * PX, (1 + (i % 2)) * PX, PX);
  }
  ctx.globalAlpha = 1;
}

export { isWalkable, isRoom };
