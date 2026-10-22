/**
 * The board's colours, as the renderer reads them: the `board` tokens with
 * the current theme's overrides merged in. A theme change writes into this
 * object and bumps `colorsVersion`, so caches (the static tile layer) know
 * to repaint.
 */
import { board } from '../design/tokens';

/** The tokens' shape with any colour allowed (tuples stay tuples). */
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

export type BoardColors = Widen<typeof board>;
export type BoardOverrides = { readonly [K in keyof BoardColors]?: Partial<BoardColors[K]> | BoardColors[K] };

/** The colours in use. Read-only to everything but `setBoardColors`. */
export const B: BoardColors = structuredClone(board) as BoardColors;

let version = 0;
/** Bumped whenever the colours change. */
export function colorsVersion(): number {
  return version;
}

/** Reset to the tokens, then merge one level of overrides (a theme). */
export function setBoardColors(overrides: BoardOverrides = {}): void {
  const next = structuredClone(board) as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    const base = next[k];
    next[k] = typeof v === 'object' && !Array.isArray(v) && typeof base === 'object' && !Array.isArray(base) ? { ...base, ...v } : v;
  }
  Object.assign(B, next);
  version++;
}
