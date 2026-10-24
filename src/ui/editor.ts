/**
 * The level editor: a palette of tiles painted onto a grid, a few fields,
 * and Play / Export / Import. Output is a Level the loader accepts.
 */
import { ALL_DENIZENS, type Level, endlessSchedule, validateLevel } from '../data/levels';
import { type Grid, Tile, createGrid, gridFromRows, setTile } from '../sim/grid';
import { mulberry32 } from '../sim/rng';
import { levelFromGrid, parseLevel } from '../sim/sandbox';
import { el } from './dom';

export const PALETTE: { tile: Tile; label: string; key: string }[] = [
  { tile: Tile.Rock, label: 'Rock', key: '1' },
  { tile: Tile.Gold, label: 'Gold seam', key: '2' },
  { tile: Tile.Floor, label: 'Floor', key: '3' },
  { tile: Tile.Heart, label: 'Heart', key: '4' },
  { tile: Tile.Portal, label: 'Portal', key: '5' },
  { tile: Tile.Gate, label: 'Gate', key: '6' },
  { tile: Tile.Lair, label: 'Lair', key: '7' },
  { tile: Tile.Hatchery, label: 'Hatchery', key: '8' },
  { tile: Tile.Treasury, label: 'Treasury', key: '9' },
  { tile: Tile.Pool, label: 'Pool', key: '0' },
];

export interface Editor {
  root: HTMLElement;
  grid: Grid;
  brush: Tile;
  setBrush(t: Tile): void;
  paint(x: number, y: number): void;
  /** The level as currently drawn, or the validation errors. */
  build(): { level: Level } | { errors: string[] };
  /** Replace the grid (after an import); `keepText` false keeps the current name, gold and briefing. */
  load(level: Level, keepText?: boolean): void;
}

export function createEditor(handlers: { onPlay(level: Level): void; onGridChange(): void }): Editor {
  const grid = createGrid(32, 20);
  const name = el('input');
  name.value = 'My hall';
  name.placeholder = 'Name';
  const gold = el('input');
  gold.type = 'number';
  gold.value = '150';
  gold.min = '0';
  const briefing = el('textarea');
  briefing.value = 'A hall of my own drawing. The stair is where I put it, which is the trouble.';
  briefing.rows = 2;
  const status = el('p', { className: 'editor-status' });
  const brushes = new Map<Tile, HTMLButtonElement>();
  const palette = el('div', { className: 'editor-palette' });
  palette.setAttribute('role', 'toolbar');
  const editor: Editor = {
    root: el('div'),
    grid,
    brush: Tile.Floor,
    setBrush(t) {
      editor.brush = t;
      for (const [k, b] of brushes) {
        b.classList.toggle('active', k === t);
        b.setAttribute('aria-pressed', String(k === t));
      }
    },
    paint(x, y) {
      if (x < 0 || y < 0 || x >= editor.grid.w || y >= editor.grid.h) return;
      // One Heart and one Portal: painting a new one moves it.
      if (editor.brush === Tile.Heart || editor.brush === Tile.Portal) {
        for (let i = 0; i < editor.grid.tiles.length; i++) if (editor.grid.tiles[i] === editor.brush) editor.grid.tiles[i] = Tile.Floor;
      }
      setTile(editor.grid, x, y, editor.brush);
      handlers.onGridChange();
    },
    build() {
      const id = name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hall';
      try {
        const level = levelFromGrid(editor.grid, {
          id,
          name: name.value.trim() || 'My hall',
          briefing: briefing.value.trim() || 'A hall of my own drawing.',
          lesson: 'Your own.',
          startGold: Math.max(0, Number(gold.value) || 0),
          allowed: ALL_DENIZENS,
          schedule: endlessSchedule(8),
        });
        return { level };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { errors: msg.replace('level is not sound: ', '').split('; ') };
      }
    },
    load(level, keepText = true) {
      const g = gridFromRows(level.rows, 0, mulberry32(1));
      editor.grid.w = g.w;
      editor.grid.h = g.h;
      editor.grid.tiles = g.tiles;
      editor.grid.marked = g.marked;
      if (keepText) {
        name.value = level.name;
        gold.value = String(level.startGold);
        briefing.value = level.briefing;
      }
      handlers.onGridChange();
    },
  };
  for (const { tile, label, key } of PALETTE) {
    const b = el('button', { className: 'btn btn--small', text: label, title: `Paint ${label} (${key})` });
    b.addEventListener('click', () => editor.setBrush(tile));
    brushes.set(tile, b);
    palette.append(b);
  }
  editor.setBrush(Tile.Floor);
  const play = el('button', { className: 'btn btn--small', text: 'Validate & play' });
  play.addEventListener('click', () => {
    const r = editor.build();
    if ('errors' in r) {
      status.textContent = `Not yet: ${r.errors.join('; ')}`;
      return;
    }
    status.textContent = '';
    handlers.onPlay(r.level);
  });
  const exportBtn = el('button', { className: 'btn btn--small', text: 'Export level' });
  exportBtn.addEventListener('click', () => {
    const r = editor.build();
    if ('errors' in r) {
      status.textContent = `Not yet: ${r.errors.join('; ')}`;
      return;
    }
    const blob = new Blob([JSON.stringify(r.level, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${r.level.id}.level.json`;
    a.click();
    status.textContent = `Exported ${a.download}.`;
  });
  const importBtn = el('button', { className: 'btn btn--small', text: 'Import level' });
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      void f.text().then((text) => {
        try {
          editor.load(parseLevel(text));
          status.textContent = 'Loaded.';
        } catch (e) {
          status.textContent = e instanceof Error ? e.message : String(e);
        }
      });
    });
    input.click();
  });
  const clear = el('button', { className: 'btn btn--small', text: 'Fill with rock' });
  clear.addEventListener('click', () => {
    editor.grid.tiles.fill(Tile.Rock);
    handlers.onGridChange();
  });
  editor.root = el('div', { className: 'editor' }, [
    el('div', { className: 'editor-row' }, [el('label', { text: 'Name ' }, [name]), el('label', { text: 'Start gold ' }, [gold])]),
    el('label', { className: 'editor-brief', text: 'Briefing ' }, [briefing]),
    palette,
    el('div', { className: 'toolbar' }, [play, exportBtn, importBtn, clear]),
    status,
  ]);
  void validateLevel;
  return editor;
}
