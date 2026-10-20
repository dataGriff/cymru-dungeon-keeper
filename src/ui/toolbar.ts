import { ROOM_COST } from '../sim/economy';
import { Tile } from '../sim/grid';
import { el } from './dom';

export type Tool = 'dig' | 'lair' | 'hatchery' | 'treasury';

export const TOOL_ROOM: Record<Exclude<Tool, 'dig'>, Tile.Lair | Tile.Hatchery | Tile.Treasury> = {
  lair: Tile.Lair,
  hatchery: Tile.Hatchery,
  treasury: Tile.Treasury,
};

const TOOLS: { tool: Tool; label: string; hint: string }[] = [
  { tool: 'dig', label: 'Dig', hint: 'Mark rock for the Coblynau. Click or drag; click again to unmark.' },
  { tool: 'lair', label: `Lair ${ROOM_COST[Tile.Lair]}g`, hint: 'Paint onto floor. Creatures sleep here. Click again to sell for half.' },
  { tool: 'hatchery', label: `Hatchery ${ROOM_COST[Tile.Hatchery]}g`, hint: 'Paint onto floor. Creatures eat here. Click again to sell for half.' },
  { tool: 'treasury', label: `Treasury ${ROOM_COST[Tile.Treasury]}g`, hint: 'Paint onto floor. Attracts the greedy. Click again to sell for half.' },
];

export interface Toolbar {
  root: HTMLElement;
  active: Tool;
  setActive(tool: Tool): void;
  setSound(on: boolean): void;
}

export function createToolbar(onTool: (t: Tool) => void, onSound: () => void): Toolbar {
  const buttons = new Map<Tool, HTMLButtonElement>();
  const root = el('div', { className: 'toolbar' });
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Steward tools');
  for (const { tool, label, hint } of TOOLS) {
    const b = el('button', { className: 'tool', text: label, title: hint });
    b.setAttribute('aria-label', `${label}. ${hint}`);
    b.addEventListener('click', () => onTool(tool));
    buttons.set(tool, b);
    root.append(b);
  }
  const sound = el('button', { className: 'tool tool-sound', text: 'Sound: off', title: 'Three drones and a dripping roof.' });
  sound.addEventListener('click', onSound);
  root.append(el('span', { className: 'toolbar-gap' }), sound);
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
  };
  bar.setActive('dig');
  return bar;
}
