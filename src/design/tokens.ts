/**
 * Design tokens: the one source of truth for how the hall looks.
 *
 * - `ui` colours become CSS custom properties (src/styles/tokens.css is
 *   generated from this file by `task tokens`; a test fails if it drifts).
 * - `board` colours are read by the canvas renderer.
 * - `type`, `space`, `size`, `z`, `motion` and `shadow` are CSS too.
 *
 * Colour literals belong here and in art/*.json only; a test fails if one
 * appears in src/ui, src/render or the component stylesheets.
 * docs/design.md explains how to add a token.
 */

// ---------------------------------------------------------------- the interface

export const ui = {
  // The dark the page sits in.
  bg: '#0b0812',
  bgGlowCool: '#1a1326',
  bgGlowWarm: '#1b0f12',
  // Surfaces, from sunken to raised.
  surface: '#120d1c',
  surfaceLow: '#140f1d',
  surfaceHigh: '#1d1528',
  surfaceActive: '#2a1a22',
  surfaceActiveLow: '#1c1220',
  well: '#000000',
  // A faint lift of light on a raised edge.
  sheen: '#ffffff',
  // Lines.
  line: '#2a2036',
  lineFaint: '#221a2e',
  lineControl: '#2f2440',
  lineStrong: '#3a2f4a',
  lineDeep: '#05030a',
  // Text on the dark.
  text: '#f1e9d8',
  textDim: '#bcb3a3',
  textFaint: '#968aa2',
  textDisabled: '#6e6378',
  // The accent: an ember.
  accent: '#ff7a1f',
  accentDim: '#a04a12',
  // Meaning.
  danger: '#ff5a50',
  dangerDeep: '#6a1a22',
  dangerWell: '#2a0c12',
  heart: '#b4202c',
  heartBright: '#ff4a4a',
  gold: '#e3b341',
  // The board's frame.
  frameHigh: '#5a4870',
  frameMid: '#2a2036',
  frameLow: '#1d1626',
  frameEdge: '#3a2f48',
  frameInset: '#120d1a',
  // The manual: parchment and ink.
  paper: '#fffaeb',
  parchment: '#e9dcc0',
  parchmentLight: '#efe3c8',
  parchmentDark: '#cdbb95',
  ink: '#2b2118',
  inkSoft: '#5a4632',
  inkRule: '#3c2814',
  paperShadow: '#5a3c19',
  // The install homage.
  dosBlue: '#0000aa',
  dosText: '#e8e8e8',
} as const;

export type UiColor = keyof typeof ui;

// ---------------------------------------------------------------- the board

