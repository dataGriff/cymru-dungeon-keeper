/** The page before a level: name, lesson, briefing, and a button to descend. */
import type { Level } from '../data/levels';
import { el } from './dom';

export function showBriefing(parent: HTMLElement, level: Level, index: number | null): Promise<void> {
  return new Promise((resolve) => {
    const go = el('button', { className: 'overlay-button', text: 'Descend' });
    const card = el('div', { className: 'overlay-card briefing-card' }, [
      el('div', { className: 'briefing-kicker', text: index === null ? level.lesson : `Level ${index + 1} of 5 · ${level.lesson}` }),
      el('h2', { className: 'overlay-title', text: level.name }),
      el('p', { className: 'overlay-body briefing-body', text: level.briefing }),
      go,
    ]);
    card.setAttribute('role', 'dialog');
    const root = el('div', { className: 'overlay' }, [card]);
    const done = (): void => {
      root.remove();
      window.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        done();
      }
    };
    go.addEventListener('click', done);
    window.addEventListener('keydown', onKey);
    parent.append(root);
    go.focus();
  });
}
