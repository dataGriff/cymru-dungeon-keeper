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
