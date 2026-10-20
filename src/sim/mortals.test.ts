import { describe, expect, it } from 'vitest';
import { ENGINES, HERO_DROP } from '../data/bestiary';
import { CAIRN, SIEGE } from '../data/waves';
import { AFANC_DREAD } from './ai';
import { createGame, damage, finalWave, heroCount, nextWave, planTrap, spawn, trapAt } from './game';
import { GATE_POS, Tile, setTile } from './grid';
import { tick } from './index';

const run = (s: ReturnType<typeof createGame>, seconds: number, dt = 0.05): void => {
  for (let t = 0; t < seconds - 1e-9; t += dt) tick(s, dt);
};

describe('wave schedules', () => {
  it('the Cairn has three waves at 40, 95 and 150 through the one Gate', () => {
    expect(CAIRN.waves.map((w) => w.at)).toEqual([40, 95, 150]);
    expect(CAIRN.waves.every((w) => w.gate === 0)).toBe(true);
    expect(CAIRN.waves[1]?.heroes).toContain('levy');
    expect(SIEGE.waves.some((w) => w.heroes.includes('relic'))).toBe(true);
    expect(SIEGE.waves.some((w) => w.heroes.includes('lord'))).toBe(true);
    expect(SIEGE.waves.some((w) => w.gate === 1)).toBe(true);
  });

  it('the sim spawns exactly what the schedule says, and previews the next wave', () => {
    const s = createGame(80);
    expect(finalWave(s)).toBe(3);
    expect(nextWave(s)).toEqual(CAIRN.waves[0]?.heroes);
    s.entities = [];
    run(s, 41);
    expect(nextWave(s)).toEqual(CAIRN.waves[1]?.heroes);
    run(s, 56);
    expect(s.wave).toBe(2);
    run(s, 6);
    const kinds = s.entities
      .filter((e) => e.kind !== 'coblyn')
      .map((e) => e.kind)
      .sort();
    expect(kinds).toEqual([...(CAIRN.waves[0]?.heroes ?? []), ...(CAIRN.waves[1]?.heroes ?? [])].sort());
  });

  it('a wave can come through a second Gate', () => {
    const s = createGame(81, undefined, { name: 'test', waves: [{ at: 1, gate: 1, heroes: ['knight'] }] });
    setTile(s.grid, 0, 2, Tile.Gate);
    s.gates = [GATE_POS, { x: 0, y: 2 }];
    s.entities = [];
    run(s, 1.2);
    const knight = s.entities.find((e) => e.kind === 'knight');
    expect(knight).toBeDefined();
    expect([Math.round(knight!.x), Math.round(knight!.y)]).toEqual([0, 2]);
  });
});

describe('the new mortals', () => {
  it('the Cantref Lord goes for the strongest creature, not the nearest', () => {
    const s = createGame(82);
    s.entities = [];
    for (let x = 1; x <= 14; x++) setTile(s.grid, x, 8, Tile.Floor);
    setTile(s.grid, 8, 7, Tile.Floor);
    const pwca = spawn(s, 'pwca', { x: 8, y: 7 });
    const afanc = spawn(s, 'afanc', { x: 5, y: 8 });
    const lord = spawn(s, 'lord', { x: 9, y: 8 });
    tick(s, 0.05);
    expect(lord.task).toBe('chase');
    expect(lord.targetId).toBe(afanc.id);
    expect(lord.targetId).not.toBe(pwca.id);
  });

  it('the levy breaks when the first of them falls', () => {
    const s = createGame(83);
    s.entities = [];
    const a = spawn(s, 'levy', { x: 20, y: 8 });
    const b = spawn(s, 'levy', { x: 21, y: 8 });
    expect(b.morale).toBe(100);
    damage(s, a, 999);
    expect(b.morale).toBe(0);
    tick(s, 0.05);
    expect(b.task).toBe('flee');
    run(s, 3);
    expect(heroCount(s)).toBe(0);
    expect(s.fled).toBe(1);
    expect(s.slain).toBe(1);
    expect(s.drops[0]?.gold).toBe(HERO_DROP.levy);
  });

  it('nothing within the relic hush will fight; outside it, they do', () => {
    const s = createGame(84);
    s.entities = [];
    for (let x = 1; x <= 14; x++) setTile(s.grid, x, 8, Tile.Floor);
    const hound = spawn(s, 'cwn', { x: 6, y: 8 });
    const knight = spawn(s, 'knight', { x: 7, y: 8 });
    knight.cooldown = 99;
    spawn(s, 'relic', { x: 8, y: 8 });
    tick(s, 0.05);
    expect(knight.hp).toBe(knight.maxHp);
    expect(hound.task).toBe('hold');
    const s2 = createGame(85);
    s2.entities = [];
    for (let x = 1; x <= 14; x++) setTile(s2.grid, x, 8, Tile.Floor);
    const hound2 = spawn(s2, 'cwn', { x: 6, y: 8 });
    const knight2 = spawn(s2, 'knight', { x: 7, y: 8 });
    knight2.cooldown = 99;
    spawn(s2, 'relic', { x: 12, y: 8 });
    tick(s2, 0.05);
    expect(hound2.task).toBe('chase');
    expect(knight2.hp).toBeLessThan(knight2.maxHp);
  });

  it('the reliquary bearer never strikes the Heart', () => {
    const s = createGame(86);
    s.entities = [];
    spawn(s, 'relic', { x: 4, y: 8 });
    run(s, 3);
    expect(s.heartHp).toBe(100);
  });
});

