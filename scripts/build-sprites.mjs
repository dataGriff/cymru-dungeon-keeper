#!/usr/bin/env node
/**
 * Render art/figures.json into public/sprites.png: one row per beast, one
 * column per frame, each cell 12x14 logical pixels at SCALE. No dependencies:
 * the PNG is written by hand (zlib from node). Frames are derived from the
 * base figure by small rules so the sheet stays editable as data; replace
 * the rules (or the PNG) with hand-drawn frames later without touching the
 * game, which only reads the layout from art/figures.json.
 *
 *   node scripts/build-sprites.mjs      # or: task sprites
 */
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(readFileSync(join(here, '..', 'art', 'figures.json'), 'utf8'));
const SCALE = 2; // logical pixel -> sheet pixel
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
const INK = [11, 10, 18];

function put(sx, sy, color, alpha = 255) {
  if (sx < 0 || sy < 0 || sx >= sheetW || sy >= sheetH) return;
  const i = (sy * sheetW + sx) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = alpha;
}

/** Frame rules: return the rects to draw (possibly moved) and a y offset. */
function frameRects(rects, frame) {
  const legs = rects.filter((r) => r[1] >= 10); // anything in the bottom four rows walks
  const body = rects.filter((r) => r[1] < 10);
  switch (frame) {
    case 'walk1':
      return { dy: 0, rects: [...body, ...legs.map((r, i) => (i % 2 === 0 ? [r[0], r[1], r[2], Math.max(1, r[3] - 1), r[4]] : r))] };
    case 'walk2':
      return { dy: -1, rects };
    case 'walk3':
      return { dy: 0, rects: [...body, ...legs.map((r, i) => (i % 2 === 1 ? [r[0], r[1], r[2], Math.max(1, r[3] - 1), r[4]] : r))] };
    case 'walk4':
      return { dy: -1, rects };
    case 'attack': {
      // Lunge: everything shifts one pixel forward; the rightmost column (weapon or jaw) two.
      const maxX = Math.max(...rects.map((r) => r[0] + r[2]));
      return { dy: 0, rects: rects.map((r) => [r[0] + (r[0] + r[2] >= maxX - 1 ? 2 : 1), r[1], r[2], r[3], r[4]]) };
    }
    case 'sleep':
      // Lower and squashed: head drops two rows.
      return { dy: 2, rects: rects.map((r) => (r[1] < 5 ? [r[0], r[1] + 2, r[2], r[3], r[4]] : r)) };
    case 'eat':
      return { dy: 0, rects: rects.map((r) => (r[1] < 5 ? [r[0] + 1, r[1] + 1, r[2], r[3], r[4]] : r)) };
    case 'dead':
      // Flat on the floor: rotate the figure onto its back, compressed into the bottom rows.
      return { dy: 0, rects: rects.map((r) => [Math.min(W - 1, Math.floor(r[1] * (W / H))), H - 1 - Math.floor(r[0] / 3) - 1, Math.max(1, Math.round(r[3] * (W / H))), 1, r[4]]) };
    default:
      return { dy: 0, rects };
  }
}

kinds.forEach((kind, row) => {
  frames.forEach((frame, col) => {
    const { dy, rects } = frameRects(src.figures[kind], frame);
    for (const [x, y, w, h, c] of rects) {
      const color = hex(src.palette[c] ?? '#ff00ff');
      for (let py = 0; py < h * SCALE; py++) {
        for (let px = 0; px < w * SCALE; px++) {
          const sx = col * cellW + x * SCALE + px;
          const sy = row * cellH + (y + dy) * SCALE + py;
          if (sy < row * cellH || sy >= (row + 1) * cellH) continue;
          put(sx, sy, frame === 'dead' ? color.map((v, i) => Math.round(v * 0.6 + INK[i] * 0.4)) : color);
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
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
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
const layout = { scale: SCALE, cellW, cellH, frames, kinds };
writeFileSync(join(here, '..', 'public', 'sprites.json'), JSON.stringify(layout));
console.log(`wrote public/sprites.png ${sheetW}x${sheetH} (${kinds.length} kinds x ${frames.length} frames) and public/sprites.json`);
