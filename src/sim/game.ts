import {
  BESTIARY,
  BESTIARY_ORDER,
  ENGINES,
  type EngineKind,
  HERO_DROP,
  type HeroKind,
  TRADES,
  type BeastKind,
  type TradeKind,
  WARD_SECONDS,
} from '../data/bestiary';
import { type Level, THE_CAIRN } from '../data/levels';
import type { WaveSchedule } from '../data/waves';
import {
  GOLD_SEAM_PAYOUT,
  HEART_HP,
  FIRST_PAYDAY,
  PAY_INTERVAL,
  ROOM_COST,
  TREASURY_BASE_CAPACITY,
  TREASURY_REGION_BONUS,
  UNPAID_TOLERANCE,
  sellPrice,
} from './economy';
import { type Boulder, type Drop, type Entity, type Trap, isCreature, isFair, isHero, spawnEntity } from './entities';
import {
  GATE_POS,
  type Grid,
  HEART_POS,
  PORTAL_POS,
  type RoomTile,
  Tile,
  type Vec,
  gatesOf,
  gridFromRows,
  inBounds,
  isCorridor,
  isMarked,
  isRock,
  isRoom,
  isWalkable,
  largestRegion,
  regionsOf,
  setMarked,
  setTile,
  tileAt,
  tilesOf,
} from './grid';
import { type Rng, mulberry32 } from './rng';
import { WAVE_STAGGER } from './waves';

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

/** Things that happened this tick that a renderer or mixer may want to react to. */
export type SimEvent =
  | { kind: 'dig'; x: number; y: number; gold: boolean }
  | { kind: 'heart' }
  | { kind: 'hit'; x: number; y: number }
  | { kind: 'death'; x: number; y: number; hero: boolean }
  | { kind: 'bay'; x: number; y: number; id: number }
  | { kind: 'arrive'; beast: BeastKind }
  | { kind: 'wave'; n: number }
  | { kind: 'step'; x: number; y: number; open: number };

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
  /** The level being played (its schedule is also kept on `schedule`). */
  level: Level;
  /** The level's waves. */
  schedule: WaveSchedule;
  /** Every Gate on the map; wave specs index into it. */
  gates: Vec[];
  /** Waves that have been announced so far. */
  wave: number;
  /** When the next wave is announced, or Infinity after the last. */
  nextWaveAt: number;
  /** Heroes still queued to step through the Gate for the current wave. */
  pendingHeroes: HeroKind[];
  /** Which Gate the pending heroes use. */
  pendingGate: number;
  /** Mortals slain and mortals who lost their nerve and left. */
  slain: number;
  fled: number;
  traps: Trap[];
  boulders: Boulder[];
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
  /** Where rock was recently dug or tunnelled, for the renderer's rubble. */
  rubble: { x: number; y: number; t: number }[];
  /** The recently fallen, for the renderer's dead frames. */
  corpses: { kind: BeastKind; x: number; y: number; facing: -1 | 1; t: number }[];
  /** Events since the consumer last drained them (see takeEvents). */
  events: SimEvent[];
  /** The seed this hall was dug with. */
  seed: number;
  /** The Hunt has returned: the hounds are Arawn's and the mortals are prey. */
  hunt: boolean;
}

export const ARRIVAL_INTERVAL = 7;
export const MAX_LOG = 40;
export const MAX_MAP_CHANGES = 64;

export const finalWave = (s: GameState): number => s.schedule.waves.length;

/**
 * A new hall. The default level is the Cairn; a schedule may be passed on
 * its own for tests. Pages carry bestiary unlocks across games.
 */
