import { ENGINES } from '../data/bestiary';
import { ROOM_COST } from '../sim/economy';
import { Tile } from '../sim/grid';
import { el } from './dom';
import { type IconName, iconCanvas, setIcon } from './icons';

export type Tool = 'hand' | 'dig' | 'lair' | 'hatchery' | 'treasury' | 'pool' | 'pit' | 'boulder' | 'snare';
export type TrapTool = 'pit' | 'boulder' | 'snare';
export const isTrapTool = (t: Tool): t is TrapTool => t === 'pit' || t === 'boulder' || t === 'snare';

export const TOOL_ROOM: Record<Exclude<Tool, 'dig' | 'hand' | TrapTool>, Tile.Lair | Tile.Hatchery | Tile.Treasury | Tile.Pool> = {
  lair: Tile.Lair,
  hatchery: Tile.Hatchery,
  treasury: Tile.Treasury,
  pool: Tile.Pool,
};

/** Keyboard shortcut per tool. */
export const TOOL_KEYS: Record<Tool, string> = {
  hand: 'g',
  dig: 'd',
  lair: 'l',
  hatchery: 'h',
  treasury: 't',
  pool: 'p',
  pit: 'i',
  boulder: 'b',
  snare: 's',
};

interface ToolDef {
  tool: Tool;
  label: string;
  icon: IconName;
  cost?: number;
  hint: string;
}

const GROUPS: { name: string; tools: ToolDef[] }[] = [
  {
    name: 'Steward',
    tools: [
      { tool: 'hand', label: 'Hand', icon: 'hand', hint: 'Click a creature to read its page and pick it up; click a tile to send it there. Right-click lets go.' },
      { tool: 'dig', label: 'Dig', icon: 'dig', hint: 'Mark rock for the Coblynau. Click or drag; right-click or click again to unmark. Click a creature to read its page.' },
    ],
  },
  {
    name: 'Rooms',
    tools: [
      { tool: 'lair', label: 'Lair', icon: 'lair', cost: ROOM_COST[Tile.Lair], hint: 'Paint onto floor. Creatures sleep here. Right-click or click again to sell for half.' },
      { tool: 'hatchery', label: 'Hatchery', icon: 'hatchery', cost: ROOM_COST[Tile.Hatchery], hint: 'Paint onto floor. Creatures eat here. Right-click or click again to sell for half.' },
      { tool: 'treasury', label: 'Treasury', icon: 'treasury', cost: ROOM_COST[Tile.Treasury], hint: 'Paint onto floor. Holds your gold; bigger rooms hold more per tile. Right-click or click again to sell for half.' },
      { tool: 'pool', label: 'Pool', icon: 'pool', cost: ROOM_COST[Tile.Pool], hint: 'Paint onto floor. The water-beasts rest here. Right-click or click again to sell for half.' },
    ],
  },
  {
    name: 'Engines',
    tools: [
      { tool: 'pit', label: 'Pit', icon: 'pit', cost: ENGINES.pit.stats.cost, hint: 'Plan on floor; a Coblyn digs it. Hurts and slows the first mortal to step in. Click again to cancel.' },
      { tool: 'boulder', label: 'Boulder', icon: 'boulder', cost: ENGINES.boulder.stats.cost, hint: 'Plan at the top of a straight corridor. Rolls at the first mortal in line. Click again to cancel.' },
      { tool: 'snare', label: 'Snare', icon: 'snare', cost: ENGINES.snare.stats.cost, hint: 'Plan on floor. Holds the first mortal fast for four seconds. Hurts the Fair Folk. Click again to cancel.' },
    ],
  },
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
  /** Grey out what the purse cannot pay for. */
  setGold(gold: number): void;
}

export const SPEEDS = [1, 2, 3] as const;

const group = (name: string, children: HTMLElement[]): HTMLElement => {
  const g = el('div', { className: 'tool-group' }, [el('span', { className: 'tool-group-name', text: name }), el('div', { className: 'tool-group-row' }, children)]);
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', name);
  return g;
};

