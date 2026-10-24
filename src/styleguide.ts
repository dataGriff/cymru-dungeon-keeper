/**
 * The living style guide (styleguide.html): every token, type size, button
 * state, HUD cell, the log, the manual, every icon, figure, tile and engine,
 * and a lit scene, drawn with the game's own components and renderers so it
 * cannot drift from the game. It renders once, on a fixed clock, so it can
 * be screenshot-tested; `body[data-ready]` is set when fonts and canvases
 * are done.
 */
import { BESTIARY, BESTIARY_ORDER, type BeastKind, ENGINES, type EngineKind } from './data/bestiary';
import { type Level, THE_CAIRN } from './data/levels';
import { contrast } from './design/color';
import { PICKABLE, THEMES, themeUi } from './design/themes';
import { space, type, type UiColor } from './design/tokens';
import { B, setBoardTheme } from './render/colors';
import { createBoardView, drawBoard } from './render/board';
import { drawPixels, mapSize, pixelNames } from './render/pixels';
import { type BeastAction, drawBeast, drawEngine } from './render/sprites';
import { PX, TILE, drawAnimatedTile, drawEmissiveTile, drawStaticTile, isAnimated } from './render/tiles';
import { type GameState, type Pages, addLog, createGame, spawn } from './sim/game';
import { Tile, createGrid, setTile, tileAt } from './sim/grid';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { ICON_NAMES, iconCanvas } from './ui/icons';
import { createLog } from './ui/log';
import { createManual } from './ui/manual';

/** The clock everything is drawn at. */
const T = 0;
const THEME_NAMES = Object.keys(THEMES);

function section(id: string, title: string, intro: string, ...body: Node[]): HTMLElement {
  const s = el('section', { className: 'sg-section' }, [el('h2', { className: 'sg-h2', text: title }), el('p', { className: 'sg-intro', text: intro }), ...body]);
  s.id = id;
  return s;
}

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, label = ''): HTMLCanvasElement {
  const c = el('canvas', { className: 'sg-canvas' });
  c.width = w;
  c.height = h;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  if (label) c.setAttribute('aria-label', label);
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
  }
  return c;
}

const figure = (node: Node, caption: string): HTMLElement => el('figure', { className: 'sg-figure' }, [node, el('figcaption', { text: caption })]);

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// ---------------------------------------------------------------- colour

function uiSwatches(theme: string): HTMLElement {
  const colors = themeUi(theme);
  const grid = el('div', { className: 'sg-swatches' });
  for (const [name, hex] of Object.entries(colors) as [UiColor, string][]) {
    const chip = el('div', { className: 'sg-chip' });
    chip.style.background = `var(--${kebab(name)})`;
    const onBg = contrast(hex, colors.bg).toFixed(1);
    const onParchment = contrast(hex, colors.parchment).toFixed(1);
    grid.append(
      el('div', { className: 'sg-swatch' }, [
        chip,
        el('code', { text: `--${kebab(name)}` }),
        el('span', { className: 'sg-meta', text: `${hex} · ${onBg}:1 on bg · ${onParchment}:1 on parchment` }),
      ]),
    );
  }
  return grid;
}

function boardSwatches(): HTMLElement {
  const grid = el('div', { className: 'sg-swatches sg-swatches--small' });
  const walk = (path: string, v: unknown): void => {
    if (typeof v === 'string') {
      const chip = el('div', { className: 'sg-chip' });
      chip.style.background = v;
      grid.append(el('div', { className: 'sg-swatch' }, [chip, el('code', { text: path }), el('span', { className: 'sg-meta', text: v })]));
    } else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(Array.isArray(v) ? `${path}[${k}]` : path ? `${path}.${k}` : k, c);
  };
  walk('', B);
  return grid;
}

// ---------------------------------------------------------------- type and space

function typeScale(): HTMLElement {
  const rows = el('div', { className: 'sg-stack' });
  for (const fam of Object.keys(type.family)) {
    for (const [size, px] of Object.entries(type.size)) {
      const sample = el('div', { className: 'sg-type', text: fam === 'hud' ? 'Gold 150 · Wave 2/3 · Cŵn Annwn' : 'Arawn rides with the Hunt. Cŵn Annwn.' });
      sample.style.fontFamily = `var(--font-${fam})`;
      sample.style.fontSize = `var(--fs-${kebab(size)})`;
      rows.append(el('div', { className: 'sg-row' }, [el('code', { text: `--font-${fam} · --fs-${kebab(size)} (${px}px)` }), sample]));
    }
  }
  return rows;
}

