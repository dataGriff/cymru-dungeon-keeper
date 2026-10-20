import type { Status } from '../sim/game';
import { el } from './dom';

const TEXT: Record<Exclude<Status, 'playing'>, { title: string; body: string }> = {
  won: {
    title: 'The hall stands.',
    body: 'The third wave is bones on the stair and the Heart still beats. When Arawn rides home he will find the fires lit, the hounds fed, and a steward who has learned not to count the Treasury.',
  },
  lost: {
    title: 'The Heart is struck.',
    body: 'Steel found the Heart and the long winter above ends. Below, the torches gutter one by one. The mortals will tell this as a brave tale. The manual records it as a lesson in corridors.',
  },
};

export interface Overlay {
  root: HTMLElement;
  show(status: Status): void;
}

export function createOverlay(onRestart: () => void): Overlay {
  const title = el('h2', { className: 'overlay-title' });
  const body = el('p', { className: 'overlay-body' });
  const button = el('button', { className: 'overlay-button', text: 'Take up the keys again' });
  button.addEventListener('click', onRestart);
  const card = el('div', { className: 'overlay-card' }, [title, body, button]);
  const root = el('div', { className: 'overlay hidden' }, [card]);
  return {
    root,
    show(status) {
      if (status === 'playing') {
        root.classList.add('hidden');
        return;
      }
      title.textContent = TEXT[status].title;
      body.textContent = TEXT[status].body;
      root.classList.toggle('overlay-lost', status === 'lost');
      root.classList.remove('hidden');
    },
  };
}
