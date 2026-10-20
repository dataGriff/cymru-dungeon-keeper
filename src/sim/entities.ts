import { APPETITE_RATE, BESTIARY, type BeastKind } from '../data/bestiary';
import type { Vec } from './grid';

export type Task =
  | 'idle'
  | 'wander'
  | 'dig'
  | 'gather'
  | 'flee'
  | 'toFood'
  | 'eat'
  | 'toBed'
  | 'sleep'
  | 'chase'
  | 'toHeart'
  | 'strike'
  | 'hold';

export interface Entity {
  id: number;
  kind: BeastKind;
  /** Tile coordinates; integers mean "centred on that tile". */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hunger: number;
  sleep: number;
  task: Task;
  /** Remaining tiles to walk, each a tile centre. */
  path: Vec[];
  /** What the current task is about: a rock to dig, a drop, a hero, a bed. */
  target: Vec | null;
  targetId: number | null;
  /** Generic task timer (dig progress, meal, nap, idle pause). */
  timer: number;
  /** Seconds until the next swing. */
  cooldown: number;
  /** Seconds until the path is recomputed. */
  repath: number;
  /** Hit flash, seconds remaining. */
  flash: number;
  /** -1 faces left, 1 faces right. */
  facing: -1 | 1;
  /** Has this hero already landed a blow on the Heart (for the log)? */
  struckHeart: boolean;
}

export interface Drop {
  x: number;
  y: number;
  gold: number;
}

export const isHero = (e: Entity): boolean => BESTIARY[e.kind].stats.allegiance === 'mortal';
export const isWorker = (e: Entity): boolean => e.kind === 'coblyn';
export const isCreature = (e: Entity): boolean => !isHero(e) && !isWorker(e);
export const hungerRate = (e: Entity): number => APPETITE_RATE[BESTIARY[e.kind].stats.appetite];
export const speedOf = (e: Entity): number => BESTIARY[e.kind].stats.speed;
export const attackOf = (e: Entity): number => BESTIARY[e.kind].stats.attack;

export function spawnEntity(id: number, kind: BeastKind, at: Vec): Entity {
  const { hp } = BESTIARY[kind].stats;
  return {
    id,
    kind,
    x: at.x,
    y: at.y,
    hp,
    maxHp: hp,
    hunger: 0,
    sleep: 0,
    task: 'idle',
    path: [],
    target: null,
    targetId: null,
    timer: 0,
    cooldown: 0,
    repath: 0,
    flash: 0,
    facing: 1,
    struckHeart: false,
  };
}

export const tileOf = (e: Entity): Vec => ({ x: Math.round(e.x), y: Math.round(e.y) });
export const distBetween = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Nearest entity satisfying `pred` within `range` tiles of `e`, or null. */
export function nearest(
  e: { x: number; y: number },
  list: readonly Entity[],
  range: number,
  pred: (o: Entity) => boolean,
): Entity | null {
  let best: Entity | null = null;
  let bestD = range;
  for (const o of list) {
    if (!pred(o)) continue;
    const d = distBetween(e, o);
    if (d <= bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
