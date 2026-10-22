/**
 * Pixel icons for the toolbar and HUD. The art lives in art/pixels.json
 * (icon.*, plus the engines and the Heart, which the toolbar and HUD share
 * with the board); this module only puts a map on a crisp little canvas.
 */
import { type PixelName, drawPixels, mapSize } from '../render/pixels';

export type IconName =
  | 'hand'
  | 'dig'
  | 'lair'
  | 'hatchery'
  | 'treasury'
  | 'pool'
  | 'pause'
  | 'play'
  | 'restart'
  | 'horn'
  | 'coin'
  | 'heart'
  | 'wave'
  | 'paw'
  | 'vault'
  | 'floor'
  | 'pit'
  | 'boulder'
  | 'snare';

/** Which map draws each icon. */
export function iconMap(name: IconName): PixelName {
  if (name === 'heart') return 'gem.heart';
  if (name === 'pit' || name === 'boulder' || name === 'snare') return `engine.${name}`;
  return `icon.${name}`;
}

/** A crisp little canvas showing the icon at an integer scale. */
export function iconCanvas(name: IconName, scale = 2, label = ''): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'pixel-icon';
  if (label) c.setAttribute('aria-label', label);
  else c.setAttribute('aria-hidden', 'true');
  setIcon(c, name, scale);
  return c;
}

/** Repaint an existing icon canvas with a different icon (e.g. pause and play). */
export function setIcon(c: HTMLCanvasElement, name: IconName, scale = 2): void {
  const map = iconMap(name);
  const { w, h } = mapSize(map);
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  c.style.width = `${c.width}px`;
  c.style.height = `${c.height}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  drawPixels(ctx, map, 0, 0, scale);
}
