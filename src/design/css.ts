/**
 * Tokens to CSS. `tokensCss()` renders src/styles/tokens.css; the build
 * script writes it and a test checks the committed file matches, so the
 * stylesheet can never drift from src/design/tokens.ts.
 */
import { rgbOf } from './color.ts';
import { fontFaceCss } from './fonts.ts';
import { fade, motion, shadow, size, space, type, ui, z } from './tokens.ts';
import { THEMES, type Theme } from './themes.ts';

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/(\d+)/g, '-$1').replace(/--/g, '-');

/** A colour as a custom property, plus an `-rgb` triplet so CSS can add alpha: rgb(var(--accent-rgb) / 0.3). */
function colourVars(colours: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(colours)) {
    out.push(`--${kebab(k)}: ${v};`);
    out.push(`--${kebab(k)}-rgb: ${rgbOf(v).join(' ')};`);
  }
  return out;
}

/** Every custom property for the base theme. */
export function baseVars(): string[] {
  const v: string[] = [...colourVars(ui)];
  for (const [k, f] of Object.entries(type.family)) v.push(`--font-${kebab(k)}: ${f};`);
  for (const [k, s] of Object.entries(type.size)) v.push(`--fs-${kebab(k)}: ${s}px;`);
  for (const [k, l] of Object.entries(type.leading)) v.push(`--lh-${kebab(k)}: ${l};`);
  for (const [k, t] of Object.entries(type.tracking)) v.push(`--tr-${kebab(k)}: ${t};`);
  for (const [k, s] of Object.entries(space)) v.push(`--sp-${k}: ${s}px;`);
  for (const [k, s] of Object.entries(size)) v.push(`--w-${kebab(k)}: ${s}px;`);
  for (const [k, n] of Object.entries(z)) v.push(`--z-${kebab(k)}: ${n};`);
  for (const [k, d] of Object.entries(motion)) v.push(`--dur-${kebab(k)}: ${d}ms;`);
  for (const [k, s] of Object.entries(shadow)) v.push(`--shadow-${kebab(k)}: ${s};`);
  for (const [k, f] of Object.entries(fade)) v.push(`--fade-${kebab(k)}: ${f};`);
  return v;
}

function themeBlock(name: string, theme: Theme): string {
  const vars = [...colourVars(theme.ui ?? {}), ...Object.entries(theme.fade ?? {}).map(([k, f]) => `--fade-${kebab(k)}: ${f};`)];
  if (vars.length === 0) return '';
  return `:root[data-theme='${name}'] {\n${vars.map((l) => `  ${l}`).join('\n')}\n}\n`;
}

export function tokensCss(): string {
  const header = `/* Generated from src/design/tokens.ts, themes.ts and fonts.ts by \`task tokens\`. Do not edit by hand. */\n\n`;
  const layers = `@layer tokens, base, layout, components, screens, utilities;\n\n`;
  const root = `@layer tokens {\n:root {\n  color-scheme: dark;\n${baseVars()
    .map((l) => `  ${l}`)
    .join('\n')}\n}\n\n${Object.entries(THEMES)
    .map(([n, t]) => themeBlock(n, t))
    .filter(Boolean)
    .join('\n')}}\n`;
  const fonts = `${fontFaceCss('../../art/fonts')}\n\n`;
  return header + layers + fonts + root;
}
