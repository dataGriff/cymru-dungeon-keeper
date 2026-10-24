/**
 * Free play: a generated map with a seed, and the editor's helpers for
 * turning a grid back into a level that the loader accepts.
 */
import { type Level, endlessSchedule, validateLevel } from '../data/levels';
import { type Grid, Tile, createGrid, rowsFromGrid, setTile, tileAt } from './grid';
import { type Rng, mulberry32, randInt } from './rng';

export const SANDBOX_W = 32;
export const SANDBOX_H = 20;

/** Carve a few random caves into rock with a drunken walk, then seams. */
function carve(g: Grid, rng: Rng): void {
  const walks = 6;
  for (let i = 0; i < walks; i++) {
    let x = randInt(rng, 4, g.w - 5);
    let y = randInt(rng, 3, g.h - 4);
    for (let n = 0; n < 24; n++) {
      setTile(g, x, y, Tile.Floor);
      const d = randInt(rng, 0, 3);
      x = Math.max(2, Math.min(g.w - 3, x + (d === 0 ? 1 : d === 1 ? -1 : 0)));
      y = Math.max(2, Math.min(g.h - 3, y + (d === 2 ? 1 : d === 3 ? -1 : 0)));
    }
  }
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (tileAt(g, x, y) === Tile.Rock && rng() < 0.08) setTile(g, x, y, Tile.Gold);
}

/** A sandbox map: the steward's chamber on the left, two Gates on the right, caves between. */
export function generateSandbox(seed: number): Level {
  const rng = mulberry32(seed);
  const g = createGrid(SANDBOX_W, SANDBOX_H);
  carve(g, rng);
  const hx = 4;
  const hy = Math.floor(SANDBOX_H / 2);
  for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx - 2; x <= hx + 2; x++) setTile(g, x, y, Tile.Floor);
  setTile(g, hx, hy, Tile.Heart);
  setTile(g, hx - 2, hy - 2, Tile.Portal);
  const gy1 = randInt(rng, 3, Math.floor(SANDBOX_H / 2) - 2);
  const gy2 = randInt(rng, Math.floor(SANDBOX_H / 2) + 2, SANDBOX_H - 4);
  for (const gy of [gy1, gy2]) {
    setTile(g, SANDBOX_W - 1, gy, Tile.Gate);
    setTile(g, SANDBOX_W - 2, gy, Tile.Floor);
  }
  // A small pool somewhere in the rock.
  const px = randInt(rng, 10, SANDBOX_W - 8);
  const py = randInt(rng, 2, SANDBOX_H - 4);
  for (let y = py; y < py + 2; y++) for (let x = px; x < px + 3; x++) setTile(g, x, y, Tile.Pool);
  return levelFromGrid(g, {
    id: `sandbox-${seed}`,
    name: `Sandbox ${seed}`,
    briefing: `A hall nobody dug on purpose. Seed ${seed}. The waves do not stop.`,
    lesson: 'Free play.',
    startGold: 200,
    allowed: ['cwn', 'pwca', 'gwyllgi', 'ceffyl', 'afanc', 'teg'],
    schedule: endlessSchedule(),
  });
}

export interface LevelMeta {
  id: string;
  name: string;
  briefing: string;
  lesson: string;
  startGold: number;
  allowed: Level['allowed'];
  schedule: Level['schedule'];
  win?: Level['win'];
}

/** The editor's export: a grid plus metadata becomes a level the loader accepts. */
export function levelFromGrid(g: Grid, meta: LevelMeta): Level {
  const level: Level = {
    id: meta.id,
    name: meta.name,
    briefing: meta.briefing,
    lesson: meta.lesson,
    width: g.w,
    height: g.h,
    rows: rowsFromGrid(g),
    startGold: meta.startGold,
    goldFraction: 0,
    allowed: meta.allowed,
    schedule: meta.schedule,
    win: meta.win ?? { kind: 'waves' },
  };
  const errors = validateLevel(level);
  if (errors.length > 0) throw new Error(`level is not sound: ${errors.join('; ')}`);
  return level;
}

/** Parse a level file (JSON) and validate it. */
export function parseLevel(json: string): Level {
  const level = JSON.parse(json) as Level;
  const errors = validateLevel(level);
  if (errors.length > 0) throw new Error(`level is not sound: ${errors.join('; ')}`);
  return level;
}