export const board = {
  // Readouts drawn over the hall.
  ink: '#07050c',
  bone: '#f1e9d8',
  gold: '#e3b341',
  goldDark: '#9a7120',
  goldLight: '#ffe08a',
  glint: '#fff6d0',
  mark: '#ff8c2a',
  markHover: '#ffb070',
  ward: '#7fd0ff',
  held: '#c9d3e8',
  crumb: '#cdbf96',
  hitFlash: '#ff3a3a',
  huntWash: '#cfe0ff',
  shadow: '#000000',
  missing: '#ff00ff',
  hp: { back: '#1a1016', good: '#4fd1a0', hero: '#e8b04a', bad: '#e04545', shine: '#ffffff' },
  /** Colour-blind safe health bars: hue says whose, length and a stripe say how hurt. */
  hpSafe: { hall: '#5aa9ff', hero: '#f0a030', stripe: '#f1e9d8' },
  mood: { angry: '#e04545', hungry: '#e3b341', other: '#f1e9d8' },

  stone: {
    shades: ['#16111e', '#1a1423', '#1e1728', '#221a2d'],
    lit: ['#251c31', '#292036', '#2d233a', '#32273f'],
    crack: '#0b0810',
    face: ['#40324f', '#382c46', '#30263d'],
    faceTop: '#5a4870',
    faceFoot: '#1d1626',
    lip: '#3e3250',
    edgeLit: '#4a3c5a',
    dark: '#000000',
  },
  floor: {
    shades: ['#3d3242', '#423647', '#463a4b', '#3a2f3f'],
    lit: ['#4a3e50', '#4f4255', '#534658', '#463a4c'],
    grout: '#211a27',
    pebble: '#5a4d60',
  },
  lair: {
    tint: '#3a1e26',
    straw: ['#7a5e36', '#94743f', '#5e462a', '#a8844a'],
    hollow: '#3a281c',
    hollowSpeck: '#5a3e26',
    edge: '#7a5a3a',
    edgeDark: '#1e1218',
  },
  hatchery: {
    loam: ['#2a271c', '#312d20'],
    moss: ['#3e4a2a', '#465630'],
    eggShadow: '#16140e',
    edge: '#5a6a3a',
    edgeDark: '#12100a',
  },
  treasury: {
    stone: ['#2e2232', '#2a1f2e'],
    lattice: '#22182a',
    inlay: '#9a7120',
    inlayLit: '#c8962c',
    rim: '#1a1018',
  },
  pool: {
    deep: ['#0f2a40', '#123552'],
    deepest: '#0c2236',
    shallow: '#1d4e66',
    shore: '#3a7a90',
    shadow: '#0a1622',
    caustic: '#2f7896',
    ripple: '#96d2e6',
  },
  portal: {
    pit: '#06040a',
    rim: '#120a1c',
    stones: ['#5a5064', '#3e3648', '#4a4254', '#2e2838'],
    motes: ['#e8d0ff', '#a070ff', '#5a30a0'],
    glow: '#be8cff',
    glowEdge: '#5a28a0',
  },
  gate: {
    dark: '#0a0812',
    daylight: ['#3a4256', '#4a5468'],
    bars: '#6a6a76',
    jamb: ['#4a4252', '#3e3746'],
    joint: '#2a2432',
    lintel: '#5a5262',
    shimmer: '#96afdc',
  },
  heart: { glow: '#ff5050', glowEdge: '#ff2828' },

  light: {
    /** The hall's own dark: low enough to hide, high enough that undug rock still reads. */
    ambient: '#463958',
    heart: '#ff4646',
    portal: '#aa6eff',
    gate: '#d2dcff',
    lair: '#ff963c',
    hatchery: '#ffaa50',
    treasury: '#ffc85a',
    pool: '#5aaaff',
    coblyn: '#ffb45a',
    mortal: '#ffdca0',
    pwca: '#ffe650',
    teg: '#c8ffc8',
    wash: '#ff7a1f',
    vignette: '#040208',
  },
  fx: {
    chips: ['#3c304a', '#2d2439', '#4b3d5c'],
    dust: ['#786982', '#5a5064'],
    gold: ['#ffe08a', '#e3b341', '#fff6d0'],
    sparks: ['#ff5a4a', '#ffb070', '#d8232a'],
    smoke: ['#3c3246', '#282030'],
    wispHero: '#d8e4ff',
    wispBeast: '#ffd0a0',
    shards: ['#ff3a44', '#ffd0d0', '#b4202c'],
    motes: ['#e8d0ff', '#a070ff', '#5a30a0'],
    embers: ['#ff8a2a', '#ffd07a'],
    mist: '#c8d7f0',
  },
} as const;

// ---------------------------------------------------------------- fades

/** Opacities that dim text: older log lines, unseen manual tabs. Text pairs check them. */
export const fade = { log: 0.7, logRecent: 0.85, unseen: 0.9 } as const;

// ---------------------------------------------------------------- pairs that must stay legible

/**
 * Text and the ground it sits on, as the stylesheets pair them. Every theme
 * is checked (src/design/a11y.test.ts): `min` is the WCAG ratio, 7 for body
 * text and 4.5 for secondary text; `opacity` is the fade token the stylesheet
 * dims it with. Add a pair when a stylesheet puts text on a new
 * ground.
 */
export interface TextPair {
  fg: UiColor;
  bg: UiColor;
  min: 7 | 4.5;
  /** The stylesheet fades this text with var(--fade-<name>). */
  fade?: keyof typeof fade;
  use: string;
}

