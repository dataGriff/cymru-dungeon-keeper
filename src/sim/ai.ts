/**
 * Behaviours. Each is a few lines on purpose: workers dig and flee, creatures
 * eat, sleep, fight and wander, heroes walk to the Heart and hit what is near.
 */
import { BESTIARY, ENGINES, RELIC_RADIUS, dislikes } from '../data/bestiary';
import { DIG_SECONDS } from './economy';
import {
  type Entity,
  type Mood,
  attackOf,
  distBetween,
  hungerRate,
  isCreature,
  isFair,
  isHero,
  nearest,
  speedOf,
  tileOf,
} from './entities';
import {
  type GameState,
  addLog,
  damage,
  depositGold,
  digTile,
  dropGold,
  emit,
  heroFlees,
  offendEmissary,
  removeEntity,
  spend,
  springTrap,
  strikeHeart,
  treasurySpace,
  tunnelTile,
} from './game';
import {
  HEART_POS,
  Tile,
  type Vec,
  dist,
  inBounds,
  isCorridor,
  isMarked,
  isRock,
  isWalkable,
  markedTiles,
  neighbors4,
  regionsOf,
  sameTile,
  tileAt,
  tilesOf,
} from './grid';
import { type Mover, dijkstra, findPath, pathTouches } from './path';
import { randInt, randRange } from './rng';

export const HUNGER_EAT = 18;
export const HUNGER_LEAVE = 40;
export const SLEEP_AT = 20;
export const SLEEP_RATE = 0.6;
export const EAT_SECONDS = 1.5;
export const EAT_HEAL = 6;
export const NAP_SECONDS = 2.5;
export const NAP_HEAL = 15;
export const SWING_SECONDS = 0.8;
export const HEART_STRIKE_SECONDS = 1;
export const REACH = 1.15;
export const TUNNEL_SPEED = 0.25;
export const PRIEST_HEAL_PER_SECOND = 1.2;
/** Temper at which a creature counts as angry. */
export const ANGRY_AT = 60;
/** Temper gained per second by each of two creatures squabbling in a shared room. */
export const SQUABBLE_RATE = 8;
export const SQUABBLE_LOG_GAP = 60;
/** Below this fraction of health, a creature with a mortal nearby is afraid. */
export const AFRAID_BELOW = 0.25;
/** An angry creature still fights; it stews instead of knitting its wounds. */
export const GWYLLGI_RANGE = 4;
export const CEFFYL_RETREAT = 1.0;
/** Morale lost per second walking a corridor, and gained near a priest. */
export const CORRIDOR_DREAD = 1.5;
export const PRIEST_COURAGE = 1;
export const AFANC_DREAD = 40;
export const PIT_SLOW = 0.4;
/** HP per second a creature knits back together when it is not fighting. */
export const REGEN = 0.5;

// ---------- movement ----------

/** Advance along the path. Returns true once there is nothing left to walk. */
export function walk(s: GameState, e: Entity, dt: number): boolean {
  const next = e.path[0];
  if (!next) return true;
  if (e.held > 0) return false;
  const onRock = isRock(tileAt(s.grid, next.x, next.y));
  const stepLen = speedOf(e) * (onRock ? TUNNEL_SPEED : 1) * (e.slow > 0 ? PIT_SLOW : 1) * dt;
  const dx = next.x - e.x;
  const dy = next.y - e.y;
  const d = Math.hypot(dx, dy);
  if (dx !== 0) e.facing = dx < 0 ? -1 : 1;
  if (d <= stepLen) {
    e.x = next.x;
    e.y = next.y;
    e.path.shift();
    if (onRock) tunnelTile(s, next.x, next.y);
    else if (isHero(e)) {
      let open = 0;
      for (const n of neighbors4(s.grid, next.x, next.y)) if (isWalkable(tileAt(s.grid, n.x, n.y))) open++;
      emit(s, { kind: 'step', x: next.x, y: next.y, open });
    }
  } else {
    e.x += (dx / d) * stepLen;
    e.y += (dy / d) * stepLen;
  }
  return e.path.length === 0;
}

const atCentre = (e: Entity): boolean => e.x === Math.round(e.x) && e.y === Math.round(e.y);

/** Has a tile near this entity's path changed since the path was planned? */
function pathAffected(s: GameState, e: Entity): boolean {
  if (e.pathVersion === s.mapVersion) return false;
  const changes = s.mapChanges.filter((c) => c.version > e.pathVersion);
  if (changes.length < s.mapVersion - e.pathVersion) return true; // history truncated: be safe
  const here = tileOf(e);
  return changes.some((c) => pathTouches(e.path, here, c));
}

