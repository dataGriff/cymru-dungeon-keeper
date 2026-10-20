import {
  BESTIARY,
  BESTIARY_ORDER,
  type BeastKind,
  ENGINES,
  ENGINE_ORDER,
  type EngineKind,
  MANUAL_ENGINES_FIRST_PAGE,
  MANUAL_FIRST_PAGE,
  MANUAL_FOOTNOTE,
  TRADES,
  type TradeKind,
} from '../data/bestiary';
import { drawBeast, drawEngine } from '../render/sprites';
import type { Pages } from '../sim/game';
import { el } from './dom';

export interface Manual {
  root: HTMLElement;
  open(kind: BeastKind): void;
  /** Turn to the Engines of the Hall section. */
  openEngine(kind: EngineKind): void;
  /** Unlock state per page; re-renders the open page when it changes. */
  setPages(pages: Pages): void;
  /** Show (or hide) the emissary's trade card. */
  setEmissary(present: boolean, gold: number): void;
  /** Call each frame so the portrait can breathe. */
  tick(t: number): void;
}

export interface ManualHandlers {
  onTrade(kind: TradeKind): void;
}

const APPETITE_LABEL: Record<string, string> = {
  none: 'None',
  low: 'Low',
  high: 'High',
  ruinous: 'Ruinous',
};

const PORTRAIT = 112;
const PORTRAIT_PX = 8; // 12x14 logical pixels at 8px = 96x112

