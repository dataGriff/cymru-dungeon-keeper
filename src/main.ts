import { createBoardView, drawBoard, entityAt } from './render/board';
import { TILE } from './render/tiles';
import { type GameState, createGame, markDig, paintRoom } from './sim/game';
import { GRID_H, GRID_W, Tile, type Vec, inBounds, isMarked, isRock, tileAt } from './sim/grid';
import { tick } from './sim/index';
import { createCaveAudio } from './ui/audio';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { createLog } from './ui/log';
import { createManual } from './ui/manual';
import { createOverlay } from './ui/overlay';
import { TOOL_ROOM, type Tool, createToolbar } from './ui/toolbar';

const STEP = 1 / 60;

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('#app missing');

  let state: GameState = createGame();

  const canvas = el('canvas', { className: 'board' });
  const view = createBoardView(canvas, GRID_W, GRID_H);
  const hud = createHud();
  const log = createLog(3);
  const manual = createManual();
  const audio = createCaveAudio();
  const overlay = createOverlay(() => {
    state = createGame();
    overlay.show('playing');
  });
  const toolbar = createToolbar(
    (tool) => toolbar.setActive(tool),
    () => {
      void audio.toggle().then((on) => toolbar.setSound(on));
    },
  );

  const title = el('header', { className: 'masthead' }, [
    el('h1', { text: 'Steward of Annwn' }),
    el('p', { className: 'strap', text: 'Arawn rides with the Hunt. Keep his hall until he returns.' }),
  ]);
  const boardWrap = el('div', { className: 'board-wrap' }, [canvas, overlay.root]);
  const left = el('section', { className: 'play' }, [title, hud.root, boardWrap, toolbar.root, log.root]);
  app.append(el('div', { className: 'layout' }, [left, manual.root]));

  // ---------- input ----------
  let hover: Vec | null = null;
  let painting = false;
  let digMode = true;

  const tileFromEvent = (ev: PointerEvent): Vec => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: Math.floor(((ev.clientX - rect.left) * sx) / TILE),
      y: Math.floor(((ev.clientY - rect.top) * sy) / TILE),
    };
  };

  const applyTool = (tool: Tool, p: Vec, firstClick: boolean): void => {
    if (!inBounds(state.grid, p.x, p.y) || state.status !== 'playing') return;
    if (tool === 'dig') {
      markDig(state, p.x, p.y, digMode);
      return;
    }
    const room = TOOL_ROOM[tool];
    const t = tileAt(state.grid, p.x, p.y);
    if (t === Tile.Floor || (firstClick && t === room)) paintRoom(state, p.x, p.y, room);
  };

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const hit = entityAt(state, (ev.clientX - rect.left) * sx, (ev.clientY - rect.top) * sy);
    if (hit) {
      manual.open(hit.kind);
      return;
    }
    const p = tileFromEvent(ev);
    if (!inBounds(state.grid, p.x, p.y)) return;
    if (toolbar.active === 'dig') digMode = isRock(tileAt(state.grid, p.x, p.y)) ? !isMarked(state.grid, p.x, p.y) : true;
    painting = true;
    canvas.setPointerCapture(ev.pointerId);
    applyTool(toolbar.active, p, true);
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = tileFromEvent(ev);
    hover = inBounds(state.grid, p.x, p.y) ? p : null;
    if (painting) applyTool(toolbar.active, p, false);
  });
  const stop = (): void => {
    painting = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
  });
  window.addEventListener('keydown', (ev) => {
    const keys: Record<string, Tool> = { '1': 'dig', '2': 'lair', '3': 'hatchery', '4': 'treasury' };
    const tool = keys[ev.key];
    if (tool) toolbar.setActive(tool);
  });

  // ---------- loop ----------
  let last = performance.now();
  let acc = 0;
  let lastStatus = state.status;
  const frame = (now: number): void => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      tick(state, STEP);
      acc -= STEP;
    }
    const t = now / 1000;
    drawBoard(view, state, t, hover);
    hud.update(state);
    log.update(state);
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