export function createGame(seed = Date.now() & 0xffffffff, pages: Pages = freshPages(), levelOrSchedule: Level | WaveSchedule = THE_CAIRN): GameState {
  const level: Level = 'rows' in levelOrSchedule ? levelOrSchedule : { ...THE_CAIRN, schedule: levelOrSchedule };
  const schedule = level.schedule;
  const rng = mulberry32(seed);
  const grid = gridFromRows(level.rows, level.goldFraction, rng);
  const s: GameState = {
    grid,
    gates: gatesOf(grid),
    level,
    schedule,
    rng,
    seed,
    hunt: false,
    time: 0,
    gold: level.startGold,
    purse: level.startGold,
    heartHp: HEART_HP,
    status: 'playing',
    entities: [],
    drops: [],
    wave: 0,
    nextWaveAt: schedule.waves[0]?.at ?? Infinity,
    pendingHeroes: [],
    pendingGate: 0,
    slain: 0,
    fled: 0,
    traps: [],
    boulders: [],
    spawnTimer: 0,
    arrivalTimer: ARRIVAL_INTERVAL,
    payTimer: FIRST_PAYDAY,
    log: [],
    nextId: 1,
    mapVersion: 0,
    mapChanges: [],
    pages: { ...pages },
    waveActive: false,
    wardUntil: 0,
    tegCooldown: 0,
    squabbleLogAt: -Infinity,
    rubble: [],
    corpses: [],
    events: [],
  };
  // Three Coblynau are already at work when the steward takes the keys: on floor near the Heart.
  const heart = tilesOf(grid, Tile.Heart)[0] ?? HEART_POS;
  const spots = tilesOf(grid, Tile.Floor)
    .map((p) => ({ p, d: Math.hypot(p.x - heart.x, p.y - heart.y) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.p);
  for (let i = 0; i < 3; i++) spawn(s, 'coblyn', spots[Math.min(spots.length - 1, i * 2)] ?? heart);
  addLog(s, 'Arawn rides with the Hunt. The hall is yours to keep until he returns.');
  return s;
}

/** Where the Heart stands on this map. */
export const heartOf = (s: GameState): Vec => tilesOf(s.grid, Tile.Heart)[0] ?? HEART_POS;
/** Where the Portal is on this map. */
export const portalOf = (s: GameState): Vec => tilesOf(s.grid, Tile.Portal)[0] ?? PORTAL_POS;

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

export const MAX_EVENTS = 64;

export function emit(s: GameState, ev: SimEvent): void {
  s.events.push(ev);
  if (s.events.length > MAX_EVENTS) s.events.shift();
}

/** Hand over and clear the pending events. */
export function takeEvents(s: GameState): SimEvent[] {
  const out = s.events;
  s.events = [];
  return out;
}

export const RUBBLE_SECONDS = 4;
export const CORPSE_SECONDS = 6;

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
  leaveRubble(s, x, y);
  emit(s, { kind: 'dig', x, y, gold: pay > 0 });
  dropGold(s, { x, y }, pay);
  return pay;
}

/** A hero finishes tunnelling through a tile: it becomes Floor, unpaid. */
export function tunnelTile(s: GameState, x: number, y: number): void {
  if (isRock(tileAt(s.grid, x, y))) {
    setTile(s.grid, x, y, Tile.Floor);
    setMarked(s.grid, x, y, false);
    touchMap(s, x, y);
    leaveRubble(s, x, y);
  }
}

function leaveRubble(s: GameState, x: number, y: number): void {
  s.rubble.push({ x, y, t: s.time });
  if (s.rubble.length > 32) s.rubble.shift();
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
  emit(s, { kind: 'hit', x: target.x, y: target.y });
  if (isFair(target)) {
    offendEmissary(s, target, 'struck');
    return;
  }
  if (target.hp > 0) return;
  removeEntity(s, target);
  const at = { x: Math.round(target.x), y: Math.round(target.y) };
  s.corpses.push({ kind: target.kind, x: at.x, y: at.y, facing: target.facing, t: s.time });
  if (s.corpses.length > 24) s.corpses.shift();
  emit(s, { kind: 'death', x: at.x, y: at.y, hero: isHero(target) });
  if (isHero(target)) {
    const kind = target.kind as HeroKind;
    studyPage(s, kind);
    s.slain += 1;
    const gold = HERO_DROP[kind] + target.carrying;
    dropGold(s, at, gold);
    addLog(s, DEATH_LOG[kind](gold));
    // The levy's nerve goes with the first of them to fall.
    if (kind === 'levy') {
      for (const o of s.entities) if (o.kind === 'levy') o.morale = 0;
    }
    // Allies who saw it lose heart.
    for (const o of s.entities) {
      if (isHero(o) && Math.hypot(o.x - target.x, o.y - target.y) <= 6) o.morale = Math.max(0, o.morale - 25);
    }
  } else {
    dropGold(s, at, target.carrying);
    addLog(s, `The hall is quieter. A ${BESTIARY[target.kind].name} has been slain.`);
  }
}

const DEATH_LOG: Record<HeroKind, (gold: number) => string> = {
  knight: (g) => `The knight's plume is in the dirt. ${g} gold spills from his purse.`,
  priest: (g) => `The hedge-priest has stopped talking. ${g} gold found in his sandal.`,
  lord: (g) => `The Cantref Lord is down, and a hundred farms are suddenly for sale. ${g} gold in his purse.`,
  levy: (g) => `A levy falls, and the rest remember their farms. ${g} gold and a billhook.`,
  relic: (g) => `The reliquary bearer drops, and the box with him. The hush lifts. ${g} gold.`,
};

/** A mortal whose nerve is gone reaches the Gate and leaves with what he carries. */
export function heroFlees(s: GameState, e: Entity): void {
  removeEntity(s, e);
  s.fled += 1;
  addLog(s, `The ${BESTIARY[e.kind].name} has had enough and is gone up the stair${e.carrying > 0 ? ` with ${e.carrying} of your gold` : ''}.`);
}

export function strikeHeart(s: GameState, e: Entity): void {
  s.heartHp = Math.max(0, s.heartHp - BESTIARY[e.kind].stats.attack);
  emit(s, { kind: 'heart' });
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
  lord: 'A banner, and a man who expects the banner to be enough. The Cantref Lord is in the hall.',
  levy: 'Singing on the stair. The levy is in the hall, and has not yet noticed.',
  relic: 'A silence walks in. The reliquary bearer is in the hall.',
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
  const ok = (k: BeastKind): boolean => s.level.allowed.includes(k);
  if (countKind(s, 'coblyn') < 3) return 'coblyn';
  if (ok('cwn') && lair >= 4 && hatchery >= 2 && countKind(s, 'cwn') < 3) return 'cwn';
  if (ok('pwca') && lair >= 2 && treasury >= 2 && countKind(s, 'pwca') < 2) return 'pwca';
  if (ok('gwyllgi') && lair >= 6 && treasury >= 3 && countKind(s, 'gwyllgi') < 2) return 'gwyllgi';
  if (ok('ceffyl') && pool >= 3 && lair >= 4 && countKind(s, 'ceffyl') < 1) return 'ceffyl';
  if (ok('afanc') && lair >= 9 && treasury >= 4 && s.gold >= 300 && countKind(s, 'afanc') < 1) return 'afanc';
  if (ok('teg') && vaultGold(s) >= TEG_VAULT_THRESHOLD && s.tegCooldown <= 0 && countKind(s, 'teg') < 1) return 'teg';
  return null;
}

function tickArrivals(s: GameState, dt: number): void {
  s.arrivalTimer -= dt;
  if (s.arrivalTimer > 0) return;
  s.arrivalTimer += ARRIVAL_INTERVAL;
  const kind = chooseArrival(s);
  if (!kind) return;
  const e = spawn(s, kind, portalOf(s));
  if (kind === 'teg') e.stay = TEG_STAY;
  emit(s, { kind: 'arrive', beast: kind });
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

/** The next wave's composition, for the HUD preview; empty after the last. */
export const nextWave = (s: GameState): HeroKind[] => s.schedule.waves[s.wave]?.heroes ?? [];

function tickWaves(s: GameState, dt: number): void {
  const spec = s.schedule.waves[s.wave];
  if (spec && s.time >= spec.at) {
    s.wave += 1;
    s.nextWaveAt = s.schedule.waves[s.wave]?.at ?? Infinity;
    s.pendingHeroes.push(...spec.heroes);
    s.pendingGate = Math.min(spec.gate, Math.max(0, s.gates.length - 1));
    s.spawnTimer = 0;
    s.waveActive = true;
    emit(s, { kind: 'wave', n: s.wave });
    const where = s.gates.length > 1 ? ` at the ${['west', 'east', 'third', 'fourth'][s.pendingGate] ?? ''} Gate`.replace('  ', ' ') : ' at the Gate';
    addLog(s, `Boots on the stair. Wave ${s.wave}: ${s.pendingHeroes.length} mortals${where}.`);
  }
  if (s.pendingHeroes.length > 0 && !warded(s)) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = WAVE_STAGGER;
      const kind = s.pendingHeroes.shift() as HeroKind;
      const gate = s.gates[s.pendingGate] ?? GATE_POS;
      const e = spawn(s, kind, gate);
      e.facing = gate.x > s.grid.w / 2 ? -1 : 1;
    }
  }
}

