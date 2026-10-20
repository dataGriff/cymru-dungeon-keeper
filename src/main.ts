import { createBoardView, drawBoard, entityAt } from './render/board';
import { TILE } from './render/tiles';
import { nudge } from './sim/ai';
import type { Entity } from './sim/entities';
import { type GameState, type Pages, createGame, emissary, freshPages, markDig, paintRoom, trade } from './sim/game';
import { GRID_H, GRID_W, Tile, type Vec, inBounds, isMarked, isRock, tileAt } from './sim/grid';
import { TICK, advance } from './sim/index';
import { createCaveAudio } from './ui/audio';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { createLog } from './ui/log';
import { createManual } from './ui/manual';
import { createOverlay } from './ui/overlay';
import { SPEEDS, TOOL_KEYS, TOOL_ROOM, type Tool, createToolbar } from './ui/toolbar';
import { createTooltip } from './ui/tooltip';

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

  const canvas = el('canvas', { className: 'board' });
  canvas.setAttribute('aria-label', 'The hall. Click or drag to mark rock and paint rooms; click a creature to read about it.');
  const view = createBoardView(canvas, GRID_W, GRID_H);
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
  const restart = (): void => {
    state = createGame(undefined, state.pages);
    clock.acc = 0;
    selectedId = null;
    paused = false;
    toolbar.setPaused(false);
    overlay.hide();
    lastStatus = 'playing';
  };
  const overlay = createOverlay({
    onRestart: restart,
    onResume: () => {
      if (overlay.mode === 'confirm') {
        overlay.hide();
        if (paused) overlay.pause();
      } else setPaused(false);
    },
  });
  const toolbar = createToolbar({
    onTool: (tool) => toolbar.setActive(tool),
    onSound: () => {
      void audio.toggle().then((on) => toolbar.setSound(on));
    },
    onPause: () => setPaused(!paused),
    onSpeed: setSpeed,
    onRestart: () => overlay.confirmRestart(),
  });

  const title = el('header', { className: 'masthead' }, [
    el('h1', { text: 'Steward of Annwn' }),
    el('p', { className: 'strap', text: 'Arawn rides with the Hunt. Keep his hall until he returns.' }),
  ]);
  const boardWrap = el('div', { className: 'board-wrap' }, [canvas, tooltip.root, overlay.root]);
  const left = el('section', { className: 'play' }, [title, hud.root, boardWrap, toolbar.root, log.root]);
  app.append(el('div', { className: 'layout' }, [left, manual.root]));

  // ---------- input ----------
  let hover: Vec | null = null;
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

  window.addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
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
    const sp = Number(ev.key);
    if ((SPEEDS as readonly number[]).includes(sp)) {
      setSpeed(sp);
      return;
    }
    for (const tool of Object.keys(TOOL_KEYS) as Tool[]) {
      if (TOOL_KEYS[tool] === key) toolbar.setActive(tool);
    }
  });

  // ---------- loop ----------
  let last = performance.now();
  let lastStatus = state.status;
  const frame = (now: number): void => {
    const elapsed = (now - last) / 1000;
    last = now;
    const alpha = paused ? Math.min(1, clock.acc / TICK) : advance(state, clock, elapsed, speed);
    const t = now / 1000;
    if (selectedId !== null && !state.entities.some((e) => e.id === selectedId)) selectedId = null;
    drawBoard(view, state, t, hover, alpha, selectedId);
    hud.update(state, paused, speed);
    log.update(state);
    manual.setEmissary(emissary(state) !== undefined, state.gold);
    const pk = JSON.stringify(state.pages);
    if (pk !== pagesKey) {
      pagesKey = pk;
      manual.setPages(state.pages);
      savePages(state.pages);
    }
    manual.tick(t);
    if (state.status !== lastStatus) {
      lastStatus = state.status;
      overlay.show(state.status);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main();
