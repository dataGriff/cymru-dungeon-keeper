/** Colour helpers, so code never writes an rgba() by hand. */

const cache = new Map<string, [number, number, number]>();

/** '#rrggbb' to [r, g, b]. */
export function rgbOf(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    cache.set(hex, c);
  }
  return c;
}

export const hexOf = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** A token colour at an opacity: alpha('#ff7a1f', 0.3) is 'rgba(255, 122, 31, 0.3)'. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.max(0, Math.min(1, a)) * 1000) / 1000})`;
}

/** Mix `hex` towards `to` by f (0..1). */
export function mixHex(hex: string, to: string, f: number): string {
  const a = rgbOf(hex);
  const b = rgbOf(to);
  return hexOf(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

/** WCAG relative luminance of '#rrggbb'. */
export function luminance(hex: string): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two '#rrggbb' colours, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
