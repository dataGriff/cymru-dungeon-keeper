import { describe, expect, it } from 'vitest';
import { THEMES, mergeBoard, themeBoard, themeFade, themeLook, themeUi } from './themes';
import { board, fade, ui } from './tokens';
import { tokensCss } from './css';

describe('themes', () => {
  it('the hall is the tokens as they are', () => {
    expect(themeUi('hall')).toEqual(ui);
    expect(themeBoard('hall')).toEqual(board);
    expect(themeFade('hall')).toEqual(fade);
    expect(themeLook('hall')).toEqual({ lightFloor: 0.34, vignette: true, figureWash: 0 });
  });

  it('a theme overrides only what it names, one group deep', () => {
    const merged = mergeBoard({ light: { ambient: '#123456' } });
    expect(merged.light.ambient).toBe('#123456');
    expect(merged.light.heart).toBe(board.light.heart);
    expect(merged.stone).toEqual(board.stone);
  });

  it('the Hunt burns every light one cold colour', () => {
    const { light } = themeBoard('hunt');
    const torches = Object.entries(light).filter(([k]) => !['ambient', 'wash', 'vignette'].includes(k));
    expect(new Set(torches.map(([, c]) => c)).size).toBe(1);
    expect(themeLook('hunt').figureWash).toBeGreaterThan(0);
  });

  it('high contrast lights the hall more and drops the vignette and the fades', () => {
    expect(themeLook('contrast').lightFloor).toBeGreaterThan(themeLook('hall').lightFloor);
    expect(themeLook('contrast').vignette).toBe(false);
    expect(Object.values(themeFade('contrast')).every((f) => f === 1)).toBe(true);
  });

  it('every theme with interface overrides gets a block in tokens.css', () => {
    const css = tokensCss();
    for (const [name, t] of Object.entries(THEMES)) if ('ui' in t) expect(css).toContain(`:root[data-theme='${name}']`);
  });
});
