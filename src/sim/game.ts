import { BESTIARY, BESTIARY_ORDER, HERO_DROP, TRADES, type BeastKind, type TradeKind, WARD_SECONDS } from '../data/bestiary';
import {
  GOLD_SEAM_PAYOUT,
  HEART_HP,
  PAY_INTERVAL,
  ROOM_COST,
  STARTING_GOLD,
  TREASURY_BASE_CAPACITY,
  TREASURY_REGION_BONUS,
  UNPAID_TOLERANCE,
  sellPrice,
} from './economy';
import { type Drop, type Entity, isCreature, isFair, isHero, spawnEntity } from './entities';
import {
  GATE_POS,
  type Grid,
  HEART_POS,
  PORTAL_POS,
  type RoomTile,
  Tile,
  type Vec,
  createStartGrid,
  inBounds,
  isCorridor,
  isMarked,
  isRock,
  isRoom,
  largestRegion,
  regionsOf,
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

/**
 * How much of a creature's manual page can be read. A page starts as a
 * silhouette with the gloss; seeing the creature in the hall unlocks the
 * text and stats; surviving a wave (or, for a mortal, being slain) unlocks
 * the field notes.
 */
export type PageState = 'unseen' | 'seen' | 'studied';
export type Pages = Record<BeastKind, PageState>;

export const freshPages = (): Pages =>
  Object.fromEntries(BESTIARY_ORDER.map((k) => [k, 'unseen'])) as Pages;

export interface MapChange {
  x: number;
  y: number;
  version: number;
}

export interface GameState {
  grid: Grid;
  rng: Rng;
  time: number;
  /** Gold the steward can spend: the purse plus what the Treasury holds. */
  gold: number;
  /** The starting coin, which needs no vault. Spending draws on it first. */
  purse: number;
  heartHp: number;
  status: Status;
  entities: Entity[];
  /** Loose gold on the floor, waiting for a Coblyn (or a thief). */
  drops: Drop[];
  /** Waves that have been announced so far. */
  wave: number;
  nextWaveAt: number;
  /** Heroes still queued to step through the Gate for the current wave. */
  pendingHeroes: BeastKind[];
  spawnTimer: number;
  arrivalTimer: number;
  payTimer: number;
  log: LogLine[];
  nextId: number;
  /** Bumped on every tile change; entities compare it to decide whether to re-plan. */
  mapVersion: number;
  /** Recent tile changes, newest last, so a path can tell whether it was affected. */
  mapChanges: MapChange[];
  /** Bestiary unlock progress; the UI persists it. */
  pages: Pages;
  /** A wave has been announced and not yet cleared. */
  waveActive: boolean;
  /** No mortal passes the Gate before this sim time. */
  wardUntil: number;
  /** Seconds before the Fair Folk will consider another visit. */
  tegCooldown: number;
  /** Sim time of the last squabble log line, so the log is not spammed. */
  squabbleLogAt: number;
}

export const ARRIVAL_INTERVAL = 7;
export const MAX_LOG = 40;
export const MAX_MAP_CHANGES = 64;

export function createGame(seed = Date.now() & 0xffffffff, pages: Pages = freshPages()): GameState {
  const rng = mulberry32(seed);
  const s: GameState = {
    grid: createStartGrid(rng),
    rng,
    time: 0,
    gold: STARTING_GOLD,
    purse: STARTING_GOLD,
    heartHp: HEART_HP,
    status: 'playing',
    entities: [],
    drops: [],
    wave: 0,
    nextWaveAt: waveTime(1),
    pendingHeroes: [],
    spawnTimer: 0,
    arrivalTimer: ARRIVAL_INTERVAL,
    payTimer: PAY_INTERVAL,
    log: [],
    nextId: 1,
    mapVersion: 0,
    mapChanges: [],
    pages: { ...pages },
    waveActive: false,
    wardUntil: 0,
    tegCooldown: 0,
    squabbleLogAt: -Infinity,
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
  if (s.pages[kind] === 'unseen') {
    s.pages[kind] = 'seen';
    addLog(s, `The manual's page on the ${BESTIARY[kind].name} is legible now.`);
  }
  return e;
}

/** Unlock a page's field notes. */
export function studyPage(s: GameState, kind: BeastKind): void {
  if (s.pages[kind] === 'studied') return;
  s.pages[kind] = 'studied';
  addLog(s, `Field notes on the ${BESTIARY[kind].name} have been added to the manual.`);
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

/** Record a tile change so cached paths near it can be re-planned. */
function touchMap(s: GameState, x: number, y: number): void {
  s.mapVersion += 1;
  s.mapChanges.push({ x, y, version: s.mapVersion });
  if (s.mapChanges.length > MAX_MAP_CHANGES) s.mapChanges.shift();
}

// ---------- gold ----------

/**
 * Gold the Treasury can hold. Each tile holds 50; tiles in a region of
 * four or more hold 10 more per extra tile in the region, capped at 100.
 */
export function treasuryCapacity(g: Grid): number {
  let cap = 0;
  for (const region of regionsOf(g, Tile.Treasury)) {
    const perTile = Math.min(100, TREASURY_BASE_CAPACITY + Math.max(0, region.length - 3) * TREASURY_REGION_BONUS);
    cap += perTile * region.length;
  }
  return cap;
}

/** Gold sitting in the Treasury: everything that is not the purse. */
export const vaultGold = (s: GameState): number => Math.max(0, s.gold - Math.min(s.purse, s.gold));

/** Gold the Treasury could still take. The purse does not need a vault. */
export function treasurySpace(s: GameState): number {
  return Math.max(0, treasuryCapacity(s.grid) - vaultGold(s));
}

/** Pay out of the purse first, then the vault. Returns false if the hall cannot afford it. */
export function spend(s: GameState, amount: number): boolean {
  if (s.gold < amount) return false;
  const purse = Math.min(s.purse, s.gold);
  s.gold -= amount;
  s.purse = Math.max(0, purse - amount);
  return true;
}

export function dropGold(s: GameState, at: Vec, gold: number): void {
  if (gold <= 0) return;
  const existing = s.drops.find((d) => d.x === at.x && d.y === at.y);
  if (existing) existing.gold += gold;
  else s.drops.push({ x: at.x, y: at.y, gold });
}

/** Loose gold lying on the floor. */
export const looseGold = (s: GameState): number => s.drops.reduce((n, d) => n + d.gold, 0);

/** Bank carried gold. Returns what did not fit, which stays in hand. */
export function depositGold(s: GameState, amount: number): number {
  const take = Math.min(amount, treasurySpace(s));
  s.gold += take;
  return amount - take;
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
 * sell it back for half. Other tiles are left alone. Selling a Treasury
 * tile the hall can no longer afford to lose spills the excess on the floor.
 */
export function paintRoom(s: GameState, x: number, y: number, room: RoomTile): PaintResult {
  if (!inBounds(s.grid, x, y)) return 'blocked';
  const t = tileAt(s.grid, x, y);
  if (t === room) {
    setTile(s.grid, x, y, Tile.Floor);
    touchMap(s, x, y);
    const over = Math.max(0, vaultGold(s) - treasuryCapacity(s.grid));
    if (over > 0) {
      s.gold -= over;
      dropGold(s, { x, y }, over);
      addLog(s, `${over} gold spills from the broken vault. Someone should pick that up.`);
    }
    // The refund goes in the purse: coin in hand needs no vault.
    s.gold += sellPrice(room);
    s.purse = Math.min(s.purse, s.gold) + sellPrice(room);
    return 'sold';
  }
  if (t !== Tile.Floor) return 'blocked';
  if (!spend(s, ROOM_COST[room])) return 'poor';
  setTile(s.grid, x, y, room);
  touchMap(s, x, y);
  return 'built';
}

/** A worker finishes digging a tile: rock becomes Floor; a gold seam leaves a pile. */
export function digTile(s: GameState, x: number, y: number): number {
  const t = tileAt(s.grid, x, y);
  if (!isRock(t)) return 0;
  const pay = t === Tile.Gold ? GOLD_SEAM_PAYOUT : 0;
  setTile(s.grid, x, y, Tile.Floor);
  setMarked(s.grid, x, y, false);
  touchMap(s, x, y);
  dropGold(s, { x, y }, pay);
  return pay;
}

/** A hero finishes tunnelling through a tile: it becomes Floor, unpaid. */
export function tunnelTile(s: GameState, x: number, y: number): void {
  if (isRock(tileAt(s.grid, x, y))) {
    setTile(s.grid, x, y, Tile.Floor);
    setMarked(s.grid, x, y, false);
    touchMap(s, x, y);
  }
}

/** Largest contiguous region of a room. Arrival rules read this, not raw tile counts. */
export const roomSize = (s: GameState, room: RoomTile): number => largestRegion(s.grid, room);
export const hasRoom = (t: Tile): t is RoomTile => isRoom(t);

// ---------- damage and death ----------

export function damage(s: GameState, target: Entity, amount: number): void {
  // The Gwyllgi holds the road: half damage while it stands in a corridor.
  if (target.kind === 'gwyllgi' && isCorridor(s.grid, Math.round(target.x), Math.round(target.y))) amount *= 0.5;
  target.hp -= amount;
  target.flash = 0.25;
  if (isFair(target)) {
    offendEmissary(s, target, 'struck');
    return;
  }
  if (target.hp > 0) return;
  removeEntity(s, target);
  const at = { x: Math.round(target.x), y: Math.round(target.y) };
  if (target.kind === 'knight' || target.kind === 'priest') {
    studyPage(s, target.kind);
    const gold = HERO_DROP[target.kind] + target.carrying;
    dropGold(s, at, gold);
    addLog(
      s,
      target.kind === 'knight'
        ? `The knight's plume is in the dirt. ${gold} gold spills from his purse.`
        : `The hedge-priest has stopped talking. ${gold} gold found in his sandal.`,
    );
  } else {
    dropGold(s, at, target.carrying);
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

// ---------- the Fair Folk ----------

export const TEG_STAY = 60;
export const TEG_COOLDOWN = 120;
export const TEG_VAULT_THRESHOLD = 150;

export const emissary = (s: GameState): Entity | undefined => s.entities.find(isFair);

/** The emissary leaves at once, and remembers. */
export function offendEmissary(s: GameState, e: Entity, how: 'struck' | 'robbed'): void {
  removeEntity(s, e);
  s.tegCooldown = TEG_COOLDOWN * 2;
  addLog(
    s,
    how === 'struck'
      ? 'The emissary is struck, and is simply not there any more. A note has been made.'
      : "The Pwca has lifted something from the emissary's sleeve. The emissary leaves without a word, which is worse.",
  );
}

/** Buy one of the emissary's terms. Needs an emissary present and the gold. */
export function trade(s: GameState, kind: TradeKind): boolean {
  if (!emissary(s) || !spend(s, TRADES[kind].cost)) return false;
  if (kind === 'heal') {
    for (const e of s.entities) if (!isHero(e)) e.hp = e.maxHp;
    addLog(s, 'The emissary says a word in a language with no vowels, and every wound in the hall closes.');
  } else {
    s.wardUntil = s.time + WARD_SECONDS;
    addLog(s, `The emissary hangs something small on the Gate. Nothing mortal will pass it for ${WARD_SECONDS} seconds.`);
  }
  return true;
}

export const warded = (s: GameState): boolean => s.time < s.wardUntil;

// ---------- arrivals ----------

export const ARRIVAL_LOG: Record<BeastKind, string> = {
  coblyn: 'A tapping behind the seam. A Coblyn has come up through the portal.',
  cwn: 'Baying, then silence. A Cŵn Annwn has slunk in from the portal.',
  pwca: 'Two lamp-yellow eyes open in the dark. A Pwca has taken up residence.',
  gwyllgi: 'Something the size of a calf has lain down across the corridor. The Gwyllgi is here.',
  ceffyl: 'The Pool goes still, then empties itself upward. A Ceffyl Dŵr shakes the water off.',
  afanc: 'The floor shakes and the walls reconsider. The Afanc has arrived.',
  teg: 'A courtesy at the portal. An emissary of the Tylwyth Teg has terms, if the steward has a minute.',
  knight: 'Boots on the stair. A Mortal Knight is in the hall.',
  priest: 'A psalm, badly sung. A Hedge-Priest is in the hall.',
};

/**
 * Who, if anyone, steps through the Portal at this check. Rules are tried in
 * order and the first that passes wins; nothing arrives otherwise. Room
 * sizes are the largest contiguous region of that room.
 */
export function chooseArrival(s: GameState): BeastKind | null {
  const lair = roomSize(s, Tile.Lair);
  const hatchery = roomSize(s, Tile.Hatchery);
  const treasury = roomSize(s, Tile.Treasury);
  const pool = roomSize(s, Tile.Pool);
  if (countKind(s, 'coblyn') < 3) return 'coblyn';
  if (lair >= 4 && hatchery >= 2 && countKind(s, 'cwn') < 3) return 'cwn';
  if (lair >= 2 && treasury >= 2 && countKind(s, 'pwca') < 2) return 'pwca';
  if (lair >= 6 && treasury >= 3 && countKind(s, 'gwyllgi') < 2) return 'gwyllgi';
  if (pool >= 3 && lair >= 4 && countKind(s, 'ceffyl') < 1) return 'ceffyl';
  if (lair >= 9 && treasury >= 4 && s.gold >= 300 && countKind(s, 'afanc') < 1) return 'afanc';
  if (vaultGold(s) >= TEG_VAULT_THRESHOLD && s.tegCooldown <= 0 && countKind(s, 'teg') < 1) return 'teg';
  return null;
}

function tickArrivals(s: GameState, dt: number): void {
  s.arrivalTimer -= dt;
  if (s.arrivalTimer > 0) return;
  s.arrivalTimer += ARRIVAL_INTERVAL;
  const kind = chooseArrival(s);
  if (!kind) return;
  const e = spawn(s, kind, PORTAL_POS);
  if (kind === 'teg') e.stay = TEG_STAY;
  addLog(s, ARRIVAL_LOG[kind]);
}

// ---------- wages ----------

/**
 * Payday. Every creature draws its wage from the Treasury. One missed
 * payday makes a creature angry; a second and it leaves.
 */
export function payWages(s: GameState): void {
  let paid = 0;
  let owed = 0;
  for (const e of [...s.entities]) {
    if (!isCreature(e)) continue;
    const wage = BESTIARY[e.kind].stats.wage;
    if (wage <= 0) continue;
    if (spend(s, wage)) {
      paid += wage;
      e.unpaid = 0;
      continue;
    }
    owed += wage;
    e.unpaid += 1;
    if (e.unpaid >= UNPAID_TOLERANCE) {
      removeEntity(s, e);
      addLog(s, `Twice unpaid, the ${BESTIARY[e.kind].name} has gone to find a hall that keeps its word.`);
    }
  }
  if (paid === 0 && owed === 0) return;
  addLog(
    s,
    owed > 0
      ? `Payday. ${paid} gold paid; ${owed} owed, and the unpaid are muttering.`
      : `Payday. ${paid} gold paid to the hall's denizens.`,
  );
}

function tickWages(s: GameState, dt: number): void {
  s.payTimer -= dt;
  if (s.payTimer > 0) return;
  s.payTimer += PAY_INTERVAL;
  payWages(s);
}

// ---------- waves ----------

function tickWaves(s: GameState, dt: number): void {
  if (s.wave < FINAL_WAVE && s.time >= s.nextWaveAt) {
    s.wave += 1;
    s.nextWaveAt += WAVE_INTERVAL;
    s.pendingHeroes.push(...waveComposition(s.wave));
    s.spawnTimer = 0;
    s.waveActive = true;
    addLog(s, `Boots on the stair. Wave ${s.wave}: ${s.pendingHeroes.length} mortals at the Gate.`);
  }
  if (s.pendingHeroes.length > 0 && !warded(s)) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = WAVE_STAGGER;
      const kind = s.pendingHeroes.shift() as BeastKind;
      const e = spawn(s, kind, GATE_POS);
      e.facing = -1;
    }
  }
}

/** A wave is cleared when nothing mortal is left in the hall or on the stair. */
function checkWaveCleared(s: GameState): void {
  if (!s.waveActive || s.pendingHeroes.length > 0 || heroCount(s) > 0) return;
  s.waveActive = false;
  for (const e of s.entities) if (isCreature(e)) studyPage(s, e.kind);
  if (s.wave < FINAL_WAVE) addLog(s, 'The stair is quiet again. The hall counts its wounds and its gold.');
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
  s.tegCooldown = Math.max(0, s.tegCooldown - dt);
  tickArrivals(s, dt);
  tickWages(s, dt);
  tickWaves(s, dt);
  for (const e of [...s.entities]) {
    if (!s.entities.includes(e)) continue;
    e.px = e.x;
    e.py = e.y;
    e.flash = Math.max(0, e.flash - dt);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.repath = Math.max(0, e.repath - dt);
    update(s, e, dt);
  }
  checkWaveCleared(s);
  checkEnd(s);
}

export { HEART_POS, PORTAL_POS, GATE_POS };