export const HUNT_HOUNDS_PER_GATE = 4;

/**
 * The Hunt returns. Horns on the stair, the lights go cold, every mortal's
 * nerve breaks, and Arawn's own hounds come down through every Gate.
 */
function tickHunt(s: GameState): void {
  if (s.hunt || s.level.win.kind !== 'hunt' || s.time < s.level.win.at) return;
  s.hunt = true;
  s.pendingHeroes = [];
  addLog(s, 'Horns on the stair. Not mortal horns.');
  addLog(s, 'The torches go white. Arawn is home, and the Hunt is with him.');
  for (const e of s.entities) if (isHero(e)) e.morale = 0;
  for (const gate of s.gates) {
    for (let i = 0; i < HUNT_HOUNDS_PER_GATE; i++) {
      const hound = spawn(s, 'cwn', gate);
      hound.hunger = -1e9; // the Hunt's hounds want for nothing
      hound.sleep = -1e9;
    }
  }
  addLog(s, 'The hounds of Annwn pour down the stair. Stand aside and let them work.');
  emit(s, { kind: 'wave', n: finalWave(s) + 1 });
}

/** A wave is cleared when nothing mortal is left in the hall or on the stair. */
function checkWaveCleared(s: GameState): void {
  if (!s.waveActive || s.pendingHeroes.length > 0 || heroCount(s) > 0) return;
  s.waveActive = false;
  for (const e of s.entities) if (isCreature(e)) studyPage(s, e.kind);
  if (s.wave < finalWave(s)) addLog(s, 'The stair is quiet again. The hall counts its wounds and its gold.');
}

