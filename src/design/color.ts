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

// ---------------------------------------------------------------- colour vision

export type Cvd = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Machado, Oliveira and Fernandes (2009), severity 1, on linear RGB. */
const CVD: Record<Cvd, readonly number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const fromLinear = (v: number): number => {
  const c = Math.max(0, Math.min(1, v));
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
};

/** How `hex` looks to someone with the given colour-vision deficiency. */
export function simulateCvd(hex: string, kind: Cvd): string {
  const [r, g, b] = rgbOf(hex).map(toLinear) as [number, number, number];
  const m = CVD[kind];
  const at = (i: number): number => m[i] ?? 0;
  return hexOf(
    fromLinear(at(0) * r + at(1) * g + at(2) * b),
    fromLinear(at(3) * r + at(4) * g + at(5) * b),
    fromLinear(at(6) * r + at(7) * g + at(8) * b),
  );
}

/** CIE L*a*b* (D65). */
export function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgbOf(hex).map(toLinear) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference: about 2.3 is just noticeable; 20 or more reads as a different colour at a glance. */
export function deltaE(a: string, b: string): number {
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