function spaceScale(): HTMLElement {
  const rows = el('div', { className: 'sg-stack' });
  for (const [k, px] of Object.entries(space)) {
    const bar = el('span', { className: 'sg-space' });
    bar.style.width = `var(--sp-${k})`;
    rows.append(el('div', { className: 'sg-row' }, [el('code', { text: `--sp-${k} (${px}px)` }), bar]));
  }
  return rows;
}

// ---------------------------------------------------------------- components

const STATES: [string, (b: HTMLButtonElement) => void][] = [
  ['rest', () => undefined],
  ['hover', (b) => b.classList.add('is-hover')],
  ['pressed', (b) => b.classList.add('is-pressed')],
  ['on', (b) => b.setAttribute('aria-pressed', 'true')],
  ['focus', (b) => b.classList.add('is-focus')],
  ['disabled', (b) => (b.disabled = true)],
];

function buttons(): HTMLElement {
  const variants: [string, string, () => Node[]][] = [
    ['btn btn--tool', 'tool', () => [iconCanvas('dig', 2), el('span', { className: 'tool-label', text: 'Dig' }), el('span', { className: 'tool-key', text: 'D' })]],
    ['btn btn--tool', 'tool, with a cost', () => [iconCanvas('lair', 2), el('span', { className: 'tool-label', text: 'Lair' }), el('span', { className: 'tool-cost', text: '15' })]],
    ['btn btn--square', 'square', () => [iconCanvas('pause', 2)]],
    ['btn btn--primary', 'primary', () => [document.createTextNode('Descend')]],
    ['btn btn--ghost', 'ghost', () => [document.createTextNode('Back to the title')]],
    ['btn btn--small', 'small', () => [document.createTextNode('Save')]],
    ['btn btn--level', 'level', () => [document.createTextNode('1. The Cairn')]],
    ['btn btn--menu', 'menu', () => [document.createTextNode('Settings')]],
  ];
  const table = el('div', { className: 'sg-states' });
  table.append(el('span'), ...STATES.map(([s]) => el('span', { className: 'sg-meta', text: s })));
  for (const [cls, name, kids] of variants) {
    table.append(el('code', { text: name }));
    for (const [, apply] of STATES) {
      const b = el('button', { className: cls }, kids());
      apply(b);
      table.append(el('div', { className: 'sg-cell' }, [b]));
    }
  }
  const poor = el('button', { className: 'btn btn--tool is-poor' }, [iconCanvas('pool', 2), el('span', { className: 'tool-label', text: 'Pool' }), el('span', { className: 'tool-cost', text: '40' })]);
  const parchment = el('div', { className: 'manual-page sg-parchment' }, [
    el('div', { className: 'sg-states sg-states--paper' }, [
      el('span'),
      ...STATES.map(([s]) => el('span', { className: 'sg-meta', text: s })),
      ...(['tab', 'ink'] as const).flatMap((v) => [
        el('code', { text: v }),
        ...STATES.map(([, apply]) => {
          const b = el('button', { className: `btn btn--${v}`, text: v === 'tab' ? 'Coblyn' : 'A cask · 30g' });
          apply(b);
          return el('div', { className: 'sg-cell' }, [b]);
        }),
      ]),
      el('code', { text: 'tab, unseen' }),
      el('div', { className: 'sg-cell' }, [el('button', { className: 'btn btn--tab is-unseen', text: 'Afanc' })]),
    ]),
  ]);
  return el('div', { className: 'sg-stack' }, [table, figure(poor, 'a cost you cannot pay (.is-poor)'), parchment]);
}

/** A hall in the middle of a wave, built by hand so it is the same every time. */
function sceneState(): GameState {
  const rows = [
    '##########**############',
    '#....LLL####*##.........',
    '#P...LLL####...........G',
    '#....................###',
    '#..H......FFF...TTT..###',
    '#.........FFF...TTT..###',
    '####WWW..............###',
    '####WWW.######*#########',
  ];
  const level: Level = { ...THE_CAIRN, id: 'styleguide', name: 'The style guide', width: 24, height: rows.length, rows, goldFraction: 0 };
  const s = createGame(7, allPages(), level);
  const at: [BeastKind, number, number][] = [
    ['cwn', 6, 4],
    ['gwyllgi', 13, 3],
    ['pwca', 2, 5],
    ['knight', 19, 2],
    ['priest', 21, 3],
    ['teg', 8, 5],
  ];
  for (const [kind, x, y] of at) {
    const e = spawn(s, kind, { x, y });
    e.facing = x > 15 ? -1 : 1;
  }
  const hurt = s.entities.find((e) => e.kind === 'gwyllgi');
  if (hurt) hurt.hp = Math.ceil(hurt.maxHp * 0.3);
  const knight = s.entities.find((e) => e.kind === 'knight');
  if (knight) knight.hp = Math.ceil(knight.maxHp * 0.7);
  addLog(s, 'Baying, then silence. A Cŵn Annwn has slunk in from the portal.');
  addLog(s, 'Boots on the stair. Wave 1: 2 mortals at the Gate.');
  addLog(s, 'The Gwyllgi bares its teeth at the Mortal Knight.');
  return s;
}