/**
 * Plan a path to `goal`, keeping the tile currently being entered if
 * mid-step. A path already leading to the same goal is reused unless the
 * map changed next to it. Returns false when the goal is unreachable.
 */
export function setPath(s: GameState, e: Entity, goal: Vec, mover: Mover): boolean {
  if (e.path.length > 0 && e.pathGoal && sameTile(e.pathGoal, goal) && !pathAffected(s, e)) return true;
  const first = e.path[0];
  const anchor = first && !atCentre(e) ? first : tileOf(e);
  const p = findPath(s.grid, anchor, goal, mover);
  e.pathGoal = goal;
  e.pathVersion = s.mapVersion;
  if (!p) {
    e.path = [];
    return false;
  }
  e.path = anchor === first ? [anchor, ...p] : p;
  return true;
}

function idle(e: Entity, pause: number): void {
  e.task = 'idle';
  e.path = [];
  e.pathGoal = null;
  e.target = null;
  e.targetId = null;
  e.timer = pause;
}

export function wander(s: GameState, e: Entity, dt: number): void {
  if (e.task === 'wander') {
    if (walk(s, e, dt)) idle(e, randRange(s.rng, 0.4, 1.8));
    return;
  }
  if (e.task !== 'idle') idle(e, randRange(s.rng, 0.2, 0.8));
  e.timer -= dt;
  if (e.timer > 0) return;
  const here = tileOf(e);
  for (let i = 0; i < 6; i++) {
    const to = { x: here.x + randInt(s.rng, -3, 3), y: here.y + randInt(s.rng, -3, 3) };
    if (!inBounds(s.grid, to.x, to.y) || !isWalkable(tileAt(s.grid, to.x, to.y))) continue;
    if (setPath(s, e, to, 'floor')) {
      e.task = 'wander';
      return;
    }
  }
  e.timer = 0.5;
}

/** Step to whichever neighbouring tile is furthest from `threat`. */
export function flee(s: GameState, e: Entity, threat: Vec, dt: number): void {
  e.task = 'flee';
  if (e.path.length === 0 || e.repath <= 0) {
    e.repath = 0.3;
    const here = tileOf(e);
    let best: Vec | null = null;
    let bestD = dist(here, threat);
    for (const n of neighbors4(s.grid, here.x, here.y)) {
      if (!isWalkable(tileAt(s.grid, n.x, n.y))) continue;
      const d = dist(n, threat);
      if (d > bestD) {
        bestD = d;
        best = n;
      }
    }
    e.path = best ? [best] : [];
  }
  walk(s, e, dt);
}

/** Close on `foe` and swing when in reach. */
export function engage(s: GameState, e: Entity, foe: Entity, dt: number, mover: Mover): void {
  if (e.task !== 'chase' || e.targetId !== foe.id) {
    if (e.task !== 'chase' && (e.kind === 'cwn' || e.kind === 'gwyllgi')) emit(s, { kind: 'bay', x: e.x, y: e.y, id: e.id });
    e.task = 'chase';
    e.targetId = foe.id;
    e.repath = 0;
  }
  if (distBetween(e, foe) <= REACH) {
    e.path = [];
    if (foe.x !== e.x) e.facing = foe.x < e.x ? -1 : 1;
    if (e.cooldown <= 0) {
      e.cooldown = SWING_SECONDS;
      damage(s, foe, attackOf(e));
    }
    return;
  }
  if (e.path.length === 0 || e.repath <= 0) {
    e.repath = 0.35;
    setPath(s, e, tileOf(foe), mover);
  }
  walk(s, e, dt);
}

