import { BESTIARY, BESTIARY_ORDER, type BeastKind, MANUAL_FIRST_PAGE, MANUAL_FOOTNOTE } from '../data/bestiary';
import { drawBeast } from '../render/sprites';
import { el } from './dom';

export interface Manual {
  root: HTMLElement;
  open(kind: BeastKind): void;
  /** Call each frame so the portrait can breathe. */
  tick(t: number): void;
}

const APPETITE_LABEL: Record<string, string> = {
  none: 'None',
  low: 'Low',
  high: 'High',
  ruinous: 'Ruinous',
};

const PORTRAIT = 112;
const PORTRAIT_PX = 8; // 12x14 logical pixels at 8px = 96x112

export function createManual(): Manual {
  const header = el('div', { className: 'manual-header' });
  const tabs = el('div', { className: 'manual-tabs' });
  const portrait = el('canvas', { className: 'manual-portrait' });
  portrait.width = PORTRAIT;
  portrait.height = PORTRAIT;
  const pctx = portrait.getContext('2d');
  if (pctx) pctx.imageSmoothingEnabled = false;
  const name = el('h2', { className: 'manual-name' });
  const gloss = el('p', { className: 'manual-gloss' });
  const flavour = el('p', { className: 'manual-flavour' });
  const stats = el('dl', { className: 'manual-stats' });
  const notesTitle = el('h3', { className: 'manual-notes-title', text: 'Field notes' });
  const notes = el('ul', { className: 'manual-notes' });
  const footnote = el('p', { className: 'manual-footnote', text: MANUAL_FOOTNOTE });
  const page = el('div', { className: 'manual-page' }, [
    header,
    tabs,
    el('div', { className: 'manual-head' }, [portrait, el('div', { className: 'manual-title' }, [name, gloss])]),
    flavour,
    stats,
    notesTitle,
    notes,
    footnote,
  ]);
  const root = el('aside', { className: 'manual' }, [page]);

  const tabButtons = new Map<BeastKind, HTMLButtonElement>();
  let current: BeastKind = BESTIARY_ORDER[0] ?? 'coblyn';

  const open = (kind: BeastKind): void => {
    current = kind;
    const entry = BESTIARY[kind];
    const pageNo = MANUAL_FIRST_PAGE + BESTIARY_ORDER.indexOf(kind);
    header.textContent = `BESTIARY · p. ${pageNo}`;
    for (const [k, b] of tabButtons) b.classList.toggle('active', k === kind);
    name.textContent = entry.name;
    gloss.textContent = entry.gloss;
    flavour.textContent = entry.flavour;
    stats.replaceChildren();
    const st = entry.stats;
    const rows: [string, string][] = [
      ['Vigour', String(st.hp)],
      ['Blow', String(st.attack)],
      ['Pace', st.speed.toFixed(1)],
      ['Wage', st.wage === 0 ? '—' : `${st.wage}g`],
      ['Appetite', APPETITE_LABEL[st.appetite] ?? st.appetite],
      ['Allegiance', st.allegiance === 'hall' ? 'Hall' : 'Mortal'],
    ];
    for (const [k, v] of rows) {
      stats.append(el('dt', { text: k }), el('dd', { text: v }));
    }
    notes.replaceChildren(...entry.notes.map((n) => el('li', { text: n })));
  };

  for (const kind of BESTIARY_ORDER) {
    const b = el('button', { className: 'manual-tab', text: BESTIARY[kind].name });
    b.addEventListener('click', () => open(kind));
    tabButtons.set(kind, b);
    tabs.append(b);
  }
  open(current);

  return {
    root,
    open,
    tick(t) {
      if (!pctx) return;
      pctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
      drawBeast(pctx, current, PORTRAIT / 2, PORTRAIT - 2, PORTRAIT_PX, { t, facing: 1, moving: false });
    },
  };
}