function allPages(): Pages {
  return Object.fromEntries(BESTIARY_ORDER.map((k) => [k, 'studied'])) as Pages;
}

function scene(state: GameState, safe: boolean): HTMLCanvasElement {
  const c = el('canvas', { className: 'sg-board' });
  const view = createBoardView(c, state.grid.w, state.grid.h);
  view.lighting.reducedMotion = true;
  view.safeColours = safe;
  drawBoard(view, state, T, null, 1, null, true);
  return c;
}

// ---------------------------------------------------------------- art

function figures(): HTMLElement {
  const actions: BeastAction[] = ['idle', 'walk', 'attack', 'sleep', 'eat', 'dead'];
  const grid = el('div', { className: 'sg-figures' });
  grid.append(el('span'), ...actions.map((a) => el('span', { className: 'sg-meta', text: a })), el('span', { className: 'sg-meta', text: 'unread' }));
  const px = 3;
  for (const kind of BESTIARY_ORDER) {
    grid.append(el('code', { text: BESTIARY[kind].name }));
    for (const action of actions) {
      grid.append(canvas(16 * px + 8, 16 * px + 8, (ctx) => drawBeast(ctx, kind, 8 * px + 4, 16 * px + 4, px, { t: 0.09, action, facing: 1 }), `${kind} ${action}`));
    }
    grid.append(canvas(16 * px + 8, 16 * px + 8, (ctx) => drawBeast(ctx, kind, 8 * px + 4, 16 * px + 4, px, { silhouette: true }), `${kind} unread`));
  }
  return grid;
}

function tiles(): HTMLElement {
  const kinds: [Tile, string][] = [
    [Tile.Rock, 'rock'],
    [Tile.Gold, 'gold seam'],
    [Tile.Floor, 'floor'],
    [Tile.Lair, 'lair'],
    [Tile.Hatchery, 'hatchery'],
    [Tile.Treasury, 'treasury'],
    [Tile.Pool, 'pool'],
    [Tile.Portal, 'portal'],
    [Tile.Heart, 'heart'],
    [Tile.Gate, 'gate'],
  ];
  const row = el('div', { className: 'sg-wrap' });
  for (const [t, name] of kinds) {
    // Each tile on a 3x3 patch of floor, so its edges and faces show.
    const g = createGrid(3, 3, t === Tile.Rock || t === Tile.Gold ? Tile.Floor : t);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (t === Tile.Portal || t === Tile.Heart || t === Tile.Gate) setTile(g, x, y, Tile.Floor);
    setTile(g, 1, 1, t);
    if (t === Tile.Rock || t === Tile.Gold) for (let x = 0; x < 3; x++) setTile(g, x, 0, t);
    const c = canvas(3 * TILE, 3 * TILE, (ctx) => {
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++) {
          drawStaticTile(ctx, g, x, y);
          if (isAnimated(tileAt(g, x, y))) {
            drawAnimatedTile(ctx, g, x, y, T, 0.5, true);
            drawEmissiveTile(ctx, g, x, y, T, true, 100);
          }
        }
    }, name);
    c.style.width = c.style.height = `${3 * TILE * 2}px`;
    row.append(figure(c, name));
  }
  return row;
}

function engines(): HTMLElement {
  const row = el('div', { className: 'sg-wrap' });
  for (const kind of Object.keys(ENGINES) as EngineKind[]) {
    for (const built of [true, false]) {
      row.append(figure(canvas(TILE * 2, TILE * 2, (ctx) => drawEngine(ctx, kind, TILE, TILE, PX * 2, built), kind), `${ENGINES[kind].name}${built ? '' : ', being built'}`));
    }
  }
  return row;
}

function pixelMaps(): HTMLElement {
  const row = el('div', { className: 'sg-wrap' });
  for (const name of pixelNames()) {
    const { w, h } = mapSize(name);
    const px = Math.max(2, Math.floor(28 / Math.max(w, h)));
    row.append(figure(canvas(w * px, h * px, (ctx) => drawPixels(ctx, name, 0, 0, px, name.startsWith('glyph.') ? { color: B.bone } : {}), name), name));
  }
  return row;
}

function icons(): HTMLElement {
  return el(
    'div',
    { className: 'sg-wrap' },
    ICON_NAMES.map((n) => figure(iconCanvas(n, 2), n)),
  );
}

