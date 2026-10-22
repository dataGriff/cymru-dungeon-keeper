/**
 * The three typefaces, served from art/fonts (SIL Open Font License; each
 * family's OFL.txt sits beside its files), and a metric-matched fallback for
 * each so text keeps its size and line breaks while the real face loads
 * (font-display: swap).
 *
 * The fallback is a local font scaled with size-adjust so its average glyph
 * is as wide as the real face's, and with ascent/descent overrides so its
 * lines are as tall. Metrics were read from the woff2 files (hhea table, and
 * the average advance of a-z and space weighted by English letter
 * frequency) and from the system fonts' published metrics.
 */

export interface Metrics {
  unitsPerEm: number;
  ascent: number;
  /** Negative, as in the font. */
  descent: number;
  lineGap: number;
  /** Frequency-weighted average advance of a-z and space. */
  avgWidth: number;
}

export interface FontFile {
  file: string;
  style: 'normal' | 'italic';
  /** Omitted for a file that covers everything the face has. */
  range?: string;
}

export interface Face {
  family: string;
  /** Directory under art/fonts. */
  dir: string;
  files: FontFile[];
  metrics: Metrics;
  /** The local fonts tried for the fallback, in order, and their metrics. */
  fallback: { local: string[]; metrics: Metrics };
}

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
/** Latin Extended: ŵ and ŷ, which Welsh needs (Cŵn Annwn). */
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const GEORGIA: Metrics = { unitsPerEm: 2048, ascent: 1878, descent: -449, lineGap: 0, avgWidth: 913 };
const COURIER_NEW: Metrics = { unitsPerEm: 2048, ascent: 1705, descent: -615, lineGap: 0, avgWidth: 1229 };

export const FACES: Face[] = [
  {
    family: 'Metamorphous',
    dir: 'metamorphous',
    files: [
      { file: 'metamorphous-latin-400-normal.woff2', style: 'normal', range: LATIN },
      { file: 'metamorphous-latin-ext-400-normal.woff2', style: 'normal', range: LATIN_EXT },
    ],
    metrics: { unitsPerEm: 2048, ascent: 1972, descent: -588, lineGap: 0, avgWidth: 1138.2 },
    fallback: { local: ['Georgia', 'Palatino Linotype'], metrics: GEORGIA },
  },
  {
    // IM Fell English has no Latin Extended: a ŵ comes from the fallback.
    family: 'IM Fell English',
    dir: 'im-fell-english',
    files: [
      { file: 'im-fell-english-latin-400-normal.woff2', style: 'normal' },
      { file: 'im-fell-english-latin-400-italic.woff2', style: 'italic' },
    ],
    metrics: { unitsPerEm: 2048, ascent: 1854, descent: -744, lineGap: 0, avgWidth: 831.9 },
    fallback: { local: ['Georgia', 'Palatino Linotype'], metrics: GEORGIA },
  },
  {
    family: 'VT323',
    dir: 'vt323',
    files: [
      { file: 'vt323-latin-400-normal.woff2', style: 'normal', range: LATIN },
      { file: 'vt323-latin-ext-400-normal.woff2', style: 'normal', range: LATIN_EXT },
    ],
    metrics: { unitsPerEm: 1000, ascent: 800, descent: -200, lineGap: 0, avgWidth: 400 },
    fallback: { local: ['Courier New', 'Courier'], metrics: COURIER_NEW },
  },
];

const pct = (n: number): string => `${Math.round(n * 10000) / 100}%`;

/** size-adjust and the vertical overrides that make the fallback stand in for the face. */
export function fallbackAdjust(face: Face): { sizeAdjust: number; ascent: number; descent: number; lineGap: number } {
  const m = face.metrics;
  const f = face.fallback.metrics;
  const sizeAdjust = m.avgWidth / m.unitsPerEm / (f.avgWidth / f.unitsPerEm);
  return {
    sizeAdjust,
    ascent: m.ascent / m.unitsPerEm / sizeAdjust,
    descent: -m.descent / m.unitsPerEm / sizeAdjust,
    lineGap: m.lineGap / m.unitsPerEm / sizeAdjust,
  };
}

/** @font-face rules: the real faces from `base` (a URL prefix for art/fonts), then the fallbacks. */
export function fontFaceCss(base: string): string {
  const out: string[] = [];
  for (const face of FACES) {
    for (const f of face.files) {
      out.push(
        [
          '@font-face {',
          `  font-family: '${face.family}';`,
          `  font-style: ${f.style};`,
          '  font-weight: 400;',
          '  font-display: swap;',
          `  src: url('${base}/${face.dir}/${f.file}') format('woff2');`,
          ...(f.range ? [`  unicode-range: ${f.range};`] : []),
          '}',
        ].join('\n'),
      );
    }
  }
  for (const face of FACES) {
    const a = fallbackAdjust(face);
    out.push(
      [
        '@font-face {',
        `  font-family: '${face.family} Fallback';`,
        `  src: ${face.fallback.local.map((l) => `local('${l}')`).join(', ')};`,
        `  size-adjust: ${pct(a.sizeAdjust)};`,
        `  ascent-override: ${pct(a.ascent)};`,
        `  descent-override: ${pct(a.descent)};`,
        `  line-gap-override: ${pct(a.lineGap)};`,
        '}',
      ].join('\n'),
    );
  }
  return out.join('\n');
}
