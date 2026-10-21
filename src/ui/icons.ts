/**
 * Pixel icons for the toolbar and HUD, in the board's style: small maps of
 * palette keys ('.' transparent), drawn crisp at an integer scale onto a
 * little canvas. The engines reuse their board art.
 */
import { ENGINE_ART, drawPixelMap } from '../render/sprites';

interface Icon {
  rows: string[];
  pal: Record<string, string>;
}

const SKIN = { o: '#5e3e26', h: '#b0835a', H: '#e6be8e' };
const GOLD = { o: '#4a3410', d: '#9a7120', y: '#e3b341', Y: '#ffe08a' };

export const ICONS = {
  hand: {
    pal: SKIN,
    rows: [
      '...o.o.o....',
      '..oHoHoHo...',
      '..oHoHoHoo..',
      '..oHoHoHoHo.',
      'oo.HhHhHoHo.',
      'oHo.HHHHHHo.',
      'oHHoHHHHHHo.',
      '.oHHHHHHHHo.',
      '..oHHHHHHo..',
      '...oHHHHho..',
      '....ohhhho..',
      '.....oooo...',
    ],
  },
  dig: {
    pal: { p: '#c8ced6', P: '#6b7380', w: '#9a6a3a', W: '#5e3e1e', o: '#1a1420' },
    rows: [
      '...oooooo...',
      '..oppppppo..',
      '.opPooooPpo.',
      'opPo.ow.oPpo',
      'oPo..ow..oPo',
      '.o...ow...o.',
      '.....ow.....',
      '.....ow.....',
      '.....oW.....',
      '.....oW.....',
      '.....oW.....',
      '.....oo.....',
    ],
  },
  lair: {
    pal: { s: '#94743f', S: '#c09a58', k: '#3a281c', o: '#2a1a12' },
    rows: [
      '............',
      '............',
      '...s.S..s...',
      '..sSsssSss..',
      '.sSoooooSSs.',
      'sSokkkkkkoSs',
      'sSokkkkkkoSs',
      '.sSoooooSSs.',
      '..sSSsSSss..',
      '...ssssss...',
      '............',
      '............',
    ],
  },
  hatchery: {
    pal: { o: '#4a4030', E: '#ece2c4', e: '#b8a986', s: '#8f8464', g: '#465630' },
    rows: [
      '....oooo....',
      '...oEEEEo...',
      '..oEEEsEEo..',
      '..oEEEEEEo..',
      '.oEsEEEEeEo.',
      '.oEEEEEsEEo.',
      '.oEEEEEEEeo.',
      '.oeEEsEEEeo.',
      '..oeEEEEeo..',
      '...oooooo...',
      '.gg.g..g.gg.',
      'g.gg.gg.gg.g',
    ],
  },
  treasury: {
    pal: GOLD,
    rows: [
      '....oooo....',
      '...oYYYYo...',
      '...odyyyo...',
      '..ooYYYYoo..',
      '.oYYodyyoYo.',
      '.odyoYYYodo.',
      'ooYYodyyoYYo',
      'odyyoYYYodyo',
      'oYYYodyyoYYo',
      'odyyoYYYodyo',
      'oddyoddyoddo',
      '.oooooooooo.',
    ],
  },
  pool: {
    pal: { b: '#6fb3c8', B: '#c8eef6', d: '#2a6a80' },
    rows: [
      '............',
      '..BB....BB..',
      '.b..b..b..b.',
      'b....bb....b',
      '............',
      '..BB....BB..',
      '.b..b..b..b.',
      'b....bb....b',
      '............',
      '..dd....dd..',
      '.d..d..d..d.',
      'd....dd....d',
    ],
  },
  pause: {
    pal: { o: '#f1e9d8' },
    rows: ['..........', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..oo..oo..', '..........'],
  },
  play: {
    pal: { o: '#f1e9d8' },
    rows: ['..........', '..o.......', '..oo......', '..ooo.....', '..oooo....', '..oooo....', '..ooo.....', '..oo......', '..o.......', '..........'],
  },
  restart: {
    pal: { o: '#f1e9d8' },
    rows: ['...oooo...', '..o....o.o', '.o......oo', '.o.....ooo', '.o........', '.o........', '.o......o.', '..o....o..', '...oooo...', '..........'],
  },
  horn: {
    pal: { w: '#e8dcc0', W: '#b8a986', o: '#5e4428', g: '#e3b341' },
    rows: ['..........', '........oo', '.......owo', '......owwo', 'ooo..owwwo', 'owgooWwwwo', 'owwwWwwwgo', 'oowwwwwwo.', '..ooowwo..', '.....oo...'],
  },
  coin: {
    pal: GOLD,
    rows: ['..oooo..', '.oYYYYo.', 'oYyddyYo', 'oYdYYdyo', 'oYdYYdyo', 'oYyddyyo', '.oyyyyo.', '..oooo..'],
  },
  heart: {
    pal: { o: '#3a060c', r: '#b4202c', R: '#ff3a44', W: '#ffd0d0' },
    rows: ['.oo..oo.', 'oRRooRRo', 'oRWRRRRo', 'oRRRRRro', '.oRRRro.', '..oRro..', '...oo...', '........'],
  },
  wave: {
    pal: { s: '#dfe4ea', S: '#8a929c', h: '#9a7444', o: '#1a1420' },
    rows: ['s......s', '.s....s.', '..s..s..', '...ss...', '...ss...', '..h..h..', '.h....h.', 'h......h'],
  },
  paw: {
    pal: { o: '#f1e9d8' },
    rows: ['.o..o...', 'oo..oo..', '........', 'o.oo..o.', '.oooo...', 'oooooo..', '.oooo...', '........'],
  },
  vault: {
    pal: { o: '#1a1018', w: '#7a5230', W: '#9a7044', y: '#e3b341' },
    rows: ['.oooooo.', 'oWWWWWWo', 'oyyyyyyo', 'owwyywwo', 'owwyywwo', 'owwwwwwo', 'oooooooo', '........'],
  },
  floor: {
    pal: GOLD,
    rows: ['........', '........', '...oo...', '..oYYo..', '.oYyydo.', 'oyyyyddo', 'oddddddo', '........'],
  },
} satisfies Record<string, Icon>;

export type IconName = keyof typeof ICONS | 'pit' | 'boulder' | 'snare';

function art(name: IconName): Icon {
  if (name === 'pit' || name === 'boulder' || name === 'snare') {
    const e = ENGINE_ART[name];
    return { rows: e.rows, pal: e.palette };
  }
  return ICONS[name];
}

/** A crisp little canvas showing the icon at an integer scale. */
export function iconCanvas(name: IconName, scale = 2, label = ''): HTMLCanvasElement {
  const icon = art(name);
  const w = (icon.rows[0]?.length ?? 0) * scale;
  const h = icon.rows.length * scale;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.className = 'pixel-icon';
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  if (label) c.setAttribute('aria-label', label);
  else c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d');
  if (ctx) drawPixelMap(ctx, icon.rows, icon.pal, 0, 0, scale);
  return c;
}

/** Repaint an existing icon canvas with a different icon (e.g. pause ⇄ play). */
export function setIcon(c: HTMLCanvasElement, name: IconName, scale = 2): void {
  const icon = art(name);
  c.width = (icon.rows[0]?.length ?? 0) * scale;
  c.height = icon.rows.length * scale;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  drawPixelMap(ctx, icon.rows, icon.pal, 0, 0, scale);
}