function particles(): HTMLElement {
  const row = el('div', { className: 'sg-swatches sg-swatches--small' });
  for (const [name, v] of Object.entries(B.fx)) {
    const list: readonly string[] = typeof v === 'string' ? [v] : v;
    const chips = el(
      'div',
      { className: 'sg-chips' },
      list.map((c) => {
        const chip = el('span', { className: 'sg-chip sg-chip--dot' });
        chip.style.background = c;
        return chip;
      }),
    );
    row.append(el('div', { className: 'sg-swatch' }, [chips, el('code', { text: `fx.${name}` })]));
  }
  return row;
}

// ---------------------------------------------------------------- the page

function render(app: HTMLElement, theme: string): void {
  document.documentElement.dataset['theme'] = theme;
  setBoardTheme(theme);
  const state = sceneState();
  const hud = createHud();
  hud.update(state, false, 1);
  const log = createLog(3);
  log.update(state);
  const manual = createManual({ onTrade: () => undefined });
  manual.setPages(allPages());
  manual.open('gwyllgi');
  manual.setEmissary(true, 40);
  manual.tick(T);

  const themePicker = el('select', { className: 'sg-theme' });
  themePicker.setAttribute('aria-label', 'Theme');
  for (const name of THEME_NAMES) {
    const o = el('option', { text: `${(THEMES as Record<string, { label: string }>)[name]?.label ?? name}${PICKABLE.includes(name as never) ? '' : ' (automatic)'}` });
    o.value = name;
    o.selected = name === theme;
    themePicker.append(o);
  }
  themePicker.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('theme', themePicker.value);
    history.replaceState(null, '', url);
    render(app, themePicker.value);
  });

  const nav = el(
    'nav',
    { className: 'sg-nav' },
    [
      ['colour', 'Colour'],
      ['type', 'Type & space'],
      ['buttons', 'Buttons'],
      ['hud', 'HUD & log'],
      ['manual', 'Manual'],
      ['scene', 'The hall'],
      ['figures', 'Figures'],
      ['tiles', 'Tiles & engines'],
      ['pixels', 'Icons & pixel maps'],
    ].map(([id = '', label = '']) => Object.assign(el('a', { text: label }), { href: `#${id}` })),
  );

  app.replaceChildren(
    el('header', { className: 'sg-header' }, [
      el('h1', { className: 'sg-h1' }, [iconCanvas('heart', 3), el('span', { text: 'Steward of Annwn — style guide' })]),
      el('p', { className: 'sg-intro', text: 'Drawn with the game’s own tokens, components and renderers. Tokens live in src/design/tokens.ts; see docs/design.md.' }),
      el('label', { className: 'sg-row' }, [el('span', { text: 'Theme' }), themePicker]),
      nav,
    ]),
    section('colour', 'Colour', 'Interface tokens, with their contrast against the page and the parchment. Text pairs are checked in src/design/a11y.test.ts.', uiSwatches(theme), el('h3', { className: 'sg-h3', text: 'Board' }), boardSwatches(), el('h3', { className: 'sg-h3', text: 'Particles' }), particles()),
    section('type', 'Type & space', 'Three faces, self-hosted, each with a metric-matched fallback. Sizes are named by use.', typeScale(), el('h3', { className: 'sg-h3', text: 'Space' }), spaceScale()),
    section('buttons', 'Buttons', 'One component (.btn) with variants; every variant shares the same states.', buttons()),
    section('hud', 'HUD & log', 'The readouts over the hall, and the last three lines of the log.', hud.root, log.root),
    section('manual', 'Manual', 'A page of the bestiary, with the emissary’s card.', el('div', { className: 'sg-manual' }, [manual.root])),
    section('scene', 'The hall', 'A hand-built scene, lit, on a fixed clock: health bars in the normal and the colour-blind safe colours.', el('div', { className: 'sg-wrap' }, [figure(scene(state, false), 'normal bars'), figure(scene(sceneState(), true), 'safe bars')])),
    section('figures', 'Figures', 'Every creature in every action (art/figures.json).', figures()),
    section('tiles', 'Tiles & engines', 'Static art from tiles.ts, with animated parts at t = 0.', tiles(), engines()),
    section('pixels', 'Icons & pixel maps', 'Every map in art/pixels.json, and the icons built from them.', icons(), pixelMaps()),
  );
}

const app = document.getElementById('app');
if (app) {
  const asked = new URLSearchParams(location.search).get('theme') ?? 'hall';
  render(app, asked in THEMES ? asked : 'hall');
  void document.fonts.ready.then(() => {
    document.body.dataset['ready'] = 'true';
  });
}
