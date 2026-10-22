/**
 * Legibility, for every theme: text pairs meet WCAG contrast (AAA, 7:1, for
 * all text in the high-contrast theme), and the board's meaningful colours
 * stay apart for normal vision and under simulated colour blindness. The
 * pairs live next to the tokens (textPairs, boardPairs). A failure is fixed
 * in the tokens, never by loosening a pair.
 */
import { describe, expect, it } from 'vitest';
import { type Cvd, contrast, deltaE, mixHex, simulateCvd } from './color';
import { THEMES, boardColor, themeBoard, themeFade, themeUi } from './themes';
import { boardPairs, textPairs } from './tokens';

const CVDS: Cvd[] = ['protanopia', 'deuteranopia', 'tritanopia'];
/** ΔE (CIE76) that reads as a different colour at a glance. */
const DISTINCT = 20;

describe.each(Object.keys(THEMES))('theme %s', (name) => {
  const colors = themeUi(name);
  const fades = themeFade(name);
  const aaa = name === 'contrast';

  it('every text pair meets its contrast ratio', () => {
    const fails: string[] = [];
    for (const p of textPairs) {
      const bg = colors[p.bg];
      const fg = p.fade === undefined ? colors[p.fg] : mixHex(bg, colors[p.fg], fades[p.fade]);
      const min = aaa ? 7 : p.min;
      const ratio = contrast(fg, bg);
      if (ratio < min) fails.push(`${p.fg} on ${p.bg}${p.fade ? ` faded to ${fades[p.fade]}` : ''}: ${ratio.toFixed(2)} < ${min} (${p.use})`);
    }
    expect(fails).toEqual([]);
  });

  it('meaningful board colours stay apart under every colour vision', () => {
    const board = themeBoard(name);
    const fails: string[] = [];
    for (const p of boardPairs) {
      const a = boardColor(board, p.a);
      const b = boardColor(board, p.b);
      if (p.kind === 'ground') {
        const r = contrast(a, b);
        if (r < 3) fails.push(`${p.a} on ${p.b}: ${r.toFixed(2)} < 3 (${p.use})`);
        continue;
      }
      const seen: [string, number][] = [['normal', deltaE(a, b)], ...CVDS.map((k): [string, number] => [k, deltaE(simulateCvd(a, k), simulateCvd(b, k))])];
      for (const [k, d] of seen) if (d < DISTINCT) fails.push(`${p.a} vs ${p.b}, ${k}: ΔE ${d.toFixed(1)} < ${DISTINCT} (${p.use})`);
    }
    expect(fails).toEqual([]);
  });
});

describe('colour-vision simulation', () => {
  it('leaves greys alone and folds red and green together for deuteranopia', () => {
    for (const k of CVDS) expect(deltaE(simulateCvd('#808080', k), '#808080')).toBeLessThan(1);
    const red = simulateCvd('#d03030', 'deuteranopia');
    const green = simulateCvd('#30a030', 'deuteranopia');
    expect(deltaE(red, green)).toBeLessThan(deltaE('#d03030', '#30a030') / 2);
  });
});
