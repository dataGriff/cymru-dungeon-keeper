/**
 * The game's reader for art/pixels.json: every hand-drawn pixel map that is
 * not a creature (icons, engines, the Heart, tile stamps, glyphs). Names are
 * typed from the JSON, so a missing map is a compile error, not a blank.
 * scripts/lib/pixels.mjs mirrors this for the box and manual builders.
 */
import pixelsJson from '../../art/pixels.json';
import { B } from './colors';

export interface PixelMap {
  note?: string;
  palette: Record<string, string>;
  rows: string[];
  /** Palette overrides drawn from the same rows (e.g. the Heart's beat). */
  variants?: Record<string, Record<string, string>>;
}

export type PixelName = keyof typeof pixelsJson.maps;

const MAPS = (pixelsJson as unknown as { maps: Record<PixelName, PixelMap> }).maps;

export function pixelMap(name: PixelName): PixelMap {
  return MAPS[name];
}

export const pixelNames = (): PixelName[] => Object.keys(MAPS) as PixelName[];

export interface PixelOptions {
  /** A named variant's palette overrides. */
  variant?: string;
  /** Paint every key in one colour (glyphs take the colour of their meaning). */
  color?: string;
}

/** The palette a map is drawn with, after a variant or a recolour. */
export function paletteOf(name: PixelName, opts: PixelOptions = {}): Record<string, string> {
  const m = MAPS[name];
  const base = { ...m.palette, ...(opts.variant ? (m.variants?.[opts.variant] ?? {}) : {}) };
  if (opts.color) for (const k of Object.keys(base)) base[k] = opts.color;
  return base;
}

/** Width and height in logical pixels. */
export function mapSize(name: PixelName): { w: number; h: number } {
  const m = MAPS[name];
  return { w: m.rows[0]?.length ?? 0, h: m.rows.length };
}

/** Draw rows of palette keys ('.' transparent) at `px` per pixel from a top-left corner, as horizontal runs. */
export function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  x0: number,
  y0: number,
  px: number,
): void {
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? '.';
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      ctx.fillStyle = palette[ch] ?? B.missing;
      ctx.fillRect(Math.round(x0 + x * px), Math.round(y0 + y * px), (end - x) * px, px);
      x = end;
    }
  });
}

/** Draw a named map. */
export function drawPixels(ctx: CanvasRenderingContext2D, name: PixelName, x0: number, y0: number, px: number, opts: PixelOptions = {}): void {
  drawPixelMap(ctx, MAPS[name].rows, paletteOf(name, opts), x0, y0, px);
}
