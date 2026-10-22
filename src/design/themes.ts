/**
 * Themes are token overrides: a theme names only what it changes. The UI
 * part becomes a `:root[data-theme=...]` block in the generated tokens.css;
 * the board part is merged over `board` by the renderer. Switching theme is
 * setting `data-theme` on <html> and telling the board; no component code
 * knows which theme is on.
 */
import { board, ui } from './tokens.ts';

type Widen<T> = { -readonly [K in keyof T]?: T[K] extends readonly unknown[] ? readonly string[] : T[K] extends string ? string : Widen<T[K]> };

export interface Theme {
  label: string;
  ui?: Partial<Record<keyof typeof ui, string>>;
  board?: Widen<typeof board>;
  /** Light the hall more evenly: the board raises its floor of light and drops the vignette. */
  lightFloor?: number;
  vignette?: boolean;
}

export const THEMES: Record<string, Theme> = {
  hall: { label: 'The hall' },
};

export type ThemeName = keyof typeof THEMES;

/** The interface colours with a theme applied. */
export function themeUi(name: string): Record<keyof typeof ui, string> {
  return { ...ui, ...THEMES[name]?.ui };
}

/** `board` with one level of overrides merged in (a group's keys replace the base's, the rest stay). */
export function mergeBoard(overrides: Theme['board'] = {}): typeof board {
  const next = structuredClone(board) as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    const base = next[k];
    next[k] = typeof v === 'object' && !Array.isArray(v) && typeof base === 'object' && !Array.isArray(base) ? { ...base, ...v } : v;
  }
  return next as typeof board;
}

/** The board colours with a theme applied. */
export function themeBoard(name: string): typeof board {
  return mergeBoard(THEMES[name]?.board);
}

/** A board colour by path ('hp.good'). */
export function boardColor(colors: typeof board, path: string): string {
  const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], colors);
  if (typeof v !== 'string') throw new Error(`no board colour ${path}`);
  return v;
}
