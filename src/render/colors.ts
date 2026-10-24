/**
 * The board's colours and look, as the renderer reads them: the `board`
 * tokens with the current theme merged in. `setBoardTheme` writes into
 * these objects and bumps `colorsVersion`, so caches (the static tile
 * layer) know to repaint.
 */
import { themeBoard, themeLook } from '../design/themes';
import { board } from '../design/tokens';

/** The tokens' shape with any colour allowed (tuples stay tuples). */
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

export type BoardColors = Widen<typeof board>;

/** The colours in use. */
export const B: BoardColors = structuredClone(board) as BoardColors;
/** The rest of the theme: the light floor, the vignette, the wash on figures. */
export const look = themeLook('hall');

let theme = 'hall';
let version = 0;

/** Bumped whenever the colours change. */
export function colorsVersion(): number {
  return version;
}

export function boardTheme(): string {
  return theme;
}

/** Switch the board to a theme (see src/design/themes.ts). Cheap when nothing changes. */
export function setBoardTheme(name: string): void {
  if (name === theme) return;
  theme = name;
  Object.assign(B, themeBoard(name));
  Object.assign(look, themeLook(name));
  version++;
}
