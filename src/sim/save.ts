/**
 * Save and load. The sim state (never the render) goes to a plain JSON
 * document with a version field; `migrate` upgrades older documents. The
 * RNG's internal state is saved so a resumed game continues exactly.
 */
import { CAMPAIGN, type Level, levelById } from '../data/levels';
import type { Entity } from './entities';
import { type GameState, type Pages, createGame } from './game';
import { type Grid } from './grid';
import { mulberry32 } from './rng';

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  savedAt: number;
  /** The level id, or the whole level for sandbox and editor maps. */
  level: string | Level;
  state: Omit<GameState, 'rng' | 'grid' | 'level' | 'schedule' | 'events'> & {
    rngState: number;
    grid: { w: number; h: number; tiles: number[]; marked: number[] };
  };
}

export function serialize(s: GameState): SaveData {
  const { rng, grid, level, schedule, events, ...rest } = s;
  void schedule;
  void events;
  const known = CAMPAIGN.find((l) => l.id === level.id && l === level);
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    level: known ? level.id : level,
    state: {
      ...structuredClone(rest),
      rngState: rng.state,
      grid: { w: grid.w, h: grid.h, tiles: Array.from(grid.tiles), marked: Array.from(grid.marked) },
    },
  };
}

/** Upgrade an older document to the current version. Add a case per version bump. */
export function migrate(data: SaveData): SaveData {
  const out = { ...data };
  switch (out.version) {
    case SAVE_VERSION:
      return out;
    default:
      throw new Error(`save version ${String(out.version)} is not supported`);
  }
}

export function deserialize(raw: SaveData): GameState {
  const data = migrate(raw);
  const level = typeof data.level === 'string' ? levelById(data.level) : data.level;
  if (!level) throw new Error(`unknown level ${String(data.level)}`);
  const { rngState, grid: g, ...rest } = data.state;
  const base = createGame(rest.seed, rest.pages as Pages, level);
  const rng = mulberry32(0);
  rng.state = rngState;
  const grid: Grid = { w: g.w, h: g.h, tiles: Uint8Array.from(g.tiles), marked: Uint8Array.from(g.marked) };
  const s: GameState = {
    ...base,
    ...structuredClone(rest),
    rng,
    grid,
    level,
    schedule: level.schedule,
    events: [],
    entities: rest.entities.map((e) => ({ ...e }) as Entity),
  };
  return s;
}

export const toJSON = (s: GameState): string => JSON.stringify(serialize(s));
export const fromJSON = (json: string): GameState => deserialize(JSON.parse(json) as SaveData);