export function createManual(h: ManualHandlers): Manual {
  const header = el('div', { className: 'manual-header' });
  let pages: Pages | null = null;
  /** When set, the page shows an engine instead of a beast. */
  let engine: EngineKind | null = null;
  const engineTabs = el('div', { className: 'manual-tabs manual-tabs-engines' });
  engineTabs.setAttribute('role', 'tablist');
  engineTabs.setAttribute('aria-label', 'Engines of the Hall');
  const engineButtons = new Map<EngineKind, HTMLButtonElement>();
  const sectionLabel = el('div', { className: 'manual-section' });
  const faded = el('p', { className: 'manual-faded hidden', text: 'The page is faded. Something must be seen in the hall before it can be read.' });
  const notesFaded = el('p', { className: 'manual-faded hidden', text: 'The field notes are blank. They are written after a wave is weathered.' });
  // The emissary's card.
  const tradeTitle = el('div', { className: 'manual-trade-title', text: 'A WORD WITH THE EMISSARY' });
  const tradeText = el('p', { className: 'manual-trade-text', text: 'The emissary has terms, and a minute.' });
  const tradeButtons = (Object.keys(TRADES) as TradeKind[]).map((k) => {
    const b = el('button', { className: 'manual-trade-button', text: `${TRADES[k].label} · ${TRADES[k].cost}g`, title: TRADES[k].text });
    b.addEventListener('click', () => h.onTrade(k));
    return b;
  });
  const trade = el('div', { className: 'manual-trade hidden' }, [tradeTitle, tradeText, el('div', { className: 'manual-trade-buttons' }, tradeButtons)]);
  const tabs = el('div', { className: 'manual-tabs' });
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Bestiary entries');
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
    trade,
    sectionLabel,
    tabs,
    engineTabs,
    el('div', { className: 'manual-head' }, [portrait, el('div', { className: 'manual-title' }, [name, gloss])]),
    faded,
    flavour,
    stats,
    notesTitle,
    notes,
    notesFaded,
    footnote,
  ]);
  const root = el('aside', { className: 'manual' }, [page]);

  const tabButtons = new Map<BeastKind, HTMLButtonElement>();
  let current: BeastKind = BESTIARY_ORDER[0] ?? 'coblyn';

  const stateOf = (kind: BeastKind): 'unseen' | 'seen' | 'studied' => pages?.[kind] ?? 'studied';

  const openEngine = (kind: EngineKind): void => {
    engine = kind;
    const entry = ENGINES[kind];
    header.textContent = `ENGINES OF THE HALL · p. ${MANUAL_ENGINES_FIRST_PAGE + ENGINE_ORDER.indexOf(kind)}`;
    sectionLabel.textContent = 'Engines of the Hall';
    for (const [k, b] of engineButtons) {
      b.classList.toggle('active', k === kind);
      b.setAttribute('aria-selected', String(k === kind));
    }
    for (const [, b] of tabButtons) {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    }
    faded.classList.add('hidden');
    flavour.classList.remove('hidden');
    stats.classList.remove('hidden');
    notesTitle.classList.remove('hidden');
    notes.classList.remove('hidden');
    notesFaded.classList.add('hidden');
    name.textContent = entry.name;
    gloss.textContent = entry.gloss;
    flavour.textContent = entry.flavour;
    stats.replaceChildren();
    const st = entry.stats;
    const rows: [string, string][] = [
      ['Cost', `${st.cost}g`],
      ['Labour', `${st.build}s`],
      [kind === 'snare' ? 'Bite' : 'Blow', kind === 'snare' ? `${st.damage}/s` : String(st.damage)],
      [kind === 'boulder' ? 'Reach' : kind === 'pit' ? 'Slow' : 'Hold', kind === 'boulder' ? `${st.effect} tiles` : `${st.effect}s`],
      ['Uses', 'One'],
      ['Builder', 'Coblyn'],
    ];
    for (const [k, v] of rows) stats.append(el('dt', { text: k }), el('dd', { text: v }));
    notes.replaceChildren(...entry.notes.map((n) => el('li', { text: n })));
  };

  const open = (kind: BeastKind): void => {
    engine = null;
    current = kind;
    const entry = BESTIARY[kind];
    const state = stateOf(kind);
    const pageNo = MANUAL_FIRST_PAGE + BESTIARY_ORDER.indexOf(kind);
    header.textContent = `BESTIARY · p. ${pageNo}`;
    sectionLabel.textContent = BESTIARY[kind].stats.allegiance === 'mortal' ? 'Mortals' : 'Denizens';
    for (const [, b] of engineButtons) {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    }
    faded.classList.toggle('hidden', state !== 'unseen');
    flavour.classList.toggle('hidden', state === 'unseen');
    stats.classList.toggle('hidden', state === 'unseen');
    notesTitle.classList.toggle('hidden', state === 'unseen');
    notes.classList.toggle('hidden', state !== 'studied');
    notesFaded.classList.toggle('hidden', state !== 'seen');
    for (const [k, b] of tabButtons) {
      const active = k === kind;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
      b.tabIndex = active ? 0 : -1;
    }
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
    b.classList.toggle('manual-tab-unseen', stateOf(kind) === 'unseen');
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => open(kind));
    b.addEventListener('keydown', (ev) => {
      const i = BESTIARY_ORDER.indexOf(kind);
      const n = BESTIARY_ORDER.length;
      const next =
        ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
          ? BESTIARY_ORDER[(i + 1) % n]
          : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
            ? BESTIARY_ORDER[(i + n - 1) % n]
            : ev.key === 'Home'
              ? BESTIARY_ORDER[0]
              : ev.key === 'End'
                ? BESTIARY_ORDER[n - 1]
                : undefined;
      if (!next) return;
      ev.preventDefault();
      open(next);
      tabButtons.get(next)?.focus();
    });
    tabButtons.set(kind, b);
    tabs.append(b);
  }
  for (const kind of ENGINE_ORDER) {
    const b = el('button', { className: 'manual-tab', text: ENGINES[kind].name });
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => openEngine(kind));
    engineButtons.set(kind, b);
    engineTabs.append(b);
  }
  page.setAttribute('role', 'tabpanel');
  page.setAttribute('aria-live', 'polite');
  open(current);

  let pagesKey = '';
  let emissaryKey = '';
  return {
    root,
    open,
    openEngine,
    setPages(next) {
      const key = JSON.stringify(next);
      if (key === pagesKey) return;
      pagesKey = key;
      pages = next;
      for (const [k, b] of tabButtons) b.classList.toggle('manual-tab-unseen', stateOf(k) === 'unseen');
      open(current);
    },
    setEmissary(present, gold) {
      const key = `${present}:${gold}`;
      if (key === emissaryKey) return;
      emissaryKey = key;
      trade.classList.toggle('hidden', !present);
      (Object.keys(TRADES) as TradeKind[]).forEach((k, i) => {
        const b = tradeButtons[i];
        if (b) b.disabled = gold < TRADES[k].cost;
      });
    },
    tick(t) {
      if (!pctx) return;
      pctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
      if (engine) {
        drawEngine(pctx, engine, PORTRAIT / 2, PORTRAIT / 2, 8);
        return;
      }
      drawBeast(pctx, current, PORTRAIT / 2, PORTRAIT - 2, PORTRAIT_PX, {
        t,
        facing: 1,
        moving: false,
        silhouette: stateOf(current) === 'unseen',
      });
    },
  };
}