function nearestTile(s: GameState, e: Entity, t: Tile): Vec | null {
  let best: Vec | null = null;
  let bestD = Infinity;
  for (const v of tilesOf(s.grid, t)) {
    const d = distBetween(e, v);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** Walk to a tile for a task. Returns true once standing on it. */
function seekTile(s: GameState, e: Entity, to: Vec, task: Entity['task'], dt: number): boolean {
  if (e.task !== task || !e.target || e.target.x !== to.x || e.target.y !== to.y) {
    e.task = task;
    e.target = to;
    if (!setPath(s, e, to, 'floor')) {
      idle(e, 1);
      return false;
    }
  }
  return walk(s, e, dt) && e.x === to.x && e.y === to.y;
}

/** The steward's hand: send a creature somewhere. Overrides idling and wandering, never a fight or a flight. */
export function nudge(s: GameState, e: Entity, to: Vec): boolean {
  if (!isCreature(e) && !isFair(e) && e.kind !== 'coblyn') return false;
  if (!['idle', 'wander', 'nudge', 'eat', 'sleep', 'toFood', 'toBed'].includes(e.task)) return false;
  if (!isWalkable(tileAt(s.grid, to.x, to.y))) return false;
  e.task = 'nudge';
  e.target = to;
  return setPath(s, e, to, 'floor');
}

function deriveMood(e: Entity, threatened: boolean): Mood {
  if (threatened && e.hp < e.maxHp * AFRAID_BELOW) return 'afraid';
  if (e.unpaid > 0 || e.temper >= ANGRY_AT) return 'angry';
  if (e.hunger > HUNGER_EAT) return 'hungry';
  if (e.sleep > SLEEP_AT) return 'tired';
  return 'content';
}

/** Two creatures that dislike each other, standing in the same Lair or Pool region, squabble. */
function squabble(s: GameState, e: Entity, dt: number): void {
  const here = tileOf(e);
  const t = tileAt(s.grid, here.x, here.y);
  if (t !== Tile.Lair && t !== Tile.Pool) return;
  const region = regionsOf(s.grid, t).find((r) => r.some((p) => sameTile(p, here)));
  if (!region) return;
  for (const o of s.entities) {
    if (o === e || !isCreature(o) || !dislikes(e.kind, o.kind)) continue;
    const ot = tileOf(o);
    if (!region.some((p) => sameTile(p, ot))) continue;
    e.temper = Math.min(100, e.temper + SQUABBLE_RATE * dt);
    if (s.time - s.squabbleLogAt >= SQUABBLE_LOG_GAP) {
      s.squabbleLogAt = s.time;
      const room = t === Tile.Lair ? 'Lair' : 'Pool';
      addLog(s, `Growling in the ${room}: the ${BESTIARY[e.kind].name} and the ${BESTIARY[o.kind].name} are not getting on. Build them separate rooms.`);
    }
  }
}

// ---------- Coblyn ----------

function claimedDrop(s: GameState, drop: Vec, self: Entity): boolean {
  return s.entities.some((o) => o !== self && o.task === 'gather' && o.target?.x === drop.x && o.target?.y === drop.y);
}

function claimed(s: GameState, rock: Vec, self: Entity): boolean {
  return s.entities.some((o) => o !== self && o.task === 'dig' && o.target?.x === rock.x && o.target?.y === rock.y);
}

function claimedTrap(s: GameState, id: number, self: Entity): boolean {
  return s.entities.some((o) => o !== self && o.task === 'build' && o.targetId === id);
}

/** Nearest pile (if the Treasury has room for it), else an unbuilt engine, else nearest unclaimed marked rock. */
function findWork(s: GameState, e: Entity): boolean {
  const here = tileOf(e);
  let bestTrap: (typeof s.traps)[number] | null = null;
  let bestTrapD = Infinity;
  for (const t of s.traps) {
    if (t.built || claimedTrap(s, t.id, e)) continue;
    const d = distBetween(here, t);
    if (d < bestTrapD && findPath(s.grid, here, t, 'floor')) {
      bestTrapD = d;
      bestTrap = t;
    }
  }
  if (bestTrap && setPath(s, e, bestTrap, 'floor')) {
    e.task = 'build';
    e.target = { x: bestTrap.x, y: bestTrap.y };
    e.targetId = bestTrap.id;
    return true;
  }
  let bestDrop: Vec | null = null;
  let bestD = Infinity;
  if (treasurySpace(s) > 0) {
    for (const d of s.drops) {
      const dd = distBetween(here, d);
      if (dd < bestD && !claimedDrop(s, d, e) && findPath(s.grid, here, d, 'floor')) {
        bestD = dd;
        bestDrop = d;
      }
    }
  }
  if (bestDrop && setPath(s, e, bestDrop, 'floor')) {
    e.task = 'gather';
    e.target = bestDrop;
    return true;
  }
  const field = dijkstra(s.grid, here, 'worker');
  let bestRock: Vec | null = null;
  bestD = Infinity;
  for (const rock of markedTiles(s.grid)) {
    if (claimed(s, rock, e)) continue;
    for (const n of neighbors4(s.grid, rock.x, rock.y)) {
      const d = (field.dist[n.y * s.grid.w + n.x] as number) + 1;
      if (d < bestD) {
        bestD = d;
        bestRock = rock;
      }
    }
  }
  if (!bestRock || !setPath(s, e, bestRock, 'worker')) return false;
  e.path.pop(); // stop adjacent to the rock rather than on it
  e.task = 'dig';
  e.target = bestRock;
  e.timer = 0;
  return true;
}

export function updateWorker(s: GameState, e: Entity, dt: number): void {
  const threat = nearest(e, s.entities, 2.5, isHero);
  if (threat) {
    flee(s, e, threat, dt);
    return;
  }
  if (e.task === 'flee') idle(e, 0);
  if (e.task === 'dig' && e.target) {
    const { x, y } = e.target;
    if (!isMarked(s.grid, x, y)) idle(e, 0);
    else if (walk(s, e, dt)) {
      e.timer += dt;
      if (e.timer >= DIG_SECONDS) {
        digTile(s, x, y);
        idle(e, 0);
      }
    }
    return;
  }
  if (e.task === 'gather' && e.target) {
    const t = e.target;
    const drop = s.drops.find((d) => d.x === t.x && d.y === t.y);
    if (!drop) idle(e, 0);
    else if (walk(s, e, dt)) {
      e.carrying += drop.gold;
      s.drops.splice(s.drops.indexOf(drop), 1);
      idle(e, 0);
    }
    return;
  }
  if (e.task === 'build') {
    const trap = s.traps.find((t) => t.id === e.targetId);
    if (!trap || trap.built) idle(e, 0);
    else if (walk(s, e, dt)) {
      trap.progress += dt / ENGINES[trap.kind].stats.build;
      if (trap.progress >= 1) {
        trap.progress = 1;
        trap.built = true;
        addLog(s, `The Coblynau have finished the ${ENGINES[trap.kind].name.toLowerCase()}. It is now a surprise.`);
        idle(e, 0);
      }
    }
    return;
  }
  if (e.task === 'nudge' && e.target) {
    if (walk(s, e, dt)) idle(e, 0.5);
    return;
  }
  if (e.carrying > 0) {
    carryToTreasury(s, e, dt);
    return;
  }
  if (findWork(s, e)) return;
  wander(s, e, dt);
}

/** Walk the gold in hand to the nearest Treasury tile and bank it; drop it if there is no room. */
function carryToTreasury(s: GameState, e: Entity, dt: number): void {
  const vault = treasurySpace(s) > 0 ? nearestTile(s, e, Tile.Treasury) : null;
  if (!vault) {
    dropGold(s, tileOf(e), e.carrying);
    e.carrying = 0;
    idle(e, 0.5);
    return;
  }
  if (seekTile(s, e, vault, 'carry', dt)) {
    e.carrying = depositGold(s, e.carrying);
    if (e.carrying > 0) {
      dropGold(s, tileOf(e), e.carrying);
      e.carrying = 0;
    }
    idle(e, 0.2);
  }
}

// ---------- Cŵn Annwn, Pwca, Gwyllgi, Ceffyl Dŵr, Afanc ----------

/** Where this creature would rather rest: the Pool for the water-beasts, else a Lair. */
function restTile(s: GameState, e: Entity): Vec | null {
  if (e.kind === 'afanc' || e.kind === 'ceffyl') {
    const pool = nearestTile(s, e, Tile.Pool);
    if (pool) return pool;
  }
  return nearestTile(s, e, Tile.Lair);
}

export function updateCreature(s: GameState, e: Entity, dt: number): void {
  if (e.task !== 'sleep') {
    e.hunger += hungerRate(e) * dt;
    e.sleep += SLEEP_RATE * dt;
  }
  e.temper = Math.max(0, e.temper - 0.5 * dt);
  if (e.task !== 'chase' && e.task !== 'retreat' && e.mood !== 'angry' && e.hp < e.maxHp) {
    e.hp = Math.min(e.maxHp, e.hp + REGEN * dt);
  }
  squabble(s, e, dt);
  if (e.kind === 'pwca' && s.gold > 0 && s.rng() < dt / 12) spend(s, 1);
  if (e.kind === 'pwca') {
    const mark = nearest(e, s.entities, 2, isFair);
    if (mark && s.rng() < dt / 6) offendEmissary(s, mark, 'robbed');
  }

  const threat = nearest(e, s.entities, 4, isHero);
  e.mood = deriveMood(e, threat !== null);

  // Fear beats everything except the Gwyllgi's stubbornness.
  if (e.mood === 'afraid' && threat && e.kind !== 'gwyllgi') {
    flee(s, e, threat, dt);
    return;
  }
  // The Ceffyl Dŵr breaks off after a blow, then comes round again.
  if (e.task === 'retreat') {
    e.stay -= dt;
    const foe = s.entities.find((o) => o.id === e.targetId);
    if (e.stay > 0 && foe) {
      flee(s, e, foe, dt);
      e.task = 'retreat';
      return;
    }
    idle(e, 0);
  }

  // The relic's hush: nothing near the bearer can bring itself to bite. Creatures back away from it.
  const relic = nearest(e, s.entities, RELIC_RADIUS, (o) => o.kind === 'relic');
  if (relic) {
    flee(s, e, relic, dt);
    e.task = 'hold';
    return;
  }
  const range = e.kind === 'gwyllgi' ? GWYLLGI_RANGE : 7;
  const foe = nearest(e, s.entities, range, (o) => isHero(o) && !(e.kind === 'pwca' && o.kind === 'knight' && e.hp <= 10));
  if (foe) {
    const hpBefore = foe.hp;
    engage(s, e, foe, dt, 'floor');
    if (e.kind === 'ceffyl' && foe.hp < hpBefore) {
      e.task = 'retreat';
      e.targetId = foe.id;
      e.stay = CEFFYL_RETREAT;
      e.path = [];
      e.pathGoal = null;
    }
    return;
  }
  if (e.task === 'chase' || e.task === 'hold') idle(e, 0);

  if (e.task === 'nudge' && e.target) {
    if (walk(s, e, dt)) idle(e, 0.5);
    return;
  }
  if (e.task === 'eat') {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.hunger = 0;
      e.hp = Math.min(e.maxHp, e.hp + EAT_HEAL);
      e.temper = Math.max(0, e.temper - 20);
      idle(e, 0.3);
    }
    return;
  }
  if (e.task === 'sleep') {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.sleep = 0;
      e.hp = Math.min(e.maxHp, e.hp + NAP_HEAL);
      e.temper = Math.max(0, e.temper - 30);
      idle(e, 0.3);
    }
    return;
  }
  if (e.hunger > HUNGER_EAT) {
    const food = nearestTile(s, e, Tile.Hatchery);
    if (food) {
      if (seekTile(s, e, food, 'toFood', dt)) {
        e.task = 'eat';
        e.timer = EAT_SECONDS;
      }
      return;
    }
    if (e.hunger > HUNGER_LEAVE) {
      removeEntity(s, e);
      addLog(s, `Unfed, the ${BESTIARY[e.kind].name} has left for the hunt. It will not return.`);
      return;
    }
  }
  if (e.sleep > SLEEP_AT) {
    const bed = restTile(s, e);
    if (bed) {
      if (seekTile(s, e, bed, 'toBed', dt)) {
        e.task = 'sleep';
        e.timer = NAP_SECONDS;
      }
      return;
    }
  }
  wander(s, e, dt);
}

