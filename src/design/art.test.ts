/**
 * Every hand-drawn asset is data in art/: creatures in figures.json, every
 * other pixel map in pixels.json. These tests keep that data sound, and keep
 * pixel maps from creeping back into code.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import figures from '../../art/figures.json';
import pixels from '../../art/pixels.json';
import { BESTIARY_ORDER } from '../data/bestiary';

const HEX = /^#[0-9a-f]{6}$/;

interface MapLike {
  palette: Record<string, string>;
  rows: string[];
  variants?: Record<string, Record<string, string>>;
}

function checkMap(name: string, m: MapLike, size?: { w: number; h: number }): string[] {
  const errors: string[] = [];
  const w = m.rows[0]?.length ?? 0;
  if (m.rows.length === 0 || w === 0) errors.push(`${name}: empty`);
  if (size && (w !== size.w || m.rows.length !== size.h)) errors.push(`${name}: ${w}x${m.rows.length}, expected ${size.w}x${size.h}`);
  m.rows.forEach((r, i) => {
    if (r.length !== w) errors.push(`${name} row ${i}: ${r.length} wide, expected ${w}`);
    for (const ch of r) if (ch !== '.' && !(ch in m.palette)) errors.push(`${name} row ${i}: '${ch}' is not in the palette`);
  });
  for (const [k, v] of Object.entries(m.palette)) {
    if (k.length !== 1 || k === '.') errors.push(`${name}: palette key '${k}' must be one character, not '.'`);
    if (!HEX.test(v)) errors.push(`${name}: palette '${k}' is '${v}', not a lowercase #rrggbb`);
  }
  const used = new Set(m.rows.join('').replace(/\./g, ''));
  for (const k of Object.keys(m.palette)) if (!used.has(k)) errors.push(`${name}: palette '${k}' is never used`);
  for (const [vn, over] of Object.entries(m.variants ?? {})) {
    for (const [k, v] of Object.entries(over)) {
      if (!(k in m.palette)) errors.push(`${name} variant ${vn}: '${k}' overrides nothing`);
      if (!HEX.test(v)) errors.push(`${name} variant ${vn}: '${v}' is not a lowercase #rrggbb`);
    }
  }
  return errors;
}

describe('art/figures.json', () => {
  it('has a sound 16x16 figure for every creature and mortal', () => {
    const f = figures as unknown as { width: number; height: number; outline: string; figures: Record<string, MapLike> };
    expect(Object.keys(f.figures).sort()).toEqual([...BESTIARY_ORDER].sort());
    expect(f.outline).toMatch(HEX);
    const errors = Object.entries(f.figures).flatMap(([k, m]) => checkMap(k, m, { w: f.width, h: f.height }));
    expect(errors).toEqual([]);
  });
});

describe('art/pixels.json', () => {
  const maps = (pixels as unknown as { maps: Record<string, MapLike> }).maps;

  it('every map is rectangular, keyed, and uses hex colours', () => {
    expect(Object.entries(maps).flatMap(([k, m]) => checkMap(k, m))).toEqual([]);
  });

  it('names are namespaced (icon., engine., gem., tile., glyph., ...)', () => {
    for (const name of Object.keys(maps)) expect(name).toMatch(/^[a-z]+\.[a-z]+$/);
  });

  it('no two maps draw the same rows', () => {
    const seen = new Map<string, string>();
    for (const [name, m] of Object.entries(maps)) {
      const key = m.rows.join('/');
      expect(seen.get(key), `${name} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, name);
    }
  });
});

describe('no pixel maps in code', () => {
  /** Files under a directory, recursively. */
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });

  /** True if the source holds an array of three or more equal-length strings of map characters with transparency: a pixel map. */
  const hasRowArray = (src: string): boolean => {
    for (const m of src.matchAll(/\[((?:\s*'[^'\n]*',?){3,})\s*\]/g)) {
      const strings = [...(m[1] ?? '').matchAll(/'([^']*)'/g)].map((x) => x[1] ?? '');
      const mapLike = strings.every((t) => /^[A-Za-z.]{3,}$/.test(t)) && strings.some((t) => t.includes('.'));
      if (mapLike && new Set(strings.map((t) => t.length)).size === 1) return true;
    }
    return false;
  };

  it('the detector finds a pixel map and ignores a list of file names', () => {
    expect(hasRowArray("const X = ['.ab.', 'abba', '.bb.'];")).toBe(true);
    expect(hasRowArray("const shots = ['hall.png', 'fight.png', 'manual.png'];")).toBe(false);
  });

  it('src/ and scripts/ hold no row arrays of pixel art', () => {
    const files = [...walk('src'), ...walk('scripts')].filter((f) => /\.(ts|mjs)$/.test(f) && !f.endsWith('.test.ts'));
    expect(files.filter((f) => hasRowArray(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
