import { CAMPAIGN, type Level } from './data/levels';
import { type BoardView, boardReact, createBoardView, drawBoard, entityAt } from './render/board';
import { loadSpriteSheet } from './render/sprites';
import { TILE } from './render/tiles';
import { nudge } from './sim/ai';
import type { Entity } from './sim/entities';
import { type GameState, type Pages, createGame, emissary, freshPages, markDig, paintRoom, planTrap, takeEvents, trade } from './sim/game';
import { isHero } from './sim/entities';
import { Tile, type Vec, inBounds, isMarked, isRock, tileAt } from './sim/grid';
import { generateSandbox } from './sim/sandbox';
import { TICK, advance } from './sim/index';
import { createCaveAudio } from './ui/audio';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { createLog } from './ui/log';
import { createManual } from './ui/manual';
import { createOverlay } from './ui/overlay';
import { SPEEDS, TOOL_KEYS, TOOL_ROOM, type Tool, createToolbar, isTrapTool } from './ui/toolbar';
import { showBriefing } from './ui/briefing';
import { createEditor } from './ui/editor';
import { campaignProgress, download, loadFromSlot, pickFile, saveToSlot, setCampaignProgress, slotInfo } from './ui/saves';
import { iconCanvas } from './ui/icons';
import { createProfiler } from './ui/profiler';
import { type Settings, applySettings, loadSettings, saveSettings } from './ui/settings';
import { createTitleScreen } from './ui/title';
import { fromJSON, toJSON } from './sim/save';
import { createTooltip } from './ui/tooltip';
import { PICKABLE, THEMES } from './design/themes';
import { setBoardTheme } from './render/colors';
import { fitBoard, fixedBoard } from './render/scale';

/** Press-and-hold this long on touch to get the right-click action. */
const LONG_PRESS_MS = 450;
/** Pointer travel (CSS px) before a press counts as a drag rather than a click. */
const DRAG_PX = 6;
const PAGES_KEY = 'annwn.bestiary.v1';

function loadPages(): Pages {
  const pages = freshPages();
  try {
    const raw = localStorage.getItem(PAGES_KEY);
    if (!raw) return pages;
    const saved = JSON.parse(raw) as Partial<Record<string, string>>;
    for (const k of Object.keys(pages) as (keyof Pages)[]) {
      const v = saved[k];
      if (v === 'seen' || v === 'studied') pages[k] = v;
    }
  } catch {
    /* private mode or blocked storage: play without memory */
  }
  return pages;
}

