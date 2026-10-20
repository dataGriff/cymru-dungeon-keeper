import { BESTIARY, HERO_DROP, type BeastKind } from '../data/bestiary';
import { GOLD_SEAM_PAYOUT, HEART_HP, ROOM_COST, STARTING_GOLD, sellPrice } from './economy';
import { type Drop, type Entity, isHero, spawnEntity } from './entities';
import {
  GATE_POS,
  type Grid,
  HEART_POS,
  PORTAL_POS,
  type RoomTile,
  Tile,
  type Vec,
  countTiles,
  createStartGrid,
  inBounds,
  isMarked,
  isRock,
  isRoom,
  setMarked,
  setTile,
  tileAt,
} from './grid';
import { type Rng, mulberry32 } from './rng';
import { FINAL_WAVE, WAVE_INTERVAL, WAVE_STAGGER, waveComposition, waveTime } from './waves';

export type Status = 'playing' | 'won' | 'lost';

export interface LogLine {
  t: number;
  text: string;
}

export interface GameState {
  grid: Grid;
  rng: Rng;
  time: number;
  gold: number;
  heartHp: number;
  status: Status;
  entities: Entity[];
  drops: Drop[];
  /** Waves that have been announced so far. */
  wave: number;
  nextWaveAt: number;
  /** Heroes still queued to step through the Gate for the current wave. */
  pendingHeroes: BeastKind[];
  spawnTimer: number;
  arrivalTimer: number;
  log: LogLine[];
  nextId: number;
}

export const ARRIVAL_INTERVAL = 7;
export const MAX_LOG = 40;

export function createGame(seed = Date.now() & 0xffffffff): GameState {
  const rng = mulberry32(seed);
  const s: GameState = {
    grid: createStartGrid(rng),
    rng,
    time: 0,
    gold: STARTING_GOLD,
    heartHp: HEART_HP,
    status: 'playing',
    entities: [],
    drops: [],
    wave: 0,
    nextWaveAt: waveTime(1),
    pendingHeroes: [],
    spawnTimer: 0,
    arrivalTimer: ARRIVAL_INTERVAL,
    log: [],
    nextId: 1,
  };
  // Three Coblynau are already at work when the steward takes the keys.
  for (const at of [
    { x: 2, y: 7 },
    { x: 4, y: 9 },
    { x: 2, y: 10 },
  ]) {
    spawn(s, 'coblyn', at);
  }
  addLog(s, 'Arawn rides with the Hunt. The hall is yours to keep until he returns.');
  return s;
}

export function addLog(s: GameState, text: string): void {
  s.log.push({ t: s.time, text });
  if (s.log.length > MAX_LOG) s.log.shift();
}

export function spawn(s: GameState, kind: BeastKind, at: Vec): Entity {
  const e = spawnEntity(s.nextId++, kind, at);
  s.entities.push(e);
  return e;
}

export function removeEntity(s: GameState, e: Entity): void {
  const i = s.entities.indexOf(e);
  if (i >= 0) s.entities.splice(i, 1);
}

export function heroCount(s: GameState): number {
  return s.entities.filter(isHero).length;
}

export function countKind(s: GameState, kind: BeastKind): number {
  return s.entities.filter((e) => e.kind === kind).length;
}

// ---------- steward actions ----------

/** Mark or unmark a rock tile for digging. Returns true if the tile changed. */
export function markDig(s: GameState, x: number, y: number, on: boolean): boolean {
  if (!inBounds(s.grid, x, y) || !isRock(tileAt(s.grid, x, y))) return false;
  if (isMarked(s.grid, x, y) === on) return false;
  setMarked(s.grid, x, y, on);
  return true;
}

export type PaintResult = 'built' | 'sold' | 'poor' | 'blocked';

/**
 * Paint a room onto Floor (paying its cost), or click the same room again to
 * sell it back for half. Other tiles are left alone.
 */
export function paintRoom(s: GameState, x: number, y: number, room: RoomTile): PaintResult {
  if (!inBounds(s.grid, x, y)) return 'blocked';
  const t = tileAt(s.grid, x, y);
  if (t === room) {
    setTile(s.grid, x, y, Tile.Floor);
    s.gold += sellPrice(room);
    return 'sold';
  }
  if (t !== Tile.Floor) return 'blocked';
  if (s.gold < ROOM_COST[room]) return 'poor';
  s.gold -= ROOM_COST[room];
  setTile(s.grid, x, y, room);
  return 'built';
}

/** A worker finishes digging a tile: rock becomes Floor and gold seams pay out. */
export function digTile(s: GameState, x: number, y: number): number {
  const t = tileAt(s.grid, x, y);
  if (!isRock(t)) return 0;
  const pay = t === Tile.Gold ? GOLD_SEAM_PAYOUT : 0;
  setTile(s.grid, x, y, Tile.Floor);
  setMarked(s.grid, x, y, false);
  s.gold += pay;
  return pay;
}

