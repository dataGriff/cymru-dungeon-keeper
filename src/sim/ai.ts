/**
 * Behaviours. Each is a few lines on purpose: workers dig and flee, creatures
 * eat, sleep, fight and wander, heroes walk to the Heart and hit what is near.
 */
import { BESTIARY } from '../data/bestiary';
import { DIG_SECONDS } from './economy';
import {
  type Entity,
  attackOf,
  distBetween,
  hungerRate,
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
  removeEntity,
  spend,
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
  isMarked,
  isRock,
  isWalkable,
  markedTiles,
  neighbors4,
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
export const EAT_HEAL = 3;
export const NAP_SECONDS = 2.5;
export const NAP_HEAL = 10;
export const SWING_SECONDS = 0.8;
export const HEART_STRIKE_SECONDS = 1;
export const REACH = 1.15;
export const TUNNEL_SPEED = 0.25;
export const PRIEST_HEAL_PER_SECOND = 1.2;

// ---------- movement ----------

/** Advance along the path. Returns true once there is nothing left to walk. */
export function walk(s: GameState, e: Entity, dt: number): boolean {
  const next = e.path[0];
  if (!next) return true;
  const onRock = isRock(tileAt(s.grid, next.x, next.y));
  const stepLen = speedOf(e) * (onRock ? TUNNEL_SPEED : 1) * dt;
  const dx = next.x - e.x;
  const dy = next.y - e.y;
  const d = Math.hypot(dx, dy);
  if (dx !== 0) e.facing = dx < 0 ? -1 : 1;
  if (d <= stepLen) {
    e.x = next.x;
    e.y = next.y;
    e.path.shift();
    if (onRock) tunnelTile(s, next.x, next.y);
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

// ---------- Coblyn ----------

function claimedDrop(s: GameState, drop: Vec, self: Entity): boolean {
  return s.entities.some((o) => o !== self && o.task === 'gather' && o.target?.x === drop.x && o.target?.y === drop.y);
}

function claimed(s: GameState, rock: Vec, self: Entity): boolean {
  return s.entities.some((o) => o !== self && o.task === 'dig' && o.target?.x === rock.x && o.target?.y === rock.y);
}

/** Nearest pile (if the Treasury has room for it), else nearest unclaimed marked rock. */
function findWork(s: GameState, e: Entity): boolean {
  const here = tileOf(e);
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

// ---------- Cŵn Annwn, Pwca, Afanc ----------

export function updateCreature(s: GameState, e: Entity, dt: number): void {
  if (e.task !== 'sleep') {
    e.hunger += hungerRate(e) * dt;
    e.sleep += SLEEP_RATE * dt;
  }
  if (e.kind === 'pwca' && s.gold > 0 && s.rng() < dt / 12) spend(s, 1);

  const foe = nearest(e, s.entities, 7, (o) => isHero(o) && !(e.kind === 'pwca' && o.kind === 'knight' && e.hp <= 10));
  if (foe) {
    engage(s, e, foe, dt, 'floor');
    return;
  }
  if (e.task === 'chase') idle(e, 0);

  if (e.task === 'eat') {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.hunger = 0;
      e.hp = Math.min(e.maxHp, e.hp + EAT_HEAL);
      idle(e, 0.3);
    }
    return;
  }
  if (e.task === 'sleep') {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.sleep = 0;
      e.hp = Math.min(e.maxHp, e.hp + NAP_HEAL);
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
    const bed = nearestTile(s, e, Tile.Lair);
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

export function updateHero(s: GameState, e: Entity, dt: number): void {
  loot(s, e);
  if (e.kind === 'priest') {
    const knight = nearest(e, s.entities, 2.5, (o) => o.kind === 'knight');
    if (knight) knight.hp = Math.min(knight.maxHp, knight.hp + PRIEST_HEAL_PER_SECOND * dt);
    const afanc = nearest(e, s.entities, 3, (o) => o.kind === 'afanc');
    if (afanc) {
      flee(s, e, afanc, dt);
      return;
    }
  }
  const foe = nearest(e, s.entities, 3, (o) => !isHero(o) && !(e.kind === 'priest' && o.kind === 'afanc'));
  if (foe) {
    engage(s, e, foe, dt, 'hero');
    return;
  }
  if (distBetween(e, HEART_POS) <= REACH) {
    e.task = 'strike';
    e.path = [];
    if (e.cooldown <= 0) {
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
  else updateCreature(s, e, dt);
}
