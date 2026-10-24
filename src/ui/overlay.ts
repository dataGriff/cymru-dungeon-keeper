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

export type OverlayMode = 'hidden' | 'won' | 'lost' | 'paused' | 'confirm';

export interface Overlay {
  root: HTMLElement;
  mode: OverlayMode;
  /** `next` is the label of a second button (e.g. the next level), if any. */
  show(status: Status, next?: { label: string; onNext: () => void }): void;
  pause(): void;
  confirmRestart(): void;
  hide(): void;
}

export function createOverlay(handlers: { onRestart: () => void; onResume: () => void; onTitle: () => void }): Overlay {
  const title = el('h2', { className: 'overlay-title' });
  const body = el('p', { className: 'overlay-body' });
  const primary = el('button', { className: 'btn btn--primary' });
  const secondary = el('button', { className: 'btn btn--ghost' });
  const toTitle = el('button', { className: 'btn btn--ghost', text: 'Back to the title' });
  toTitle.addEventListener('click', handlers.onTitle);
  const buttons = el('div', { className: 'overlay-buttons' }, [primary, secondary, toTitle]);
  const card = el('div', { className: 'overlay-card' }, [title, body, buttons]);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'overlay-title');
  title.id = 'overlay-title';
  const root = el('div', { className: 'overlay hidden' }, [card]);

  const overlay: Overlay = {
    root,
    mode: 'hidden',
    show(status, next) {
      if (status === 'playing') {
        overlay.hide();
        return;
      }
      overlay.mode = status;
      root.classList.remove('overlay-pause');
      title.textContent = TEXT[status].title;
      body.textContent = TEXT[status].body;
      toTitle.classList.remove('hidden');
      if (next) {
        primary.textContent = next.label;
        primary.onclick = next.onNext;
        secondary.textContent = 'Play this hall again';
        secondary.onclick = handlers.onRestart;
        secondary.classList.remove('hidden');
      } else {
        primary.textContent = 'Take up the keys again';
        primary.onclick = handlers.onRestart;
        secondary.classList.add('hidden');
      }
      root.classList.toggle('overlay-lost', status === 'lost');
      root.classList.remove('hidden');
      primary.focus();
    },
    pause() {
      overlay.mode = 'paused';
      title.textContent = 'The hall holds its breath.';
      body.textContent = 'Nothing moves below while the steward thinks, but marks and rooms may still be laid. The torches, being torches, carry on.';
      primary.textContent = 'Resume (Space)';
      primary.onclick = handlers.onResume;
      secondary.classList.add('hidden');
      toTitle.classList.add('hidden');
      root.classList.remove('overlay-lost');
      root.classList.add('overlay-pause');
      root.classList.remove('hidden');
    },
    confirmRestart() {
      overlay.mode = 'confirm';
      root.classList.remove('overlay-pause');
      title.textContent = 'Give up the keys?';
      body.textContent = 'The hall as it stands will be forgotten and the stair will be quiet again. The manual does not record attempts.';
      primary.textContent = 'Start again';
      primary.onclick = handlers.onRestart;
      secondary.textContent = 'Keep going';
      secondary.onclick = handlers.onResume;
      secondary.classList.remove('hidden');
      toTitle.classList.add('hidden');
      root.classList.remove('overlay-lost');
      root.classList.remove('hidden');
      secondary.focus();
    },
    hide() {
      overlay.mode = 'hidden';
      root.classList.remove('overlay-pause');
      root.classList.add('hidden');
    },
  };
  return overlay;
}
