/**
 * Themes are token overrides: a theme names only what it changes. The UI
 * part becomes a `:root[data-theme=...]` block in the generated tokens.css;
 * the board part is merged over `board` by the renderer. Switching theme is
 * setting `data-theme` on <html> and telling the board; no component code
 * knows which theme is on.
 */
import { board, fade, ui } from './tokens.ts';

type Widen<T> = { -readonly [K in keyof T]?: T[K] extends readonly unknown[] ? readonly string[] : T[K] extends string ? string : Widen<T[K]> };

export interface Theme {
  label: string;
  ui?: Partial<Record<keyof typeof ui, string>>;
  board?: Widen<typeof board>;
  fade?: Partial<Record<keyof typeof fade, number>>;
  /** The least light a creature stands in (0..1): raise it and nothing hides in the dark. Default 0.34. */
  lightFloor?: number;
  /** Darken the board's edges. Default on. */
  vignette?: boolean;
  /** How strongly creatures take the board's `huntWash` colour, 0..1. Default 0. */
  figureWash?: number;
}

/** Every light in the hall burning one colour. */
const allLights = (c: string): Widen<typeof board>['light'] => ({
  heart: c,
  portal: c,
  gate: c,
  lair: c,
  hatchery: c,
  treasury: c,
  pool: c,
  coblyn: c,
  mortal: c,
  pwca: c,
  teg: c,
});

export const THEMES = {
  /** The default: torchlight in a violet dark. */
  hall: { label: 'The hall' },

  /** Brighter dark, stronger text and outlines, no vignette, nothing faded. AAA for all text. */
  contrast: {
    label: 'High contrast',
    ui: {
      textDim: '#ece4d4',
      textFaint: '#ddd3e6',
      accent: '#ffa45c',
      accentDim: '#e07a2a',
      danger: '#ff9a90',
      line: '#5a4c70',
      lineFaint: '#4a3e5e',
      lineControl: '#8a78a6',
      lineStrong: '#a090bc',
      inkSoft: '#3a2a1a',
    },
    fade: { log: 1, logRecent: 1, unseen: 1 },
    board: {
      light: { ambient: '#7a6a92' },
    },
    lightFloor: 0.6,
    vignette: false,
  },

  /** The finale of the last level: the Hunt is home, every torch burns white and the hall goes cold. */
  hunt: {
    label: 'The Hunt',
    ui: {
      bgGlowWarm: '#0c1322',
      accent: '#9ecbff',
      accentDim: '#4a6a9a',
      surfaceActive: '#1a2234',
      surfaceActiveLow: '#141a28',
    },
    board: {
      light: { ambient: '#46546e', wash: '#9ecbff', ...allLights('#e6f0ff') },
    },
    figureWash: 0.12,
  },
} satisfies Record<string, Theme>;

/** What the player can pick in Settings; the Hunt arrives on its own. */
export const PICKABLE: readonly ThemeName[] = ['hall', 'contrast'];

export type ThemeName = keyof typeof THEMES;

const themeOf = (name: string): Theme | undefined => (THEMES as Record<string, Theme>)[name];

/** The interface colours with a theme applied. */
export function themeUi(name: string): Record<keyof typeof ui, string> {
  return { ...ui, ...themeOf(name)?.ui };
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
  return mergeBoard(themeOf(name)?.board);
}

/** A board colour by path ('hp.good'). */
export function boardColor(colors: typeof board, path: string): string {
  const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], colors);
  if (typeof v !== 'string') throw new Error(`no board colour ${path}`);
  return v;
}

/** The fades with a theme applied. */
export function themeFade(name: string): Record<keyof typeof fade, number> {
  return { ...fade, ...themeOf(name)?.fade };
}

/** The board's non-colour look under a theme. */
export function themeLook(name: string): { lightFloor: number; vignette: boolean; figureWash: number } {
  const t = themeOf(name);
  return { lightFloor: t?.lightFloor ?? 0.34, vignette: t?.vignette ?? true, figureWash: t?.figureWash ?? 0 };
}
