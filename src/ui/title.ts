/**
 * The title screen: the box front, "Press any key", an optional fake DOS
 * install on first run (skippable, can be turned off), and the credits.
 */
import { el } from './dom';

const INSTALLED_KEY = 'annwn.installed.v1';
const NO_INSTALL_KEY = 'annwn.noinstall';

const INSTALL_LINES = [
  'STEWARD OF ANNWN  Setup v1.0',
  'Copyright (C) Hungovercoders. All rights reserved, some regretted.',
  '',
  'Checking memory ....................... 4096 KB OK',
  'Checking VGA .......................... 256 colours, dubious',
  'Copying ANNWN.EXE ..................... ',
  'Copying BESTIARY.DAT .................. ',
  'Copying HOUNDS.SND .................... ',
  'Copying MANUAL.TXT .................... (read it)',
  'Writing ANNWN.CFG ..................... ',
  '',
  'Installation complete. Press any key to descend.',
];

export const CREDITS = [
  'Steward of Annwn was kept by the Hungovercoders, who are not responsible for what comes through the portal.',
  'Design, code, and the voice of the manual: the steward on duty.',
  'The Cŵn Annwn, the Pwca, the Afanc, the Gwyllgi, the Ceffyl Dŵr, the Tylwyth Teg and the Coblynau are older than any of us and have appeared by their own consent, which may be withdrawn.',
  'Faces: Metamorphous, IM Fell English and VT323, with thanks to their makers.',
  'Arawn, lord of Annwn, was away for the whole of development and has not been told.',
  'No knight was harmed that did not have it coming.',
];

export interface TitleScreen {
  root: HTMLElement;
  /** Resolves when the player has pressed a key and any install is done. */
  wait(): Promise<void>;
}

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function createTitleScreen(artUrl: string): TitleScreen {
  const art = el('img', { className: 'title-art' });
  art.src = artUrl;
  art.alt = 'Steward of Annwn. A white hound with red ears faces a small knight beneath a cairn.';
  const press = el('p', { className: 'title-press', text: 'Press any key' });
  const creditsBtn = el('button', { className: 'title-button', text: 'Credits' });
  const noInstall = el('input');
  noInstall.type = 'checkbox';
  noInstall.checked = read(NO_INSTALL_KEY) === '1';
  noInstall.addEventListener('change', () => write(NO_INSTALL_KEY, noInstall.checked ? '1' : '0'));
  const options = el('label', { className: 'title-option' }, [noInstall, ' Skip the install screen']);
  const credits = el('div', { className: 'title-credits hidden' }, [
    el('h2', { text: 'Credits' }),
    ...CREDITS.map((c) => el('p', { text: c })),
    el('p', { className: 'title-credits-foot', text: 'Press any key to close.' }),
  ]);
  const install = el('pre', { className: 'title-install hidden' });
  const card = el('div', { className: 'title-card' }, [art, press, el('div', { className: 'title-row' }, [creditsBtn, options]), credits, install]);
  const root = el('div', { className: 'title' }, [card]);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Title screen');

  let showingCredits = false;
  creditsBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    showingCredits = !showingCredits;
    credits.classList.toggle('hidden', !showingCredits);
    creditsBtn.blur(); // so Enter/Space go to "any key", not back to this button
  });

  /** Any key or click (not on the controls) counts. */
  const anyKey = (): Promise<void> =>
    new Promise((resolve) => {
      const done = (ev: Event): void => {
        if (ev instanceof KeyboardEvent && (ev.key === 'Tab' || ev.key === 'Shift' || ev.key === 'Control' || ev.key === 'Alt' || ev.key === 'Meta')) return;
        if (ev instanceof KeyboardEvent && (ev.target instanceof HTMLButtonElement || ev.target instanceof HTMLInputElement)) return;
        if (ev instanceof MouseEvent && (ev.target as HTMLElement).closest('.title-row, .title-credits')) return;
        if (showingCredits) {
          showingCredits = false;
          credits.classList.add('hidden');
          return;
        }
        window.removeEventListener('keydown', done);
        root.removeEventListener('pointerdown', done);
        resolve();
      };
      window.addEventListener('keydown', done);
      root.addEventListener('pointerdown', done);
    });

  /** Three seconds of a progress bar from another decade. Any key skips it. */
  const fakeInstall = (): Promise<void> =>
    new Promise((resolve) => {
      press.classList.add('hidden');
      art.classList.add('hidden');
      install.classList.remove('hidden');
      let i = 0;
      let bar = 0;
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        window.clearInterval(timer);
        window.removeEventListener('keydown', finish);
        root.removeEventListener('pointerdown', finish);
        write(INSTALLED_KEY, '1');
        resolve();
      };
      const timer = window.setInterval(() => {
        if (i < INSTALL_LINES.length) {
          install.textContent += `${INSTALL_LINES[i]}\n`;
          i += 1;
          return;
        }
        bar += 1;
        const blocks = Math.min(20, bar);
        const lines = install.textContent?.split('\n') ?? [];
        lines[lines.length - 2] = `[${'█'.repeat(blocks)}${'░'.repeat(20 - blocks)}] ${blocks * 5}%`;
        install.textContent = lines.join('\n');
        if (bar >= 20) finish();
      }, 3000 / (INSTALL_LINES.length + 20));
      window.addEventListener('keydown', finish);
      root.addEventListener('pointerdown', finish);
    });

  return {
    root,
    async wait() {
      const firstRun = read(INSTALLED_KEY) !== '1' && read(NO_INSTALL_KEY) !== '1';
      if (firstRun) {
        await fakeInstall();
        install.classList.add('hidden');
        art.classList.remove('hidden');
        press.classList.remove('hidden');
        await new Promise((r) => setTimeout(r, 150));
      }
      await anyKey();
      root.classList.add('title-leaving');
      await new Promise((r) => setTimeout(r, 350));
      root.remove();
    },
  };
}
