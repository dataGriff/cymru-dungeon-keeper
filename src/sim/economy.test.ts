import { describe, expect, it } from 'vitest';
import { HERO_DROP } from '../data/bestiary';
import { GOLD_SEAM_PAYOUT, ROOM_COST, STARTING_GOLD, sellPrice } from './economy';
import { createGame, damage, digTile, markDig, paintRoom, spawn } from './game';
import { Tile, isMarked, setTile, tileAt } from './grid';
import { tick } from './index';

describe('economy', () => {
  it('digging a gold seam pays 25; plain rock pays nothing; both become floor', () => {
    const s = createGame(30);
    setTile(s.grid, 10, 2, Tile.Gold);
    setTile(s.grid, 11, 2, Tile.Rock);
    expect(digTile(s, 10, 2)).toBe(GOLD_SEAM_PAYOUT);
    expect(s.gold).toBe(STARTING_GOLD + 25);
    expect(digTile(s, 11, 2)).toBe(0);
    expect(tileAt(s.grid, 10, 2)).toBe(Tile.Floor);
    expect(tileAt(s.grid, 11, 2)).toBe(Tile.Floor);
    expect(digTile(s, 10, 2)).toBe(0);
  });

  it('marks and unmarks only rock', () => {
    const s = createGame(31);
    expect(markDig(s, 10, 2, true)).toBe(true);
    expect(isMarked(s.grid, 10, 2)).toBe(true);
    expect(markDig(s, 10, 2, true)).toBe(false);
    expect(markDig(s, 10, 2, false)).toBe(true);
    expect(markDig(s, 2, 7, true)).toBe(false); // floor
  });

  it('rooms cost gold to paint and sell back for half', () => {
    const s = createGame(32);
    expect(paintRoom(s, 2, 7, Tile.Treasury)).toBe('built');
    expect(s.gold).toBe(STARTING_GOLD - ROOM_COST[Tile.Treasury]);
    expect(tileAt(s.grid, 2, 7)).toBe(Tile.Treasury);
    expect(paintRoom(s, 2, 7, Tile.Lair)).toBe('blocked');
    expect(paintRoom(s, 2, 7, Tile.Treasury)).toBe('sold');
    expect(s.gold).toBe(STARTING_GOLD - ROOM_COST[Tile.Treasury] + sellPrice(Tile.Treasury));
    expect(tileAt(s.grid, 2, 7)).toBe(Tile.Floor);
    expect(paintRoom(s, 10, 2, Tile.Lair)).toBe('blocked'); // rock
    s.gold = 10;
    expect(paintRoom(s, 2, 7, Tile.Lair)).toBe('poor');
  });

  it('dead heroes drop gold which a Coblyn gathers', () => {
    const s = createGame(33);
    const knight = spawn(s, 'knight', { x: 4, y: 10 });
    const priest = spawn(s, 'priest', { x: 4, y: 6 });
    damage(s, knight, 999);
    damage(s, priest, 999);
    expect(s.drops.map((d) => d.gold).sort()).toEqual([HERO_DROP.priest, HERO_DROP.knight].sort());
    const before = s.gold;
    for (let t = 0; t < 12; t += 0.05) tick(s, 0.05);
    expect(s.drops).toHaveLength(0);
    expect(s.gold).toBe(before + HERO_DROP.knight + HERO_DROP.priest);
  });

  it('a Coblyn digs a marked gold seam and the hall is paid', () => {
    const s = createGame(34);
    setTile(s.grid, 6, 8, Tile.Gold);
    markDig(s, 6, 8, true);
    const before = s.gold;
    for (let t = 0; t < 8; t += 0.05) tick(s, 0.05);
    expect(tileAt(s.grid, 6, 8)).toBe(Tile.Floor);
    expect(s.gold).toBe(before + GOLD_SEAM_PAYOUT);
  });
});