function checkEnd(s: GameState): void {
  if (s.heartHp <= 0) {
    s.status = 'lost';
    return;
  }
  if (s.level.win.kind === 'hunt') {
    if (s.hunt && heroCount(s) === 0) s.status = 'won';
    return;
  }
  if (s.wave >= finalWave(s) && s.pendingHeroes.length === 0 && heroCount(s) === 0) s.status = 'won';
}

// ---------- engines of the hall ----------

export type TrapResult = 'planned' | 'cancelled' | 'poor' | 'blocked';

export const trapAt = (s: GameState, x: number, y: number): Trap | undefined =>
  s.traps.find((t) => t.x === x && t.y === y);

/**
 * Plan a trap on a floor tile, paying for it; a Coblyn builds it. Planning on
 * an unbuilt trap cancels it and refunds. Built traps cannot be moved.
 */
export function planTrap(s: GameState, x: number, y: number, kind: EngineKind): TrapResult {
  if (!inBounds(s.grid, x, y)) return 'blocked';
  const existing = trapAt(s, x, y);
  if (existing) {
    if (existing.built) return 'blocked';
    s.traps.splice(s.traps.indexOf(existing), 1);
    s.gold += ENGINES[existing.kind].stats.cost;
    s.purse = Math.min(s.purse, s.gold) + ENGINES[existing.kind].stats.cost;
    return 'cancelled';
  }
  if (tileAt(s.grid, x, y) !== Tile.Floor) return 'blocked';
  if (!spend(s, ENGINES[kind].stats.cost)) return 'poor';
  s.traps.push({ id: s.nextId++, kind, x, y, progress: 0, built: false });
  return 'planned';
}