export function createToolbar(h: ToolbarHandlers): Toolbar {
  const buttons = new Map<Tool, HTMLButtonElement>();
  const costs: { b: HTMLButtonElement; cost: number }[] = [];
  const root = el('div', { className: 'toolbar' });
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Steward tools');
  for (const { name, tools } of GROUPS) {
    const row: HTMLElement[] = [];
    for (const { tool, label, icon, cost, hint } of tools) {
      const key = TOOL_KEYS[tool].toUpperCase();
      const b = el('button', { className: 'tool tool-icon', title: `${label}${cost ? ` (${cost} gold)` : ''}. ${hint} Key ${key}.` });
      // The visible contents are the accessible name ("Lair 15 gold"); the hint is the description.
      b.append(iconCanvas(icon, icon === 'pit' || icon === 'boulder' || icon === 'snare' ? 1.5 : 2));
      b.append(el('span', { className: 'tool-label', text: label }));
      if (cost) b.append(el('span', { className: 'tool-cost' }, [`${cost}`, el('span', { className: 'sr-only', text: ' gold' })]));
      const kbd = el('kbd', { className: 'tool-key', text: key });
      kbd.setAttribute('aria-hidden', 'true');
      b.append(kbd);
      b.setAttribute('aria-keyshortcuts', key);
      b.addEventListener('click', () => h.onTool(tool));
      buttons.set(tool, b);
      if (cost) costs.push({ b, cost });
      row.push(b);
    }
    root.append(group(name, row));
  }
  const pauseIcon = iconCanvas('pause', 2);
  const pause = el('button', { className: 'tool tool-square', title: 'Pause the hall (Space)' }, [pauseIcon]);
  pause.setAttribute('aria-label', 'Pause, key Space');
  pause.setAttribute('aria-keyshortcuts', 'Space');
  pause.addEventListener('click', h.onPause);
  const speedButtons = SPEEDS.map((sp) => {
    const b = el('button', { className: 'tool tool-square tool-speed', text: `${sp}×`, title: `Speed ${sp}× (${sp})` });
    b.setAttribute('aria-keyshortcuts', String(sp));
    b.addEventListener('click', () => h.onSpeed(sp));
    return b;
  });
  const restart = el('button', { className: 'tool tool-square', title: 'Start again (R)' }, [iconCanvas('restart', 2)]);
  restart.setAttribute('aria-label', 'Restart, key R');
  restart.setAttribute('aria-keyshortcuts', 'R');
  restart.addEventListener('click', h.onRestart);
  const soundIcon = iconCanvas('horn', 2);
  const soundLabel = el('span', { className: 'tool-label', text: 'Off' });
  const sound = el('button', { className: 'tool tool-sound', title: 'Sound: three drones and a dripping roof.' }, [soundIcon, soundLabel]);
  sound.setAttribute('aria-label', 'Sound: off');
  sound.addEventListener('click', h.onSound);
  root.append(group('Time', [pause, ...speedButtons, restart]), group('Sound', [sound]));
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
      soundLabel.textContent = on ? 'On' : 'Off';
      sound.classList.toggle('active', on);
      sound.setAttribute('aria-pressed', String(on));
      sound.setAttribute('aria-label', `Sound: ${on ? 'on' : 'off'}`);
    },
    setPaused(paused) {
      setIcon(pauseIcon, paused ? 'play' : 'pause', 2);
      pause.classList.toggle('active', paused);
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Resume, key Space' : 'Pause, key Space');
    },
    setSpeed(speed) {
      speedButtons.forEach((b, i) => {
        b.classList.toggle('active', SPEEDS[i] === speed);
        b.setAttribute('aria-pressed', String(SPEEDS[i] === speed));
      });
    },
    setGold(gold) {
      for (const { b, cost } of costs) b.classList.toggle('tool-poor', gold < cost);
    },
  };
  bar.setActive('dig');
  bar.setSpeed(1);
  return bar;
}
