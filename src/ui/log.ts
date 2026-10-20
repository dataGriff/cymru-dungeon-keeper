import type { GameState } from '../sim/game';
import { el } from './dom';

export interface EventLog {
  root: HTMLElement;
  update(s: GameState): void;
}

/** Three lines, newest at the bottom, in the HUD face. */
export function createLog(lines = 3): EventLog {
  const rows = Array.from({ length: lines }, () => el('div', { className: 'log-line' }));
  const root = el('div', { className: 'log' }, rows);
  let lastKey = '';
  return {
    root,
    update(s) {
      const tail = s.log.slice(-lines);
      const key = tail.map((l) => `${l.t}:${l.text}`).join('|');
      if (key === lastKey) return;
      lastKey = key;
      rows.forEach((row, i) => {
        const line = tail[i + (lines - tail.length)];
        row.textContent = line ? line.text : '';
        row.classList.toggle('log-latest', i === lines - 1);
      });
    },
  };
}
