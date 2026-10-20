import { describe, expect, it } from 'vitest';
import { HUNGER_EAT, HUNGER_LEAVE } from './ai';
import { countKind, createGame, spawn } from './game';
import { Tile, setTile } from './grid';
import { tick } from './index';

describe('hunger', () => {
  it('a creature with no Hatchery leaves once past the threshold', () => {
    const s = createGame(10);
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    hound.hunger = HUNGER_LEAVE - 0.5;
    tick(s, 0.5);
    expect(countKind(s, 'cwn')).toBe(1);
    tick(s, 0.5);
    expect(countKind(s, 'cwn')).toBe(0);
    expect(s.log.at(-1)?.text).toMatch(/left for the hunt/);
  });

  it('a hungry creature walks to a Hatchery, eats and resets', () => {
    const s = createGame(11);
    setTile(s.grid, 4, 10, Tile.Hatchery);
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    hound.hunger = HUNGER_EAT + 1;
    let ate = false;
    for (let t = 0; t < 12 && !ate; t += 0.05) {
      tick(s, 0.05);
      if (hound.task === 'eat') ate = true;
    }
    expect(ate).toBe(true);
    expect(hound.x).toBe(4);
    expect(hound.y).toBe(10);
    for (let t = 0; t < 2; t += 0.05) tick(s, 0.05);
    expect(hound.hunger).toBeLessThan(2);
    expect(countKind(s, 'cwn')).toBe(1);
  });

  it('appetite scales how fast hunger climbs', () => {
    const s = createGame(12);
    const pwca = spawn(s, 'pwca', { x: 2, y: 7 });
    const afanc = spawn(s, 'afanc', { x: 4, y: 9 });
    for (let t = 0; t < 5; t += 0.1) tick(s, 0.1);
    expect(afanc.hunger).toBeGreaterThan(pwca.hunger * 2);
  });
});