/** A mortal (or the emissary) sets foot on a built trap. */
export function springTrap(s: GameState, trap: Trap, e: Entity): void {
  const st = ENGINES[trap.kind].stats;
  if (trap.kind === 'pit') {
    s.traps.splice(s.traps.indexOf(trap), 1);
    addLog(s, `The ${BESTIARY[e.kind].name} goes into the pit to the waist, and comes out slower.`);
    damage(s, e, st.damage);
    e.slow = st.effect;
  } else if (trap.kind === 'snare') {
    s.traps.splice(s.traps.indexOf(trap), 1);
    if (isFair(e)) {
      offendEmissary(s, e, 'struck');
      return;
    }
    e.held = st.effect;
    addLog(s, `Cold iron closes on the ${BESTIARY[e.kind].name}'s ankle. Four seconds is a long time.`);
  }
}

const DIRS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** An armed boulder rolls when a mortal stands in a straight open line from it. */
function tickBoulders(s: GameState, dt: number): void {
  const range = ENGINES.boulder.stats.effect;
  for (const trap of [...s.traps]) {
    if (trap.kind !== 'boulder' || !trap.built) continue;
    for (const d of DIRS) {
      let hit = false;
      for (let i = 1; i <= range; i++) {
        const x = trap.x + d.x * i;
        const y = trap.y + d.y * i;
        if (!inBounds(s.grid, x, y) || !isWalkable(tileAt(s.grid, x, y))) break;
        if (s.entities.some((e) => isHero(e) && Math.round(e.x) === x && Math.round(e.y) === y)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        s.traps.splice(s.traps.indexOf(trap), 1);
        s.boulders.push({ x: trap.x, y: trap.y, dx: d.x, dy: d.y, travelled: 0 });
        addLog(s, 'The wedge is kicked. The boulder has somewhere to be.');
        break;
      }
    }
  }
  const speed = 5;
  for (const b of [...s.boulders]) {
    const step = speed * dt;
    b.x += b.dx * step;
    b.y += b.dy * step;
    b.travelled += step;
    const tx = Math.round(b.x);
    const ty = Math.round(b.y);
    for (const e of [...s.entities]) {
      if (isHero(e) && Math.abs(e.x - b.x) < 0.6 && Math.abs(e.y - b.y) < 0.6) damage(s, e, ENGINES.boulder.stats.damage * dt * 4);
    }
    if (b.travelled >= range || !inBounds(s.grid, tx + b.dx, ty + b.dy) || !isWalkable(tileAt(s.grid, tx + b.dx, ty + b.dy))) {
      s.boulders.splice(s.boulders.indexOf(b), 1);
    }
  }
}

// ---------- the step ----------

export type EntityUpdater = (s: GameState, e: Entity, dt: number) => void;

/** Fixed-step sim tick. Behaviour is injected so this module stays small. */
export function step(s: GameState, dt: number, update: EntityUpdater): void {
  if (s.status !== 'playing') return;
  s.time += dt;
  s.tegCooldown = Math.max(0, s.tegCooldown - dt);
  while (s.rubble.length > 0 && s.time - (s.rubble[0] as { t: number }).t > RUBBLE_SECONDS) s.rubble.shift();
  while (s.corpses.length > 0 && s.time - (s.corpses[0] as { t: number }).t > CORPSE_SECONDS) s.corpses.shift();
  tickArrivals(s, dt);
  tickWages(s, dt);
  tickWaves(s, dt);
  tickHunt(s);
  tickBoulders(s, dt);
  for (const e of [...s.entities]) {
    if (!s.entities.includes(e)) continue;
    e.px = e.x;
    e.py = e.y;
    e.flash = Math.max(0, e.flash - dt);
    e.slow = Math.max(0, e.slow - dt);
    e.held = Math.max(0, e.held - dt);
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.repath = Math.max(0, e.repath - dt);
    update(s, e, dt);
  }
  checkWaveCleared(s);
  checkEnd(s);
}

export { HEART_POS, PORTAL_POS, GATE_POS };
export type { Level };