/** A hero finishes tunnelling through a tile: it becomes Floor, unpaid. */
export function tunnelTile(s: GameState, x: number, y: number): void {
  if (isRock(tileAt(s.grid, x, y))) {
    setTile(s.grid, x, y, Tile.Floor);
    setMarked(s.grid, x, y, false);
  }
}

export const roomCount = (s: GameState, room: RoomTile): number => countTiles(s.grid, room);
export const hasRoom = (t: Tile): t is RoomTile => isRoom(t);

// ---------- damage and death ----------

export function damage(s: GameState, target: Entity, amount: number): void {
  target.hp -= amount;
  target.flash = 0.25;
  if (target.hp > 0) return;
  removeEntity(s, target);
  if (target.kind === 'knight' || target.kind === 'priest') {
    const gold = HERO_DROP[target.kind];
    s.drops.push({ x: Math.round(target.x), y: Math.round(target.y), gold });
    addLog(
      s,
      target.kind === 'knight'
        ? `The knight's plume is in the dirt. ${gold} gold spills from his purse.`
        : `The hedge-priest has stopped talking. ${gold} gold found in his sandal.`,
    );
  } else {
    addLog(s, `The hall is quieter. A ${BESTIARY[target.kind].name} has been slain.`);
  }
}

export function strikeHeart(s: GameState, e: Entity): void {
  s.heartHp = Math.max(0, s.heartHp - BESTIARY[e.kind].stats.attack);
  if (!e.struckHeart) {
    e.struckHeart = true;
    addLog(s, `Steel on the Heart. The ${BESTIARY[e.kind].name} has reached it, and the hall shudders.`);
  }
}

// ---------- arrivals ----------

export const ARRIVAL_LOG: Record<BeastKind, string> = {
  coblyn: 'A tapping behind the seam. A Coblyn has come up through the portal.',
  cwn: 'Baying, then silence. A Cŵn Annwn has slunk in from the portal.',
  pwca: 'Two lamp-yellow eyes open in the dark. A Pwca has taken up residence.',
  afanc: 'The floor shakes and the walls reconsider. The Afanc has arrived.',
  knight: 'Boots on the stair. A Mortal Knight is in the hall.',
  priest: 'A psalm, badly sung. A Hedge-Priest is in the hall.',
};

/**
 * Who, if anyone, steps through the Portal at this check. Rules are tried in
 * order and the first that passes wins; nothing arrives otherwise.
 */
export function chooseArrival(s: GameState): BeastKind | null {
  const lair = roomCount(s, Tile.Lair);
  const hatchery = roomCount(s, Tile.Hatchery);
  const treasury = roomCount(s, Tile.Treasury);
  if (countKind(s, 'coblyn') < 3) return 'coblyn';
  if (lair >= 4 && hatchery >= 2 && countKind(s, 'cwn') < 3) return 'cwn';
  if (lair >= 2 && treasury >= 2 && countKind(s, 'pwca') < 2) return 'pwca';
  if (lair >= 9 && treasury >= 4 && s.gold >= 300 && countKind(s, 'afanc') < 1) return 'afanc';
  return null;
}

function tickArrivals(s: GameState, dt: number): void {
  s.arrivalTimer -= dt;
  if (s.arrivalTimer > 0) return;
  s.arrivalTimer += ARRIVAL_INTERVAL;
  const kind = chooseArrival(s);
  if (!kind) return;
  spawn(s, kind, PORTAL_POS);
  addLog(s, ARRIVAL_LOG[kind]);
}

// ---------- waves ----------

function tickWaves(s: GameState, dt: number): void {
  if (s.wave < FINAL_WAVE && s.time >= s.nextWaveAt) {
    s.wave += 1;
    s.nextWaveAt += WAVE_INTERVAL;
    s.pendingHeroes.push(...waveComposition(s.wave));
    s.spawnTimer = 0;
    addLog(s, `Boots on the stair. Wave ${s.wave}: ${s.pendingHeroes.length} mortals at the Gate.`);
  }
  if (s.pendingHeroes.length > 0) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = WAVE_STAGGER;
      const kind = s.pendingHeroes.shift() as BeastKind;
      const e = spawn(s, kind, GATE_POS);
      e.facing = -1;
    }
  }
}

function checkEnd(s: GameState): void {
  if (s.heartHp <= 0) {
    s.status = 'lost';
    return;
  }
  if (s.wave >= FINAL_WAVE && s.pendingHeroes.length === 0 && heroCount(s) === 0) s.status = 'won';
}

// ---------- the step ----------

export type EntityUpdater = (s: GameState, e: Entity, dt: number) => void;

/** Fixed-step sim tick. Behaviour is injected so this module stays small. */
export function step(s: GameState, dt: number, update: EntityUpdater): void {
  if (s.status !== 'playing') return;
  s.time += dt;
  tickArrivals(s, dt);
  tickWaves(s, dt);
  for (const e of [...s.entities]) {
    if (!s.entities.includes(e)) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.repath = Math.max(0, e.repath - dt);
    update(s, e, dt);
  }
  checkEnd(s);
}

export { HEART_POS, PORTAL_POS, GATE_POS };
