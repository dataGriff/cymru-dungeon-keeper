import { describe, expect, it } from 'vitest';
import { TRADES, WARD_SECONDS } from '../data/bestiary';
import { ANGRY_AT, SQUABBLE_LOG_GAP, nudge } from './ai';
import { STARTING_GOLD } from './economy';
import {
  TEG_VAULT_THRESHOLD,
  chooseArrival,
  countKind,
  createGame,
  damage,
  heroCount,
  spawn,
  trade,
  warded,
} from './game';
import { ALL_DENIZENS, THE_CAIRN } from '../data/levels';
import { GATE_POS, PORTAL_POS, type RoomTile, Tile, isCorridor, setTile } from './grid';
import { tick } from './index';
import { FIRST_WAVE_AT } from './waves';

function strip(s: ReturnType<typeof createGame>, room: RoomTile, n: number, x0: number, y0: number): void {
  for (let i = 0; i < n; i++) setTile(s.grid, x0 + i, y0, room);
}

describe('new denizens arrive on their own terms', () => {
  const ALL = { ...THE_CAIRN, allowed: ALL_DENIZENS };

  it('Gwyllgi wants a Lair of 6 and a Treasury of 3, two at most', () => {
    const s = createGame(60, undefined, ALL);
    strip(s, Tile.Lair, 6, 6, 1);
    strip(s, Tile.Treasury, 2, 6, 3);
    strip(s, Tile.Hatchery, 2, 6, 5);
    for (let i = 0; i < 3; i++) spawn(s, 'cwn', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    spawn(s, 'pwca', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
    strip(s, Tile.Treasury, 3, 6, 3);
    expect(chooseArrival(s)).toBe('gwyllgi');
    spawn(s, 'gwyllgi', PORTAL_POS);
    spawn(s, 'gwyllgi', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('Ceffyl Dŵr wants a Pool of 3 and a Lair of 4, one only', () => {
    const s = createGame(61, undefined, ALL);
    strip(s, Tile.Lair, 4, 6, 1);
    strip(s, Tile.Pool, 2, 6, 3);
    expect(chooseArrival(s)).toBeNull();
    strip(s, Tile.Pool, 3, 6, 3);
    expect(chooseArrival(s)).toBe('ceffyl');
    spawn(s, 'ceffyl', PORTAL_POS);
    expect(chooseArrival(s)).toBeNull();
  });

  it('the emissary comes when the vault is rich, and not twice in a row', () => {
    const s = createGame(62);
    strip(s, Tile.Treasury, 4, 6, 1);
    s.gold = STARTING_GOLD + TEG_VAULT_THRESHOLD - 1;
    expect(chooseArrival(s)).toBeNull();
    s.gold = STARTING_GOLD + TEG_VAULT_THRESHOLD;
    expect(chooseArrival(s)).toBe('teg');
    s.tegCooldown = 10;
    expect(chooseArrival(s)).toBeNull();
  });
});

describe('Gwyllgi', () => {
  it('takes half damage in a corridor and full damage in the open', () => {
    const s = createGame(63);
    for (let x = 6; x <= 10; x++) setTile(s.grid, x, 8, Tile.Floor);
    expect(isCorridor(s.grid, 8, 8)).toBe(true);
    expect(isCorridor(s.grid, 3, 7)).toBe(false);
    const inCorridor = spawn(s, 'gwyllgi', { x: 8, y: 8 });
    const inOpen = spawn(s, 'gwyllgi', { x: 3, y: 7 });
    damage(s, inCorridor, 10);
    damage(s, inOpen, 10);
    expect(inCorridor.hp).toBe(45);
    expect(inOpen.hp).toBe(40);
  });

  it('is slow to anger: ignores a mortal more than four tiles off', () => {
    const s = createGame(64);
    s.entities = [];
    for (let x = 1; x <= 12; x++) setTile(s.grid, x, 8, Tile.Floor);
    const dog = spawn(s, 'gwyllgi', { x: 5, y: 8 });
    spawn(s, 'knight', { x: 11, y: 8 });
    tick(s, 0.1);
    expect(dog.task).not.toBe('chase');
    const hound = spawn(s, 'cwn', { x: 5, y: 9 });
    setTile(s.grid, 5, 9, Tile.Floor);
    tick(s, 0.1);
    expect(hound.task).toBe('chase');
  });
});

describe('Ceffyl Dŵr', () => {
  it('breaks off after landing a blow, then comes round again', () => {
    const s = createGame(65);
    s.entities = [];
    for (let x = 1; x <= 12; x++) setTile(s.grid, x, 8, Tile.Floor);
    const horse = spawn(s, 'ceffyl', { x: 5, y: 8 });
    const knight = spawn(s, 'knight', { x: 6, y: 8 });
    knight.cooldown = 99;
    tick(s, 0.05);
    expect(knight.hp).toBe(40 - 6);
    expect(horse.task).toBe('retreat');
    for (let t = 0; t < 1.2; t += 0.05) tick(s, 0.05);
    expect(horse.task).toBe('chase');
  });
});

describe('moods', () => {
  it('derives hungry, tired, angry and afraid from the meters', () => {
    const s = createGame(66);
    s.entities = [];
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    tick(s, 0.05);
    expect(hound.mood).toBe('content');
    hound.hunger = 19;
    tick(s, 0.05);
    expect(hound.mood).toBe('hungry');
    hound.hunger = 0;
    hound.sleep = 21;
    tick(s, 0.05);
    expect(hound.mood).toBe('tired');
    hound.sleep = 0;
    hound.temper = ANGRY_AT + 5;
    tick(s, 0.05);
    expect(hound.mood).toBe('angry');
    hound.temper = 0;
    hound.hp = 5;
    spawn(s, 'knight', { x: 4, y: 7 });
    tick(s, 0.05);
    expect(hound.mood).toBe('afraid');
    expect(hound.task).toBe('flee');
  });

  it('dislikes sharing a Lair: temper rises, HP does not, and the log says so once a minute', () => {
    const s = createGame(67);
    s.entities = [];
    strip(s, Tile.Lair, 3, 2, 6);
    const hound = spawn(s, 'cwn', { x: 2, y: 6 });
    const pwca = spawn(s, 'pwca', { x: 3, y: 6 });
    hound.task = 'sleep';
    pwca.task = 'sleep';
    hound.timer = 999;
    pwca.timer = 999;
    for (let t = 0; t < 2; t += 0.05) tick(s, 0.05);
    expect(hound.temper).toBeGreaterThan(10);
    expect(pwca.temper).toBeGreaterThan(10);
    expect(hound.hp).toBe(hound.maxHp);
    const growls = (): number => s.log.filter((l) => /not getting on/.test(l.text)).length;
    expect(growls()).toBe(1);
    for (let t = 0; t < SQUABBLE_LOG_GAP - 3; t += 0.05) tick(s, 0.05);
    expect(growls()).toBe(1);
    for (let t = 0; t < 3; t += 0.05) tick(s, 0.05);
    expect(growls()).toBe(2);
  });

  it('a nudge overrides wandering but never a fight', () => {
    const s = createGame(68);
    s.entities = [];
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    expect(nudge(s, hound, { x: 5, y: 10 })).toBe(true);
    expect(hound.task).toBe('nudge');
    for (let t = 0; t < 6 && hound.task === 'nudge'; t += 0.05) tick(s, 0.05);
    expect([hound.x, hound.y]).toEqual([5, 10]);
    spawn(s, 'knight', { x: 4, y: 10 });
    tick(s, 0.05);
    expect(hound.task).toBe('chase');
    expect(nudge(s, hound, { x: 2, y: 7 })).toBe(false);
    expect(hound.task).toBe('chase');
  });
});

describe('the emissary', () => {
  function withEmissary(seed: number): ReturnType<typeof createGame> {
    const s = createGame(seed);
    s.entities = [];
    const teg = spawn(s, 'teg', { x: 2, y: 7 });
    teg.stay = 60;
    return s;
  }

  it('sells a ward that holds the Gate shut for thirty seconds', () => {
    const s = withEmissary(70);
    s.gold = 100;
    expect(trade(s, 'ward')).toBe(true);
    expect(s.gold).toBe(100 - TRADES.ward.cost);
    expect(warded(s)).toBe(true);
    s.time = FIRST_WAVE_AT - 0.1;
    s.nextWaveAt = FIRST_WAVE_AT;
    s.wardUntil = s.time + WARD_SECONDS;
    for (let t = 0; t < 5; t += 0.1) tick(s, 0.1);
    expect(s.wave).toBe(1);
    expect(heroCount(s)).toBe(0);
    for (let t = 0; t < WARD_SECONDS; t += 0.1) tick(s, 0.1);
    expect(heroCount(s)).toBeGreaterThan(0);
  });

  it('sells a blessing that heals the hall, and refuses the poor', () => {
    const s = withEmissary(71);
    const hound = spawn(s, 'cwn', { x: 3, y: 7 });
    hound.hp = 1;
    s.gold = TRADES.heal.cost - 1;
    expect(trade(s, 'heal')).toBe(false);
    s.gold = TRADES.heal.cost;
    expect(trade(s, 'heal')).toBe(true);
    expect(hound.hp).toBe(hound.maxHp);
    expect(s.gold).toBe(0);
  });

  it('leaves offended when struck, and when the Pwca robs it', () => {
    const s = withEmissary(72);
    const teg = s.entities[0]!;
    damage(s, teg, 1);
    expect(countKind(s, 'teg')).toBe(0);
    expect(s.log.at(-1)?.text).toMatch(/note has been made/);
    expect(trade(s, 'heal')).toBe(false);
    const s2 = withEmissary(73);
    spawn(s2, 'pwca', { x: 3, y: 7 });
    for (let t = 0; t < 60 && countKind(s2, 'teg') > 0; t += 0.05) tick(s2, 0.05);
    expect(countKind(s2, 'teg')).toBe(0);
    expect(s2.log.some((l) => /sleeve/.test(l.text))).toBe(true);
  });

  it('bows out when its minute is up', () => {
    const s = withEmissary(74);
    for (let t = 0; t < 61; t += 0.1) tick(s, 0.1);
    expect(countKind(s, 'teg')).toBe(0);
    expect(s.tegCooldown).toBeGreaterThan(0);
  });
});

describe('bestiary pages', () => {
  it('start unseen, become seen on arrival and studied after a wave is weathered', () => {
    const s = createGame(75);
    expect(s.pages.coblyn).toBe('seen'); // three were there at the start
    expect(s.pages.cwn).toBe('unseen');
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    expect(s.pages.cwn).toBe('seen');
    expect(s.log.at(-1)?.text).toMatch(/page on the Cŵn Annwn/);
    s.wave = 1;
    s.waveActive = true;
    const knight = spawn(s, 'knight', GATE_POS);
    expect(s.pages.knight).toBe('seen');
    damage(s, knight, 999);
    expect(s.pages.knight).toBe('studied');
    tick(s, 0.05);
    expect(s.waveActive).toBe(false);
    expect(s.pages.cwn).toBe('studied');
    expect(hound.hp).toBeGreaterThan(0);
    expect(s.log.some((l) => /Field notes on the Cŵn Annwn/.test(l.text))).toBe(true);
  });

  it('are carried into a new game', () => {
    const s = createGame(76);
    s.pages.afanc = 'studied';
    const next = createGame(77, s.pages);
    expect(next.pages.afanc).toBe('studied');
    expect(next.pages.pwca).toBe('unseen');
  });
});