// ---------- Tylwyth Teg emissary ----------

export function updateEmissary(s: GameState, e: Entity, dt: number): void {
  e.stay -= dt;
  if (e.stay <= 0) {
    removeEntity(s, e);
    s.tegCooldown = 120;
    addLog(s, 'The emissary bows, and is not there. The terms, it says, stand until next time.');
    return;
  }
  const threat = nearest(e, s.entities, 4, isHero);
  if (threat) {
    flee(s, e, threat, dt);
    return;
  }
  if (e.task === 'flee') idle(e, 0);
  if (e.task === 'nudge' && e.target) {
    if (walk(s, e, dt)) idle(e, 0.5);
    return;
  }
  wander(s, e, dt);
}

// ---------- Mortal Knight, Hedge-Priest ----------

/** A mortal standing on loose gold pockets it. */
function loot(s: GameState, e: Entity): void {
  if (!atCentre(e)) return;
  const i = s.drops.findIndex((d) => d.x === e.x && d.y === e.y);
  if (i < 0) return;
  const drop = s.drops[i] as { gold: number };
  e.carrying += drop.gold;
  s.drops.splice(i, 1);
  addLog(s, `The ${BESTIARY[e.kind].name} pockets ${drop.gold} gold from the floor. The manual did warn you.`);
}

