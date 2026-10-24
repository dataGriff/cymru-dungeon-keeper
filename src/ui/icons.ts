/**
 * Pixel icons for the toolbar and HUD. The art lives in art/pixels.json
 * (icon.*, plus the engines and the Heart, which the toolbar and HUD share
 * with the board); this module only puts a map on a crisp little canvas.
 */
import { type PixelName, drawPixels, mapSize } from '../render/pixels';
import { crispSize } from '../render/scale';

export const ICON_NAMES = [
  'hand',
  'dig',
  'lair',
  'hatchery',
  'treasury',
  'pool',
  'pause',
  'play',
  'restart',
  'horn',
  'coin',
  'heart',
  'wave',
  'paw',
  'vault',
  'floor',
  'pit',
  'boulder',
  'snare',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Which map draws each icon. */
export function iconMap(name: IconName): PixelName {
  if (name === 'heart') return 'gem.heart';
  if (name === 'pit' || name === 'boulder' || name === 'snare') return `engine.${name}`;
  return `icon.${name}`;
}

/** A crisp little canvas showing the icon at a whole-number scale. */
export function iconCanvas(name: IconName, scale: 1 | 2 | 3 | 4 = 2, label = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'pixel-icon';
  if (label) c.setAttribute('aria-label', label);
  else c.setAttribute('aria-hidden', 'true');
  setIcon(c, name, scale);
  return c;
}

/** Repaint an existing icon canvas with a different icon (e.g. pause and play). */
export function setIcon(c: HTMLCanvasElement, name: IconName, scale: 1 | 2 | 3 | 4 = 2): void {
  const map = iconMap(name);
  const { w, h } = mapSize(map);
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const dpr = window.devicePixelRatio || 1;
  c.style.width = `${crispSize(c.width, scale, c.width, dpr)}px`;
  c.style.height = `${crispSize(c.height, scale, c.height, dpr)}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  drawPixels(ctx, map, 0, 0, scale);
}
