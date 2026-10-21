#!/usr/bin/env node
/**
 * Bake art/figures.json into public/sprites.png: one row per beast, one
 * column per frame, each cell 16x16 logical pixels at SCALE. No dependencies:
 * the PNG is written by hand (zlib from node). Frames are derived from the
 * base figure by small pixel rules (a stride, a bob, a lunge, a crouch, a
 * fall) so the sheet stays editable as data; a hand-drawn sheet in the same
 * layout can replace the PNG without touching the game.
 *
 *   node scripts/build-sprites.mjs      # or: task sprites
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureGrid, loadFigures, outlined } from './lib/figures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = loadFigures();
const SCALE = 2;
const W = src.width;
const H = src.height;
const frames = src.frames;
const kinds = Object.keys(src.figures);
const cellW = W * SCALE;
const cellH = H * SCALE;
const sheetW = cellW * frames.length;
const sheetH = cellH * kinds.length;
const rgba = new Uint8Array(sheetW * sheetH * 4);

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const INK = hex(src.outline);
const empty = () => Array.from({ length: H }, () => Array(W).fill(null));
const LEG_ROW = 12;

/** Copy pixels of `grid` into a fresh grid through `map(x, y) -> [x, y] | null`. */
function remap(grid, map) {
  const out = empty();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c === null) continue;
      const to = map(x, y);
      if (!to) continue;
      const [nx, ny] = to;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out[ny][nx] = c;
    }
  }
  return out;
}

/** The figure's horizontal centre, from its feet. */
function feetCentre(grid) {
  const xs = [];
  for (let y = LEG_ROW; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] !== null) xs.push(x);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : W / 2;
}

function frontEdge(grid) {
  let max = 0;
  for (let y = 0; y < LEG_ROW; y++) for (let x = 0; x < W; x++) if (grid[y][x] !== null) max = Math.max(max, x);
  return max;
}

function derive(grid, frame) {
  const cx = feetCentre(grid);
  switch (frame) {
    case 'walk1': // back legs lift
      return remap(grid, (x, y) => (y >= LEG_ROW && x < cx ? [x, y - 1] : [x, y]));
    case 'walk2':
    case 'walk4': // the whole body bobs
      return remap(grid, (x, y) => [x, y - 1]);
    case 'walk3': // front legs lift
      return remap(grid, (x, y) => (y >= LEG_ROW && x >= cx ? [x, y - 1] : [x, y]));
    case 'attack': {
      // Lunge: the body forward a pixel, the leading edge (weapon, jaw) two.
      const front = frontEdge(grid);
      return remap(grid, (x, y) => (y < LEG_ROW ? [x + (x >= front - 2 ? 2 : 1), y] : [x, y]));
    }
    case 'sleep':
      // Curled: everything down two, the head a third, the feet tucked.
      return remap(grid, (x, y) => (y >= H - 2 ? null : [x, y + (y < 7 ? 3 : 2)]));
    case 'eat':
      // Head down and forward.
      return remap(grid, (x, y) => (y < 8 ? [x + 1, y + 1] : [x, y]));
    case 'dead': {
      // Upright figures fall a quarter turn; long four-legged ones roll onto their backs.
      let minBX = W;
      let maxBX = 0;
      let minBY = H;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] !== null) {
        minBX = Math.min(minBX, x);
        maxBX = Math.max(maxBX, x);
        minBY = Math.min(minBY, y);
      }
      const long = maxBX - minBX + 1 > H - minBY;
      const rot = long ? remap(grid, (x, y) => [x, H - 1 - y]) : remap(grid, (x, y) => [H - 1 - y, x]);
      let lowest = 0;
      let minX = W;
      let maxX = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rot[y][x] !== null) {
        lowest = Math.max(lowest, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      const dx = Math.round((W - 1 - maxX - minX) / 2);
      const moved = remap(rot, (x, y) => [x + dx, y + (H - 1 - lowest)]);
      // Faded towards ink.
      return moved.map((row) => row.map((c) => (c === null ? null : `#${hex(c).map((v, i) => Math.round(v * 0.55 + INK[i] * 0.45).toString(16).padStart(2, '0')).join('')}`)));
    }
    default:
      return grid;
  }
}

kinds.forEach((kind, row) => {
  const base = figureGrid(src, kind);
  frames.forEach((frame, col) => {
    const grid = outlined(derive(base, frame), src.outline);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = grid[y][x];
        if (c === null) continue;
        const [r, g, b] = hex(c);
        for (let py = 0; py < SCALE; py++) {
          for (let px = 0; px < SCALE; px++) {
            const sx = col * cellW + x * SCALE + px;
            const sy = row * cellH + y * SCALE + py;
            const i = (sy * sheetW + sx) * 4;
            rgba[i] = r;
            rgba[i + 1] = g;
            rgba[i + 2] = b;
            rgba[i + 3] = 255;
          }
        }
      }
    }
  });
});

// ---- PNG ----
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(sheetW, 0);
ihdr.writeUInt32BE(sheetH, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const raw = Buffer.alloc((sheetW * 4 + 1) * sheetH);
for (let y = 0; y < sheetH; y++) {
  raw[y * (sheetW * 4 + 1)] = 0;
  Buffer.from(rgba.buffer, y * sheetW * 4, sheetW * 4).copy(raw, y * (sheetW * 4 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync(join(here, '..', 'public'), { recursive: true });
writeFileSync(join(here, '..', 'public', 'sprites.png'), png);
writeFileSync(join(here, '..', 'public', 'sprites.json'), JSON.stringify({ scale: SCALE, cellW, cellH, frames, kinds }));
console.log(`wrote public/sprites.png ${sheetW}x${sheetH} (${kinds.length} kinds x ${frames.length} frames) and public/sprites.json`);
