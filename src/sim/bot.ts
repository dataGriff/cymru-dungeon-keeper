/**
 * A reasonable player, scripted. It does what the manual tells a first-time
 * steward to do: dig out room, lay a bent corridor to the Gate, build a
 * Treasury, then a Lair and Hatchery for the hounds, then grow. It is used
 * by the balance test (does a sensible plan survive the Cairn?) and by the
 * performance benchmark. It is not clever; that is the point. Hounds come
 * before a vault, because the first wave does not wait for your bookkeeping.
 */
import type { TradeKind } from '../data/bestiary';
import { ROOM_COST } from './economy';
import { isCreature } from './entities';
import { type GameState, emissary, markDig, paintRoom, planTrap, trade } from './game';
import { GATE_POS, HEART_POS, type RoomTile, Tile, type Vec, tileAt } from './grid';

export interface BotOptions {
  /** Lay traps in the corridor once the rooms are up. */
  traps?: boolean;
  /** Deal with the emissary. */
  trades?: boolean;
}

interface Plan {
  room: RoomTile;
  tiles: Vec[];
}

/** Rooms in the order a sensible steward builds them, with where. */
function plans(): Plan[] {
  const hx = HEART_POS.x;
  const hy = HEART_POS.y;
  return [
    // Hounds first: a bed and a larder are what the first wave is met with.
    { room: Tile.Lair, tiles: [{ x: hx - 2, y: hy + 1 }, { x: hx - 1, y: hy + 1 }, { x: hx - 2, y: hy + 2 }, { x: hx - 1, y: hy + 2 }] },
    { room: Tile.Hatchery, tiles: [{ x: hx + 1, y: hy - 2 }, { x: hx + 2, y: hy - 2 }] },
    { room: Tile.Treasury, tiles: [{ x: hx + 2, y: hy + 1 }, { x: hx + 2, y: hy + 2 }] },
    { room: Tile.Lair, tiles: [{ x: hx, y: hy + 2 }, { x: hx + 1, y: hy + 2 }] },
    { room: Tile.Treasury, tiles: [{ x: hx + 2, y: hy }] },
    { room: Tile.Hatchery, tiles: [{ x: hx, y: hy - 2 }] },
    { room: Tile.Lair, tiles: [{ x: hx + 3, y: hy + 2 }, { x: hx + 4, y: hy + 2 }, { x: hx + 5, y: hy + 2 }] },
    { room: Tile.Treasury, tiles: [{ x: hx + 3, y: hy + 1 }, { x: hx + 4, y: hy + 1 }] },
  ];
}

/** Dig plan: widen the chamber to the right, then a corridor along the bottom with a bend up to the Gate. */
function digPlan(s: GameState): Vec[] {
  const out: Vec[] = [];
  const hx = HEART_POS.x;
  const hy = HEART_POS.y;
  for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx + 3; x <= hx + 6; x++) out.push({ x, y });
  const cy = hy + 2;
  for (let x = hx + 7; x <= GATE_POS.x - 2; x++) out.push({ x, y: cy });
  for (let y = cy - 1; y >= GATE_POS.y; y--) out.push({ x: GATE_POS.x - 2, y });
  // A little extra rock above the chamber for gold.
  for (let x = hx - 2; x <= hx + 2; x++) out.push({ x, y: hy - 3 });
  return out.filter((p) => p.x >= 0 && p.y >= 0 && p.x < s.grid.w && p.y < s.grid.h);
}

export type Bot = (s: GameState) => void;

export function createBot(opts: BotOptions = {}): Bot {
  let marked = false;
  let trapsLaid = 0;
  let lastAct = -Infinity;
  return (s) => {
    if (s.status !== 'playing') return;
    if (!marked) {
      marked = true;
      for (const p of digPlan(s)) markDig(s, p.x, p.y, true);
    }
    if (s.time - lastAct < 1) return;
    lastAct = s.time;
    // Build the next affordable tile of the plan, in order. After the first
    // three rooms (a vault, a bed, a larder) keep a float for wages.
    let built = 0;
    for (const plan of plans()) {
      for (const t of plan.tiles) {
        const tile = tileAt(s.grid, t.x, t.y);
        if (tile === plan.room) continue;
        if (tile !== Tile.Floor) return; // not dug yet: wait for it
        const reserve = built >= 3 ? 30 : 0;
        if (s.gold < ROOM_COST[plan.room] + reserve) return;
        paintRoom(s, t.x, t.y, plan.room);
        return;
      }
      built += 1;
    }
    if (opts.traps && trapsLaid < 3 && s.gold >= 60) {
      const cy = HEART_POS.y + 2;
      const spots: [number, number, 'pit' | 'snare' | 'boulder'][] = [
        [HEART_POS.x + 8, cy, 'snare'],
        [HEART_POS.x + 9, cy, 'pit'],
        [HEART_POS.x + 7, cy, 'boulder'],
      ];
      const [x, y, kind] = spots[trapsLaid] as [number, number, 'pit' | 'snare' | 'boulder'];
      if (tileAt(s.grid, x, y) === Tile.Floor && planTrap(s, x, y, kind) === 'planned') trapsLaid += 1;
    }
    if (opts.trades && emissary(s)) {
      const hurt = s.entities.filter((e) => isCreature(e) && e.hp < e.maxHp * 0.6).length;
      const want: TradeKind | null = s.nextWaveAt - s.time < 12 ? 'ward' : hurt >= 2 ? 'heal' : null;
      if (want) trade(s, want);
    }
  };
}
