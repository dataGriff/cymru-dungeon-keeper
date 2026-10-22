/**
 * The faces are served from art/fonts with their licences, nothing asks a
 * font CDN for them, and each fallback is scaled to stand in for its face.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACES, fallbackAdjust } from './fonts';
import { type } from './tokens';

const ROOT = join(__dirname, '..', '..');

function filesUnder(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [dir];
  return readdirSync(abs).flatMap((n) => filesUnder(join(dir, n)));
}

describe('fonts', () => {
  it('every face file is in art/fonts, beside its OFL licence', () => {
    for (const face of FACES) {
      for (const f of face.files) {
        const dir = join(ROOT, 'art', 'fonts', f.dir ?? face.dir);
        expect(readFileSync(join(dir, 'OFL.txt'), 'utf8')).toContain('SIL Open Font License, Version 1.1');
        const bytes = readFileSync(join(dir, f.file));
        expect(bytes.subarray(0, 4).toString('latin1'), f.file).toBe('wOF2');
      }
    }
  });

  it('every family in the type tokens has a face and a fallback, in that order', () => {
    for (const stack of Object.values(type.family)) {
      const first = stack.split(',')[0]?.trim().replace(/'/g, '');
      const face = FACES.find((f) => f.family === first);
      expect(face, stack).toBeDefined();
      expect(stack).toContain(`'${first} Fallback'`);
    }
  });

  it('the stylesheet declares each face with font-display: swap', () => {
    const css = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
    for (const face of FACES) {
      for (const f of face.files) expect(css).toContain(`${f.dir ?? face.dir}/${f.file}`);
      expect(css).toContain(`font-family: '${face.family} Fallback'`);
    }
    const faces = css.match(/@font-face \{[^}]*\}/g) ?? [];
    for (const block of faces.filter((b) => b.includes('url('))) expect(block).toContain('font-display: swap');
  });

  it('a scaled fallback is as wide and as tall as its face', () => {
    for (const face of FACES) {
      const a = fallbackAdjust(face);
      const f = face.fallback.metrics;
      const m = face.metrics;
      expect((f.avgWidth / f.unitsPerEm) * a.sizeAdjust).toBeCloseTo(m.avgWidth / m.unitsPerEm, 6);
      expect((a.ascent + a.descent + a.lineGap) * a.sizeAdjust).toBeCloseTo((m.ascent - m.descent + m.lineGap) / m.unitsPerEm, 6);
    }
  });

  it('nothing asks a font CDN for anything', () => {
    const files = [
      'index.html',
      'src-tauri/tauri.conf.json',
      ...filesUnder('src'),
      ...filesUnder('scripts'),
      ...filesUnder('public'),
      ...filesUnder('docs/box').filter((f) => f.endsWith('.svg') || f.endsWith('.html')),
    ].filter((f) => !f.endsWith('.test.ts') && !/\.(png|woff2?|pdf)$/.test(f));
    const hits = files.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});
