/**
 * Pixel-perfect sizing. Art is drawn on a grid of `PX` canvas pixels; it
 * stays crisp only when each art pixel lands on a whole number of device
 * pixels. These choose CSS sizes that make that true.
 */
import { PX } from './tiles';

/**
 * The CSS width that fits the board into `available` CSS pixels with every
 * art pixel a whole number of device pixels: the largest `k` (device
 * pixels per art pixel) that fits, never below 1 (then the board scrolls).
 */
export function fitBoard(canvasWidth: number, available: number, dpr: number, artPx: number = PX): { k: number; width: number } {
  const art = canvasWidth / artPx;
  const k = Math.max(1, Math.floor((available * dpr) / art + 1e-9));
  return { k, width: (art * k) / dpr };
}

/** The CSS width for a chosen scale (1 = one canvas pixel per CSS pixel), snapped to whole device pixels per art pixel. */
export function fixedBoard(canvasWidth: number, scale: number, dpr: number, artPx: number = PX): { k: number; width: number } {
  const art = canvasWidth / artPx;
  const k = Math.max(1, Math.round(artPx * scale * dpr));
  return { k, width: (art * k) / dpr };
}

/** The CSS size of a small canvas (icon, portrait) so its art pixels are whole device pixels, as near `size` as possible. */
export function crispSize(canvasSize: number, artPx: number, size: number, dpr: number): number {
  const art = canvasSize / artPx;
  const k = Math.max(1, Math.round((size * dpr) / art));
  return (art * k) / dpr;
}