export const textPairs: readonly TextPair[] = [
  { fg: 'text', bg: 'bg', min: 7, use: 'body text, the masthead' },
  { fg: 'text', bg: 'surface', min: 7, use: 'HUD, the latest log line, overlay titles, levels' },
  { fg: 'textDim', bg: 'surface', min: 4.5, use: 'log, overlay body, menus, settings' },
  { fg: 'textDim', bg: 'surfaceHigh', min: 4.5, use: 'button labels on the raised gradient' },
  { fg: 'textDim', bg: 'surface', min: 4.5, fade: 'log', use: 'the oldest log line' },
  { fg: 'textDim', bg: 'surface', min: 4.5, fade: 'logRecent', use: 'the log line before the latest' },
  { fg: 'textDim', bg: 'bg', min: 4.5, use: 'the strap line, the title rows' },
  { fg: 'textFaint', bg: 'bg', min: 4.5, use: 'tool group names' },
  { fg: 'textFaint', bg: 'surfaceHigh', min: 4.5, use: 'key hints, a cost you cannot pay' },
  { fg: 'accent', bg: 'surface', min: 4.5, use: 'the clock, briefing kicker, primary buttons' },
  { fg: 'accent', bg: 'surfaceActive', min: 4.5, use: 'the tool in hand' },
  { fg: 'accent', bg: 'bg', min: 4.5, use: 'press any key' },
  { fg: 'danger', bg: 'surface', min: 4.5, use: 'the HUD when the Heart is struck' },
  { fg: 'gold', bg: 'surfaceHigh', min: 4.5, use: 'tool costs' },
  { fg: 'ink', bg: 'parchment', min: 7, use: 'the manual' },
  { fg: 'ink', bg: 'parchmentDark', min: 7, use: "the manual, at the page's dark corner" },
  { fg: 'inkSoft', bg: 'parchment', min: 4.5, use: 'glosses, headers, tabs, footnotes' },
  { fg: 'inkSoft', bg: 'parchmentDark', min: 4.5, use: 'the same, at the dark corner' },
  { fg: 'inkSoft', bg: 'parchment', min: 4.5, fade: 'unseen', use: 'a tab for a page not yet seen' },
  { fg: 'parchment', bg: 'ink', min: 7, use: 'the open tab, the trade buttons' },
  { fg: 'dosText', bg: 'dosBlue', min: 7, use: 'the installer' },
];

/** A board colour, by path: 'hp.good'. */
export type BoardPath = string;

/**
 * Board colours that carry meaning and must stay apart. `distinct` pairs
 * must differ by ΔE ≥ 20 for normal vision and under simulated protanopia,
 * deuteranopia and tritanopia; `ground` pairs need 3:1 contrast (a bar
 * against its back).
 */
export const boardPairs: readonly { a: BoardPath; b: BoardPath; kind: 'distinct' | 'ground'; use: string }[] = [
  { a: 'hp.good', b: 'hp.bad', kind: 'distinct', use: 'a healthy creature and a dying one' },
  { a: 'hp.hero', b: 'hp.bad', kind: 'distinct', use: 'a healthy mortal and a dying one' },
  { a: 'hp.good', b: 'hp.hero', kind: 'distinct', use: 'whose bar it is: the hall or the mortals' },
  { a: 'hpSafe.hall', b: 'hpSafe.hero', kind: 'distinct', use: 'whose bar it is, in safe colours' },
  { a: 'hp.good', b: 'hp.back', kind: 'ground', use: 'a bar against its back' },
  { a: 'hp.hero', b: 'hp.back', kind: 'ground', use: 'a bar against its back' },
  { a: 'hp.bad', b: 'hp.back', kind: 'ground', use: 'a bar against its back' },
  { a: 'hpSafe.hall', b: 'hp.back', kind: 'ground', use: 'a bar against its back' },
  { a: 'hpSafe.hero', b: 'hp.back', kind: 'ground', use: 'a bar against its back' },
];

// ---------------------------------------------------------------- type, space, size

export const type = {
  family: {
    display: "'Metamorphous', 'Metamorphous Fallback', 'Palatino Linotype', Georgia, serif",
    body: "'IM Fell English', 'IM Fell English Fallback', 'Palatino Linotype', Georgia, serif",
    hud: "'VT323', 'VT323 Fallback', 'Courier New', monospace",
  },
  /** px. Named by use, not by size, so a change of mind is one edit. */
  size: {
    micro: 10,
    caption: 12,
    hudSmall: 15,
    small: 15,
    body: 17,
    hud: 18,
    hudLarge: 22,
    titleSmall: 20,
    title: 26,
    display: 30,
  },
  leading: { tight: 1, snug: 1.15, body: 1.4 },
  tracking: { label: '0.22em', caps: '0.1em', display: '0.04em' },
} as const;

/** px, a 2px grid like the art. */
export const space = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 16, 8: 20, 9: 24 } as const;

export const size = {
  /** The board column: 672px of board plus a 6px frame each side. */
  boardColumn: 684,
  manualColumn: 380,
  layout: 1140,
  control: 36,
  portrait: 112,
} as const;

export const z = { board: 0, tooltip: 2, profiler: 3, menu: 5, title: 10 } as const;

/** ms */
export const motion = { fast: 100, base: 200, slow: 350, page: 420 } as const;

export const shadow = {
  card: `0 12px 30px ${ui.well}99`,
  deep: `0 18px 50px ${ui.well}b3`,
} as const;