/** A mortal standing on a built trap springs it. */
function traps(s: GameState, e: Entity): void {
  if (!atCentre(e)) return;
  const trap = s.traps.find((t) => t.built && t.kind !== 'boulder' && t.x === e.x && t.y === e.y);
  if (trap) springTrap(s, trap, e);
}

/** Nerve: allies falling, the Afanc, and dark corridors wear it down; a priest keeps it up. */
function morale(s: GameState, e: Entity, dt: number): void {
  const here = tileOf(e);
  if (isCorridor(s.grid, here.x, here.y)) e.morale -= CORRIDOR_DREAD * dt;
  if (!e.metAfanc && nearest(e, s.entities, 4, (o) => o.kind === 'afanc')) {
    e.metAfanc = true;
    e.morale -= AFANC_DREAD;
  }
  if (e.kind !== 'priest' && nearest(e, s.entities, 2.5, (o) => o.kind === 'priest')) e.morale += PRIEST_COURAGE * dt;
  e.morale = Math.max(0, Math.min(100, e.morale));
}

/** Score a creature as a rival for the Cantref Lord: the biggest, hardest thing in sight. */
const rivalScore = (o: Entity): number => o.maxHp * attackOf(o) + o.hp;

export function updateHero(s: GameState, e: Entity, dt: number): void {
  loot(s, e);
  traps(s, e);
  if (!s.entities.includes(e)) return;
  morale(s, e, dt);
  if (e.morale <= 0) {
    // Run for the nearest Gate and leave with whatever is in hand.
    let gate = s.gates[0] ?? HEART_POS;
    let best = Infinity;
    for (const g of s.gates) {
      const d = distBetween(e, g);
      if (d < best) {
        best = d;
        gate = g;
      }
    }
    if (e.task !== 'flee') {
      e.task = 'flee';
      e.path = [];
      e.pathGoal = null;
      addLog(s, `The ${BESTIARY[e.kind].name}'s nerve goes. He is running for the Gate.`);
    }
    if (distBetween(e, gate) <= 0.2) {
      heroFlees(s, e);
      return;
    }
    if (e.path.length === 0 || e.repath <= 0) {
      e.repath = 1;
      setPath(s, e, gate, 'hero');
    }
    walk(s, e, dt);
    return;
  }
  if (e.kind === 'priest') {
    const knight = nearest(e, s.entities, 2.5, (o) => o.kind === 'knight' || o.kind === 'lord' || o.kind === 'levy');
    if (knight) knight.hp = Math.min(knight.maxHp, knight.hp + PRIEST_HEAL_PER_SECOND * dt);
    const afanc = nearest(e, s.entities, 3, (o) => o.kind === 'afanc');
    if (afanc) {
      flee(s, e, afanc, dt);
      return;
    }
  }
  if (attackOf(e) > 0) {
    // The lord picks a rival; everyone else hits whatever is near.
    let foe: Entity | null = null;
    if (e.kind === 'lord') {
      let best = -Infinity;
      for (const o of s.entities) {
        if (!isCreature(o) || distBetween(e, o) > 8) continue;
        const score = rivalScore(o);
        if (score > best) {
          best = score;
          foe = o;
        }
      }
      if (!foe) foe = nearest(e, s.entities, 1.5, (o) => !isHero(o));
    } else {
      foe = nearest(e, s.entities, 3, (o) => !isHero(o) && !(e.kind === 'priest' && o.kind === 'afanc'));
    }
    if (foe) {
      engage(s, e, foe, dt, 'hero');
      return;
    }
  }
  if (distBetween(e, HEART_POS) <= REACH) {
    e.task = 'strike';
    e.path = [];
    if (e.cooldown <= 0 && attackOf(e) > 0) {
      e.cooldown = HEART_STRIKE_SECONDS;
      strikeHeart(s, e);
    }
    return;
  }
  if (e.task !== 'toHeart' || e.path.length === 0 || e.repath <= 0) {
    e.task = 'toHeart';
    e.repath = 1.5;
    if (setPath(s, e, HEART_POS, 'hero')) e.path.pop();
  }
  walk(s, e, dt);
}

/** Dispatch by allegiance and trade. */
export function updateEntity(s: GameState, e: Entity, dt: number): void {
  if (isHero(e)) updateHero(s, e, dt);
  else if (e.kind === 'coblyn') updateWorker(s, e, dt);
  else if (isFair(e)) updateEmissary(s, e, dt);
  else updateCreature(s, e, dt);
}
