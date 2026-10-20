import { ROOM_COST } from '../sim/economy';
import { Tile } from '../sim/grid';
import { el } from './dom';

export type Tool = 'hand' | 'dig' | 'lair' | 'hatchery' | 'treasury' | 'pool';

export const TOOL_ROOM: Record<Exclude<Tool, 'dig' | 'hand'>, Tile.Lair | Tile.Hatchery | Tile.Treasury | Tile.Pool> = {
  lair: Tile.Lair,
  hatchery: Tile.Hatchery,
  treasury: Tile.Treasury,
  pool: Tile.Pool,
};

/** Keyboard shortcut per tool. */
export const TOOL_KEYS: Record<Tool, string> = { hand: 'g', dig: 'd', lair: 'l', hatchery: 'h', treasury: 't', pool: 'p' };

const TOOLS: { tool: Tool; label: string; hint: string }[] = [
  { tool: 'hand', label: 'Hand', hint: 'Click a creature to read its page and pick it up; click a tile to send it there. Right-click lets go.' },
  { tool: 'dig', label: 'Dig', hint: 'Mark rock for the Coblynau. Click or drag; right-click or click again to unmark. Click a creature to read its page.' },
  { tool: 'lair', label: `Lair ${ROOM_COST[Tile.Lair]}g`, hint: 'Paint onto floor. Creatures sleep here. Right-click or click again to sell for half.' },
  { tool: 'hatchery', label: `Hatchery ${ROOM_COST[Tile.Hatchery]}g`, hint: 'Paint onto floor. Creatures eat here. Right-click or click again to sell for half.' },
  { tool: 'treasury', label: `Treasury ${ROOM_COST[Tile.Treasury]}g`, hint: 'Paint onto floor. Holds your gold; bigger rooms hold more per tile. Right-click or click again to sell for half.' },
  { tool: 'pool', label: `Pool ${ROOM_COST[Tile.Pool]}g`, hint: 'Paint onto floor. The water-beasts rest here. Right-click or click again to sell for half.' },
];

export interface ToolbarHandlers {
  onTool(tool: Tool): void;
  onSound(): void;
  onPause(): void;
  onSpeed(speed: number): void;
  onRestart(): void;
}

export interface Toolbar {
  root: HTMLElement;
  active: Tool;
  setActive(tool: Tool): void;
  setSound(on: boolean): void;
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
}

export const SPEEDS = [1, 2, 3] as const;

export function createToolbar(h: ToolbarHandlers): Toolbar {
  const buttons = new Map<Tool, HTMLButtonElement>();
  const root = el('div', { className: 'toolbar' });
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Steward tools');
  for (const { tool, label, hint } of TOOLS) {
    const key = TOOL_KEYS[tool].toUpperCase();
    const b = el('button', { className: 'tool', text: label, title: `${hint} (${key})` });
    b.setAttribute('aria-label', `${label}, key ${key}. ${hint}`);
    b.setAttribute('aria-keyshortcuts', key);
    b.addEventListener('click', () => h.onTool(tool));
    buttons.set(tool, b);
    root.append(b);
  }
  const gap = el('span', { className: 'toolbar-gap' });
  const pause = el('button', { className: 'tool tool-pause', text: 'Pause', title: 'Pause the hall (Space)' });
  pause.setAttribute('aria-keyshortcuts', 'Space');
  pause.addEventListener('click', h.onPause);
  const speedButtons = SPEEDS.map((sp) => {
    const b = el('button', { className: 'tool tool-speed', text: `${sp}×`, title: `Speed ${sp}× (${sp})` });
    b.setAttribute('aria-keyshortcuts', String(sp));
    b.addEventListener('click', () => h.onSpeed(sp));
    return b;
  });
  const restart = el('button', { className: 'tool', text: 'Restart', title: 'Start again (R)' });
  restart.setAttribute('aria-keyshortcuts', 'R');
  restart.addEventListener('click', h.onRestart);
  const sound = el('button', { className: 'tool tool-sound', text: 'Sound: off', title: 'Three drones and a dripping roof.' });
  sound.addEventListener('click', h.onSound);
  root.append(gap, pause, ...speedButtons, restart, sound);
  const bar: Toolbar = {
    root,
    active: 'dig',
    setActive(tool) {
      bar.active = tool;
      for (const [k, b] of buttons) {
        b.classList.toggle('active', k === tool);
        b.setAttribute('aria-pressed', String(k === tool));
      }
    },
    setSound(on) {
      sound.textContent = on ? 'Sound: on' : 'Sound: off';
      sound.classList.toggle('active', on);
      sound.setAttribute('aria-pressed', String(on));
    },
    setPaused(paused) {
      pause.textContent = paused ? 'Resume' : 'Pause';
      pause.classList.toggle('active', paused);
      pause.setAttribute('aria-pressed', String(paused));
    },
    setSpeed(speed) {
      speedButtons.forEach((b, i) => {
        b.classList.toggle('active', SPEEDS[i] === speed);
        b.setAttribute('aria-pressed', String(SPEEDS[i] === speed));
      });
    },
  };
  bar.setActive('dig');
  bar.setSpeed(1);
  return bar;
}