describe('morale', () => {
  it('meeting the Afanc costs nerve once; a fallen ally costs nerve nearby', () => {
    const s = createGame(87);
    s.entities = [];
    for (let x = 1; x <= 14; x++) setTile(s.grid, x, 8, Tile.Floor);
    const knight = spawn(s, 'knight', { x: 10, y: 8 });
    spawn(s, 'afanc', { x: 7, y: 8 });
    tick(s, 0.05);
    expect(knight.morale).toBeLessThanOrEqual(100 - AFANC_DREAD);
    const before = knight.morale;
    tick(s, 0.05);
    expect(knight.morale).toBeGreaterThan(before - 1);
    const friend = spawn(s, 'knight', { x: 11, y: 8 });
    damage(s, friend, 999);
    expect(knight.morale).toBeLessThanOrEqual(before - 25 + 0.1);
  });

  it('dark corridors wear nerve down; a broken mortal runs for the Gate with your gold', () => {
    const s = createGame(88);
    s.entities = [];
    for (let x = 6; x <= 22; x++) setTile(s.grid, x, 8, Tile.Floor);
    const knight = spawn(s, 'knight', { x: 15, y: 8 });
    knight.morale = 2;
    knight.carrying = 25;
    run(s, 2);
    expect(knight.task).toBe('flee');
    run(s, 12);
    expect(heroCount(s)).toBe(0);
    expect(s.fled).toBe(1);
    expect(s.log.some((l) => /with 25 of your gold/.test(l.text))).toBe(true);
  });

  it('a wave counts as cleared when the last mortal flees', () => {
    const s = createGame(89);
    s.entities = [];
    s.wave = finalWave(s);
    s.waveActive = true;
    const knight = spawn(s, 'knight', { x: 22, y: 8 });
    knight.morale = 0;
    run(s, 3);
    expect(s.status).toBe('won');
  });
});

describe('engines of the hall', () => {
  function floorRow(s: ReturnType<typeof createGame>, x0: number, x1: number, y: number): void {
    for (let x = x0; x <= x1; x++) setTile(s.grid, x, y, Tile.Floor);
  }

  it('a trap is planned for gold, built by a Coblyn, and cancellable with a refund until then', () => {
    const s = createGame(90);
    const gold = s.gold;
    expect(planTrap(s, 10, 2, 'pit')).toBe('blocked'); // rock
    expect(planTrap(s, 2, 7, 'pit')).toBe('planned');
    expect(s.gold).toBe(gold - ENGINES.pit.stats.cost);
    expect(planTrap(s, 2, 7, 'pit')).toBe('cancelled');
    expect(s.gold).toBe(gold);
    expect(planTrap(s, 2, 7, 'snare')).toBe('planned');
    run(s, 10);
    const trap = trapAt(s, 2, 7);
    expect(trap?.built).toBe(true);
    expect(planTrap(s, 2, 7, 'snare')).toBe('blocked');
    expect(s.log.some((l) => /finished the cold iron snare/.test(l.text))).toBe(true);
  });

  it('a pit hurts and slows the first mortal to step in, then is spent', () => {
    const s = createGame(91);
    s.entities = [];
    floorRow(s, 6, 22, 8);
    planTrap(s, 12, 8, 'pit');
    trapAt(s, 12, 8)!.built = true;
    const knight = spawn(s, 'knight', { x: 14, y: 8 });
    run(s, 2);
    expect(knight.hp).toBe(knight.maxHp - ENGINES.pit.stats.damage);
    expect(knight.slow).toBeGreaterThan(0);
    expect(trapAt(s, 12, 8)).toBeUndefined();
    // Your own creatures know where the pits are.
    planTrap(s, 7, 8, 'pit');
    trapAt(s, 7, 8)!.built = true;
    const hound = spawn(s, 'cwn', { x: 7, y: 8 });
    hound.task = 'sleep';
    hound.timer = 999;
    tick(s, 0.05);
    expect(hound.hp).toBe(hound.maxHp);
    expect(trapAt(s, 7, 8)?.built).toBe(true);
  });

  it('a snare holds a mortal fast for four seconds', () => {
    const s = createGame(92);
    s.entities = [];
    floorRow(s, 6, 22, 8);
    planTrap(s, 12, 8, 'snare');
    trapAt(s, 12, 8)!.built = true;
    const knight = spawn(s, 'knight', { x: 13, y: 8 });
    run(s, 1);
    expect(knight.held).toBeGreaterThan(2.5);
    const x = knight.x;
    run(s, 2);
    expect(knight.x).toBe(x);
    run(s, 3);
    expect(knight.x).toBeLessThan(x);
  });

  it('a boulder rolls down a straight corridor at the first mortal in line and crushes him', () => {
    const s = createGame(93);
    s.entities = [];
    floorRow(s, 6, 22, 8);
    planTrap(s, 8, 8, 'boulder');
    trapAt(s, 8, 8)!.built = true;
    const knight = spawn(s, 'knight', { x: 14, y: 8 });
    knight.cooldown = 999;
    const hound = spawn(s, 'cwn', { x: 10, y: 8 });
    hound.task = 'sleep';
    hound.timer = 999;
    run(s, 0.1);
    expect(s.boulders).toHaveLength(1);
    expect(trapAt(s, 8, 8)).toBeUndefined();
    run(s, 3);
    expect(knight.hp).toBeLessThan(knight.maxHp - 10);
    expect(hound.hp).toBe(hound.maxHp);
    expect(s.boulders).toHaveLength(0);
  });

  it('a boulder does not roll for a mortal around a corner', () => {
    const s = createGame(94);
    s.entities = [];
    floorRow(s, 6, 12, 8);
    for (let y = 8; y <= 12; y++) setTile(s.grid, 12, y, Tile.Floor);
    planTrap(s, 8, 8, 'boulder');
    trapAt(s, 8, 8)!.built = true;
    spawn(s, 'knight', { x: 12, y: 12 });
    run(s, 0.1);
    expect(s.boulders).toHaveLength(0);
  });
});
