/**
 * Tokens are the only place a colour is written down. These tests keep the
 * generated stylesheet in step with tokens.ts, keep literals out of the
 * renderer, the UI and the component stylesheets, and check that every
 * custom property a stylesheet reads exists.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alpha, contrast, hexOf, mixHex, rgbOf } from './color';
import { tokensCss } from './css';
import { board, ui } from './tokens';

const ROOT = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

function filesUnder(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel, ext));
    else if (name.endsWith(ext) && !name.endsWith('.test.ts')) out.push(rel);
  }
  return out;
}

/** A colour written as a literal: #rgb..#rrggbbaa, rgb(1…, rgba(1…, hsl(…. */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|hsla?\(/;

/** Comments and data: URLs may mention anything. */
const strip = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/url\("data:[^"]*"\)/g, 'url()');

describe('design tokens', () => {
  it('tokens.css is generated from tokens.ts (run `task tokens` after editing tokens)', () => {
    expect(read('src/styles/tokens.css')).toBe(tokensCss());
  });

  it('every colour token is a lowercase #rrggbb', () => {
    const bad: string[] = [];
    const walk = (path: string, v: unknown): void => {
      if (typeof v === 'string') {
        if (!/^#[0-9a-f]{6}$/.test(v)) bad.push(`${path} = ${v}`);
      } else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(`${path}.${k}`, c);
    };
    walk('ui', ui);
    walk('board', board);
    expect(bad).toEqual([]);
  });

  it('no colour literals in src/render, src/ui, main.ts or the component stylesheets', () => {
    const files = [
      ...filesUnder('src/render', '.ts'),
      ...filesUnder('src/ui', '.ts'),
      'src/main.ts',
      ...filesUnder('src/styles', '.css').filter((f) => !f.endsWith('tokens.css')),
    ];
    const hits: string[] = [];
    for (const f of files) {
      strip(read(f))
        .split('\n')
        .forEach((line, i) => {
          if (LITERAL.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it('every var(--name) a stylesheet reads is defined in tokens.css', () => {
    const defined = new Set([...read('src/styles/tokens.css').matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
    const missing: string[] = [];
    for (const f of filesUnder('src/styles', '.css')) {
      for (const m of read(f).matchAll(/var\((--[a-z0-9-]+)/g)) if (!defined.has(m[1])) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it('every interface colour is used by a stylesheet', () => {
    const css = filesUnder('src/styles', '.css')
      .filter((f) => !f.endsWith('tokens.css'))
      .map(read)
      .join('\n');
    const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    const unused = Object.keys(ui).filter((k) => !new RegExp(`var\\(--${kebab(k)}(-rgb)?\\)`).test(css));
    expect(unused).toEqual([]);
  });

  it('no component knows which theme is on: only tokens.css reads data-theme', () => {
    const files = [...filesUnder('src/styles', '.css').filter((f) => !f.endsWith('tokens.css')), ...filesUnder('src/ui', '.ts'), ...filesUnder('src/render', '.ts')];
    expect(files.filter((f) => /data-theme|dataset\[?'?\.?theme/.test(read(f)))).toEqual([]);
  });

  it('the stylesheet declares its layers in order before anything else', () => {
    const css = read('src/styles/tokens.css');
    const first = css.split('\n').find((l) => l.startsWith('@'));
    expect(first).toBe('@layer tokens, base, layout, components, screens, utilities;');
    expect(read('src/styles/index.css').indexOf("@import './tokens.css'")).toBeLessThan(read('src/styles/index.css').indexOf("@import './base.css'"));
  });
});

describe('colour helpers', () => {
  it('round-trips hex and rgb', () => {
    expect(rgbOf('#ff7a1f')).toEqual([255, 122, 31]);
    expect(hexOf(255, 122, 31)).toBe('#ff7a1f');
  });

  it('adds alpha in a form the canvas and the gradient stops accept', () => {
    expect(alpha('#ff4646', 0.95)).toBe('rgba(255, 70, 70, 0.95)');
  });

  it('mixes', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('measures WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