function savePages(pages: Pages): void {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
  } catch {
    /* ignore */
  }
}

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('#app missing');

  let state: GameState = createGame(undefined, loadPages());
  let pagesKey = JSON.stringify(state.pages);
  const clock = { acc: 0 };
  /** The creature in the steward's hand. */
  let selectedId: number | null = null;
  let paused = false;
  let speed = 1;
  /** Which campaign level is being played, or null for free play. */
  let campaignIndex: number | null = 0;
  /** Editor mode: the board shows the editor's grid and the tools paint tiles. */
  let editing = false;

  const canvas = el('canvas', { className: 'board' });
  canvas.setAttribute('aria-label', 'The hall. Click or drag to mark rock and paint rooms; click a creature to read about it.');
  let view: BoardView = createBoardView(canvas, state.grid.w, state.grid.h);
  /**
   * Size the board so every art pixel is a whole number of device pixels:
   * Fit takes the largest such size the column allows; a chosen scale is
   * snapped to one. Runs on resize, zoom (a new devicePixelRatio) and a new map.
   */
  const sizeBoard = (): void => {
    const dpr = window.devicePixelRatio || 1;
    if (settings.scale > 0) {
      canvas.style.width = `${fixedBoard(canvas.width, settings.scale, dpr).width}px`;
      return;
    }
    const wrap = canvas.parentElement;
    const column = wrap?.parentElement;
    if (!wrap || !column || column.clientWidth === 0) return;
    const cs = getComputedStyle(wrap);
    const frame = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const available = Math.min(column.clientWidth, parseFloat(cs.maxWidth) || Infinity) - frame;
    canvas.style.width = `${fitBoard(canvas.width, available, dpr).width}px`;
  };
  const fitBoardTo = (w: number, h: number): void => {
    if (canvas.width !== w * TILE || canvas.height !== h * TILE) {
      view = createBoardView(canvas, w, h);
      applyToView();
      sizeBoard();
    }
  };
  const hud = createHud();
  const log = createLog(3);
  const manual = createManual({
    onTrade: (kind) => {
      trade(state, kind);
    },
  });
  manual.setPages(state.pages);
  const tooltip = createTooltip();
  const audio = createCaveAudio();
  const settings: Settings = loadSettings();
  // ?still=<seconds> is for visual tests: seed 1, the sim run that far at once, then held on a
  // fixed clock with no motion, so every screenshot of the page is the same.
  const stillParam = new URLSearchParams(location.search).get('still');
  const still = stillParam === null ? null : Math.max(0, Number(stillParam) || 0);
  if (still !== null) settings.reducedMotion = true;
  applySettings(settings);
  const profiler = createProfiler();
  const applyToView = (): void => {
    view.lighting.reducedMotion = settings.reducedMotion || settings.noFlicker;
    view.safeColours = settings.safeColours;
  };
  // The theme: the player's pick, except that the Hunt's finale turns the default hall cold.
  // (High contrast stays high contrast.) The page and the board change together, with no reload.
  // ?theme=<name> forces one, for the style guide and screenshots.
  const forcedTheme = new URLSearchParams(location.search).get('theme');
  const applyTheme = (): void => {
    const name = forcedTheme && forcedTheme in THEMES ? forcedTheme : state.hunt && settings.theme === 'hall' ? 'hunt' : settings.theme;
    if (document.documentElement.dataset['theme'] !== name) document.documentElement.dataset['theme'] = name;
    setBoardTheme(name);
  };

  const setPaused = (p: boolean): void => {
    if (state.status !== 'playing') return;
    paused = p;
    toolbar.setPaused(p);
    if (p) overlay.pause();
    else overlay.hide();
  };
  const setSpeed = (sp: number): void => {
    speed = sp;
    toolbar.setSpeed(sp);
  };
  /** Start a level (a fresh seed), carrying the bestiary pages over. */
  const startLevel = (level: Level, pages = state.pages, seed?: number): void => {
    state = createGame(still === null ? seed : 1, pages, level);
    if (still !== null) {
      // Run the hall to the requested moment at once, then hold it there.
      for (let i = 0; i < Math.round(still / TICK); i++) advance(state, clock, TICK, 1);
      takeEvents(state);
    }
    fitBoardTo(state.grid.w, state.grid.h);
    clock.acc = 0;
    selectedId = null;
    paused = false;
    editing = false;
    editorPanel.root.classList.add('hidden');
    toolbar.root.classList.remove('hidden');
    toolbar.setPaused(false);
    overlay.hide();
    lastStatus = 'playing';
  };
  const restart = (): void => startLevel(state.level);
  const adoptState = (next: GameState): void => {
    state = next;
    fitBoardTo(state.grid.w, state.grid.h);
    clock.acc = 0;
    selectedId = null;
    paused = false;
    editing = false;
    editorPanel.root.classList.add('hidden');
    toolbar.root.classList.remove('hidden');
    overlay.hide();
    lastStatus = state.status;
  };
  const overlay = createOverlay({
    onRestart: restart,
    onResume: () => {
      if (overlay.mode === 'confirm') {
        overlay.hide();
        if (paused) overlay.pause();
      } else setPaused(false);
    },
    onTitle: () => {
      window.location.reload();
    },
  });
  const pickTool = (tool: Tool): void => {
    toolbar.setActive(tool);
    if (isTrapTool(tool)) manual.openEngine(tool);
  };
  const toolbar = createToolbar({
    onTool: pickTool,
    onSound: () => {
      void audio.toggle().then((on) => toolbar.setSound(on));
    },
    onPause: () => setPaused(!paused),
    onSpeed: setSpeed,
    onRestart: () => overlay.confirmRestart(),
  });

  // Save, load, export, import.
  const saveRow = el('div', { className: 'desk-panel saves' });
  const mkBtn = (label: string, title: string, fn: () => void): HTMLButtonElement => {
    const b = el('button', { className: 'btn btn--small', text: label, title });
    b.addEventListener('click', fn);
    saveRow.append(b);
    return b;
  };
  const saveNote = el('span', { className: 'save-note' });
  mkBtn('Save', 'Keep this hall in the browser', () => {
    saveNote.textContent = saveToSlot(state) ? `Saved ${state.level.name} at ${Math.round(state.time)}s.` : 'Could not save.';
  });
  mkBtn('Load', 'Resume the saved hall', () => {
    const loaded = loadFromSlot();
    if (!loaded) {
      saveNote.textContent = 'Nothing saved.';
      return;
    }
    adoptState(loaded);
    saveNote.textContent = `Loaded ${loaded.level.name}.`;
  });
  mkBtn('Export', 'Download this hall as a file', () => download(`annwn-${state.level.id}-${Math.round(state.time)}s.json`, toJSON(state)));
  mkBtn('Import', 'Load a hall from a file', () => {
    void pickFile().then((text) => {
      if (!text) return;
      try {
        adoptState(fromJSON(text));
        saveNote.textContent = `Loaded ${state.level.name}.`;
      } catch (e) {
        saveNote.textContent = e instanceof Error ? e.message : String(e);
      }
    });
  });

  // The editor.
  const editorPanel = createEditor({
    onPlay: (level) => {
      campaignIndex = null;
      void showBriefing(app, level, null).then(() => startLevel(level));
    },
    onGridChange: () => {
      /* redrawn every frame */
    },
  });
  editorPanel.root.classList.add('hidden');

  const title = el('header', { className: 'masthead' }, [
    el('h1', {}, [iconCanvas('heart', 3), el('span', { text: 'Steward of Annwn' })]),
    el('p', { className: 'strap', text: 'Arawn rides with the Hunt. Keep his hall until he returns.' }),
  ]);
  const boardWrap = el('div', { className: 'board-wrap' }, [canvas, tooltip.root, overlay.root]);
  // Mixer: three sliders behind a disclosure.
  const slider = (label: string, key: 'master' | 'ambient' | 'sfx'): HTMLElement => {
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(audio.mixer[key]);
    input.setAttribute('aria-label', `${label} volume`);
    input.addEventListener('input', () => audio.setMixer({ [key]: Number(input.value) }));
    return el('label', { className: 'mixer-row' }, [el('span', { text: label }), input]);
  };
  const mixer = el('details', { className: 'desk-menu mixer' }, [
    el('summary', { className: 'btn btn--menu', text: 'Mixer' }),
    el('div', { className: 'desk-panel desk-column' }, [slider('Master', 'master'), slider('Ambient', 'ambient'), slider('Effects', 'sfx')]),
  ]);
  // Settings: motion, flicker, text size, scale, safe colours.
  const check = (label: string, key: 'reducedMotion' | 'noFlicker' | 'safeColours'): HTMLElement => {
    const input = el('input');
    input.type = 'checkbox';
    input.checked = settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      saveSettings(settings);
      applySettings(settings);
      applyToView();
    });
    return el('label', { className: 'mixer-row' }, [input, ` ${label}`]);
  };
  const select = <K extends 'textScale' | 'scale'>(label: string, key: K, options: [Settings[K], string][]): HTMLElement => {
    const sel = el('select');
    for (const [v, text] of options) {
      const o = el('option', { text });
      o.value = String(v);
      o.selected = settings[key] === v;
      sel.append(o);
    }
    sel.setAttribute('aria-label', label);
    sel.addEventListener('change', () => {
      settings[key] = Number(sel.value) as Settings[K];
      saveSettings(settings);
      applySettings(settings);
      sizeBoard();
    });
    return el('label', { className: 'mixer-row' }, [el('span', { text: label }), sel]);
  };
  const themeSelect = (): HTMLElement => {
    const sel = el('select');
    for (const name of PICKABLE) {
      const o = el('option', { text: THEMES[name].label });
      o.value = name;
      o.selected = settings.theme === name;
      sel.append(o);
    }
    sel.setAttribute('aria-label', 'Theme');
    sel.addEventListener('change', () => {
      settings.theme = sel.value === 'contrast' ? 'contrast' : 'hall';
      saveSettings(settings);
      applySettings(settings);
      applyTheme();
    });
    return el('label', { className: 'mixer-row' }, [el('span', { text: 'Theme' }), sel]);
  };
  const settingsPanel = el('details', { className: 'desk-menu mixer settings' }, [
    el('summary', { className: 'btn btn--menu', text: 'Settings' }),
    el('div', { className: 'desk-panel desk-column' }, [
    check('Reduce motion', 'reducedMotion'),
    check('Steady torches (no flicker)', 'noFlicker'),
    check('Colour-blind safe bars', 'safeColours'),
    themeSelect(),
    select('Text size', 'textScale', [
      [100, '100%'],
      [125, '125%'],
      [150, '150%'],
    ]),
    select('Board scale', 'scale', [
      [0, 'Fit'],
      [1, '1×'],
      [2, '2×'],
      [3, '3×'],
      [4, '4×'],
    ]),
    el('p', { className: 'settings-hint', text: 'F11 fullscreen · F3 frame timings · arrow keys move the cursor on the board, Enter uses the tool, Backspace is the right-click.' }),
    ]),
  ]);
  const hall = el('details', { className: 'desk-menu' }, [el('summary', { className: 'btn btn--menu', text: 'Hall' }), saveRow]);
  // Only one desk menu open at a time.
  const menus = [hall, mixer, settingsPanel];
  for (const m of menus) m.addEventListener('toggle', () => {
    if (m.open) for (const o of menus) if (o !== m) o.open = false;
  });
  const desk = el('div', { className: 'desk' }, [...menus, saveNote]);
  const left = el('section', { className: 'play' }, [title, hud.root, boardWrap, toolbar.root, editorPanel.root, log.root, desk]);
  boardWrap.append(profiler.root);
  app.append(el('div', { className: 'layout' }, [left, manual.root]));
  new ResizeObserver(sizeBoard).observe(left);
  window.addEventListener('resize', sizeBoard);
  sizeBoard();

  // ---------- input ----------
  let hover: Vec | null = null;
  /** Keyboard cursor on the board, for playing without a mouse. */
  let cursor: Vec | null = null;
  let painting = false;
  let digMode = true;
  /** The press in progress: where it started, whether it has become a drag, and what it hit. */
  let press: { x: number; y: number; dragging: boolean; creature: Entity | null; secondary: boolean; timer: number } | null =
    null;

  const boardPoint = (ev: PointerEvent): { bx: number; by: number; cx: number; cy: number } => {
    const rect = canvas.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    return { bx: (cx * canvas.width) / rect.width, by: (cy * canvas.height) / rect.height, cx, cy };
  };
  const tileAtPoint = (bx: number, by: number): Vec => ({ x: Math.floor(bx / TILE), y: Math.floor(by / TILE) });

  /** Apply the active tool. `secondary` is the right-click action: unmark or sell. */
  const applyTool = (tool: Tool, p: Vec, secondary: boolean, firstClick: boolean): void => {
    if (editing) {
      if (secondary) editorPanel.setBrush(Tile.Rock);
      editorPanel.paint(p.x, p.y);
      return;
    }
    if (!inBounds(state.grid, p.x, p.y) || state.status !== 'playing') return;
    const t = tileAt(state.grid, p.x, p.y);
    if (tool === 'hand') {
      if (!firstClick) return;
      if (secondary) {
        selectedId = null;
        return;
      }
      const held = state.entities.find((e) => e.id === selectedId);
      if (held) nudge(state, held, p);
      return;
    }
    if (tool === 'dig') {
      markDig(state, p.x, p.y, secondary ? false : digMode);
      return;
    }
    if (isTrapTool(tool)) {
      if (firstClick) planTrap(state, p.x, p.y, tool);
      return;
    }
    const room = TOOL_ROOM[tool];
    if (secondary) {
      if (t === room) paintRoom(state, p.x, p.y, room);
    } else if (t === Tile.Floor || (firstClick && t === room)) paintRoom(state, p.x, p.y, room);
  };

  const beginPaint = (p: Vec, secondary: boolean): void => {
    painting = true;
    if (toolbar.active === 'dig' && !secondary) {
      digMode = isRock(tileAt(state.grid, p.x, p.y)) ? !isMarked(state.grid, p.x, p.y) : true;
    }
    applyTool(toolbar.active, p, secondary, true);
  };

  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 && ev.button !== 2) return;
    const { bx, by } = boardPoint(ev);
    const p = tileAtPoint(bx, by);
    if (!inBounds(state.grid, p.x, p.y)) return;
    canvas.setPointerCapture(ev.pointerId);
    const secondary = ev.button === 2;
    // Under the Dig tool a click on a creature opens its page (dig does nothing on floor anyway);
    // room tools always paint, so wandering Coblynau cannot eat your clicks.
    const creature = secondary || (toolbar.active !== 'dig' && toolbar.active !== 'hand') ? null : entityAt(state, bx, by);
    press = { x: ev.clientX, y: ev.clientY, dragging: false, creature, secondary, timer: 0 };
    if (creature) {
      // Decide on release: a click opens the manual (and, with the Hand, picks the creature up); a drag paints.
      return;
    }
    if (ev.pointerType === 'touch' && !secondary) {
      // Touch: wait for a long press before treating it as the secondary action.
      press.timer = window.setTimeout(() => {
        if (press && !press.dragging) {
          press.secondary = true;
          beginPaint(p, true);
        }
      }, LONG_PRESS_MS);
    }
    beginPaint(p, secondary);
  });
  canvas.addEventListener('pointermove', (ev) => {
    const { bx, by, cx, cy } = boardPoint(ev);
    const p = tileAtPoint(bx, by);
    hover = inBounds(state.grid, p.x, p.y) ? p : null;
    if (hover && !painting) tooltip.show(state, hover, entityAt(state, bx, by), cx, cy);
    else tooltip.hide();
    if (!press) return;
    if (!press.dragging && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > DRAG_PX) {
      press.dragging = true;
      window.clearTimeout(press.timer);
      if (press.creature) {
        press.creature = null;
        beginPaint(p, press.secondary);
      }
    }
    if (painting && hover) applyTool(toolbar.active, p, press.secondary, false);
  });
  const release = (): void => {
    if (press) {
      window.clearTimeout(press.timer);
      if (press.creature && !press.dragging) {
        manual.open(press.creature.kind);
        if (toolbar.active === 'hand') selectedId = press.creature.id;
      }
    }
    press = null;
    painting = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    tooltip.hide();
  });

  canvas.tabIndex = 0;
  canvas.addEventListener('focus', () => {
    if (!cursor) cursor = { x: Math.floor(state.grid.w / 2), y: Math.floor(state.grid.h / 2) };
    hover = cursor;
  });
  canvas.addEventListener('blur', () => {
    cursor = null;
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement) return;
    if (ev.key === 'F3') {
      ev.preventDefault();
      profiler.toggle();
      return;
    }
    if (ev.key === 'F11') {
      ev.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen();
      else void app.requestFullscreen?.();
      return;
    }
    if (cursor && document.activeElement === canvas) {
      const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = move[ev.key];
      if (d) {
        ev.preventDefault();
        cursor = { x: Math.max(0, Math.min(state.grid.w - 1, cursor.x + d[0])), y: Math.max(0, Math.min(state.grid.h - 1, cursor.y + d[1])) };
        hover = cursor;
        tooltip.show(state, cursor, null, (cursor.x + 0.5) * (canvas.clientWidth / state.grid.w), (cursor.y + 0.5) * (canvas.clientHeight / state.grid.h));
        return;
      }
      if (ev.key === 'Enter' || ev.key === 'Backspace' || ev.key === 'Delete') {
        ev.preventDefault();
        const secondary = ev.key !== 'Enter';
        if (!secondary && toolbar.active === 'dig') digMode = isRock(tileAt(state.grid, cursor.x, cursor.y)) ? !isMarked(state.grid, cursor.x, cursor.y) : true;
        applyTool(toolbar.active, cursor, secondary, true);
        tooltip.show(state, cursor, null, (cursor.x + 0.5) * (canvas.clientWidth / state.grid.w), (cursor.y + 0.5) * (canvas.clientHeight / state.grid.h));
        return;
      }
    }
    const key = ev.key.toLowerCase();
    if (key === ' ') {
      ev.preventDefault();
      if (overlay.mode === 'confirm') return;
      setPaused(!paused);
      return;
    }
    if (key === 'escape') {
      if (overlay.mode === 'confirm') overlay.hide();
      else if (paused) setPaused(false);
      return;
    }
    if (key === 'r') {
      if (state.status === 'playing') overlay.confirmRestart();
      else restart();
      return;
    }
    if (editing && /^[0-9]$/.test(ev.key)) {
      const idx = ev.key === '0' ? 9 : Number(ev.key) - 1;
      const brush = [Tile.Rock, Tile.Gold, Tile.Floor, Tile.Heart, Tile.Portal, Tile.Gate, Tile.Lair, Tile.Hatchery, Tile.Treasury, Tile.Pool][idx];
      if (brush !== undefined) editorPanel.setBrush(brush);
      return;
    }
    const sp = Number(ev.key);
    if ((SPEEDS as readonly number[]).includes(sp)) {
      setSpeed(sp);
      return;
    }
    for (const tool of Object.keys(TOOL_KEYS) as Tool[]) {
      if (TOOL_KEYS[tool] === key) pickTool(tool);
    }
  });

  // ---------- title ----------
  const titleScreen = createTitleScreen(`${import.meta.env.BASE_URL}box-front.png`, {
    progress: Math.min(CAMPAIGN.length - 1, campaignProgress()),
    levels: CAMPAIGN.map((l) => ({ name: l.name, lesson: l.lesson })),
    hasSave: slotInfo()?.level ?? null,
  });
  app.append(titleScreen.root);
  let started = false;
  // ?start=<level id> skips the title and briefing: for audits, screenshots and quick testing.
  const quick = new URLSearchParams(window.location.search).get('start');
  const quickLevel = quick ? CAMPAIGN.find((l) => l.id === quick) : undefined;
  const chosen: Promise<import('./ui/title').TitleChoice> = quickLevel
    ? (titleScreen.root.remove(), Promise.resolve({ mode: 'campaign', index: CAMPAIGN.indexOf(quickLevel) }))
    : titleScreen.wait();
  void chosen.then(async (choice) => {
    if (choice.mode === 'campaign') {
      campaignIndex = choice.index;
      const level = CAMPAIGN[choice.index] ?? CAMPAIGN[0]!;
      if (!quickLevel) await showBriefing(app, level, choice.index);
      startLevel(level);
    } else if (choice.mode === 'sandbox') {
      campaignIndex = null;
      const level = generateSandbox(choice.seed);
      await showBriefing(app, level, null);
      startLevel(level, state.pages, choice.seed);
    } else if (choice.mode === 'load') {
      const loaded = loadFromSlot();
      if (loaded) adoptState(loaded);
      campaignIndex = CAMPAIGN.findIndex((l) => l.id === state.level.id);
      if (campaignIndex < 0) campaignIndex = null;
    } else {
      // Editor: the board shows the editor's grid; the editor panel replaces the toolbar.
      editing = true;
      campaignIndex = null;
      editorPanel.load(generateSandbox(Math.floor(Math.random() * 100000)), false);
      editorPanel.root.classList.remove('hidden');
      toolbar.root.classList.add('hidden');
    }
    started = true;
    last = performance.now();
  });

  // ---------- loop ----------
  let last = performance.now();
  let lastStatus = state.status;
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const f0 = performance.now();
    applyTheme();
    if (editing) {
      fitBoardTo(editorPanel.grid.w, editorPanel.grid.h);
      const preview = { ...state, grid: editorPanel.grid, entities: [], drops: [], traps: [], boulders: [], rubble: [], corpses: [], hunt: false };
      drawBoard(view, preview, now / 1000, hover, 1, null, false);
      requestAnimationFrame(frame);
      return;
    }
    const alpha = paused || !started || still !== null ? Math.min(1, clock.acc / TICK) : advance(state, clock, elapsed, speed);
    profiler.mark('sim', performance.now() - f0);
    const events = takeEvents(state);
    boardReact(view, state, events);
    audio.react(events, (_id, x, y) => {
      let best = Infinity;
      for (const e of state.entities) if (isHero(e)) best = Math.min(best, Math.hypot(e.x - x, e.y - y));
      return best;
    });
    const t = still === null ? now / 1000 : 0;
    if (selectedId !== null && !state.entities.some((e) => e.id === selectedId)) selectedId = null;
    drawBoard(view, state, t, hover, alpha, selectedId);
    profiler.mark('tiles', view.timings.tiles);
    profiler.mark('entities', view.timings.entities);
    profiler.mark('lighting', view.timings.lighting);
    const u0 = performance.now();
    hud.update(state, paused, speed);
    toolbar.setGold(state.gold);
    log.update(state);
    manual.setEmissary(emissary(state) !== undefined, state.gold);
    const pk = JSON.stringify(state.pages);
    if (pk !== pagesKey) {
      pagesKey = pk;
      manual.setPages(state.pages);
      savePages(state.pages);
    }
    manual.tick(t);
    profiler.mark('ui', performance.now() - u0);
    profiler.frame(performance.now() - f0, state.entities.length);
    if (state.status !== lastStatus) {
      lastStatus = state.status;
      if (state.status === 'won' && campaignIndex !== null && campaignIndex + 1 < CAMPAIGN.length) {
        const nextIndex = campaignIndex + 1;
        setCampaignProgress(nextIndex);
        overlay.show('won', {
          label: `Next: ${CAMPAIGN[nextIndex]?.name ?? ''}`,
          onNext: () => {
            campaignIndex = nextIndex;
            overlay.hide();
            const level = CAMPAIGN[nextIndex]!;
            void showBriefing(app, level, nextIndex).then(() => startLevel(level));
          },
        });
      } else {
        if (state.status === 'won' && campaignIndex !== null) setCampaignProgress(campaignIndex);
        overlay.show(state.status);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  void loadSpriteSheet(import.meta.env.BASE_URL);
}

main();
