/**
 * Shared reader for art/pixels.json in the build scripts (box, manual).
 * src/render/pixels.ts mirrors this for the game.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAPS = JSON.parse(readFileSync(join(root, 'art', 'pixels.json'), 'utf8')).maps;

export function pixelMap(name) {
  const m = MAPS[name];
  if (!m) throw new Error(`no pixel map called ${name} in art/pixels.json`);
  return m;
}

export function paletteOf(name, { variant, color } = {}) {
  const m = pixelMap(name);
  const base = { ...m.palette, ...(variant ? (m.variants?.[variant] ?? {}) : {}) };
  if (color) for (const k of Object.keys(base)) base[k] = color;
  return base;
}
