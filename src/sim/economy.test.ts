import { describe, expect, it } from 'vitest';
import { HERO_DROP } from '../data/bestiary';
import { GOLD_SEAM_PAYOUT, ROOM_COST, STARTING_GOLD, sellPrice } from './economy';
import { createGame, damage, digTile, looseGold, markDig, paintRoom, payWages, spawn, treasuryCapacity, treasurySpace, vaultGold } from './game';
import { Tile, isMarked, setTile, tileAt } from './grid';
import { tick } from './index';

describe('economy', () => {
  it('digging a gold seam leaves a 25 gold pile; plain rock leaves nothing; both become floor', () => {
    const s = createGame(30);
    setTile(s.grid, 10, 2, Tile.Gold);
    setTile(s.grid, 11, 2, Tile.Rock);
    expect(digTile(s, 10, 2)).toBe(GOLD_SEAM_PAYOUT);
    expect(s.gold).toBe(STARTING_GOLD);
    expect(s.drops).toEqual([{ x: 10, y: 2, gold: 25 }]);
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

  it('dead heroes drop gold which a Coblyn carries to the Treasury', () => {
    const s = createGame(33);
    setTile(s.grid, 2, 6, Tile.Treasury);
    setTile(s.grid, 3, 6, Tile.Treasury);
    const knight = spawn(s, 'knight', { x: 4, y: 10 });
    const priest = spawn(s, 'priest', { x: 4, y: 6 });
    damage(s, knight, 999);
    damage(s, priest, 999);
    expect(s.drops.map((d) => d.gold).sort()).toEqual([HERO_DROP.priest, HERO_DROP.knight].sort());
    const before = s.gold;
    for (let t = 0; t < 14; t += 0.05) tick(s, 0.05);
    expect(s.drops).toHaveLength(0);
    expect(s.gold).toBe(before + HERO_DROP.knight + HERO_DROP.priest);
  });

  it('gold stays on the floor while there is no Treasury to put it in', () => {
    const s = createGame(35);
    setTile(s.grid, 6, 8, Tile.Gold);
    markDig(s, 6, 8, true);
    for (let t = 0; t < 8; t += 0.05) tick(s, 0.05);
    expect(tileAt(s.grid, 6, 8)).toBe(Tile.Floor);
    expect(s.gold).toBe(STARTING_GOLD);
    expect(looseGold(s)).toBe(GOLD_SEAM_PAYOUT);
  });

  it('a Coblyn digs a marked gold seam and carries it to the Treasury', () => {
    const s = createGame(34);
    setTile(s.grid, 2, 6, Tile.Treasury);
    setTile(s.grid, 6, 8, Tile.Gold);
    markDig(s, 6, 8, true);
    for (let t = 0; t < 14; t += 0.05) tick(s, 0.05);
    expect(tileAt(s.grid, 6, 8)).toBe(Tile.Floor);
    expect(s.gold).toBe(STARTING_GOLD + GOLD_SEAM_PAYOUT);
    expect(looseGold(s)).toBe(0);
  });

  it('a knight walking over a pile takes it, and drops it again when he dies', () => {
    const s = createGame(36);
    s.entities = [];
    s.drops.push({ x: 5, y: 8, gold: 40 });
    const knight = spawn(s, 'knight', { x: 7, y: 8 });
    for (let x = 5; x <= 7; x++) setTile(s.grid, x, 8, Tile.Floor);
    for (let t = 0; t < 3; t += 0.05) tick(s, 0.05);
    expect(s.drops).toHaveLength(0);
    expect(knight.carrying).toBe(40);
    expect(s.log.some((l) => /pockets 40 gold/.test(l.text))).toBe(true);
    damage(s, knight, 999);
    expect(s.drops[0]?.gold).toBe(40 + HERO_DROP.knight);
  });

  it('Treasury capacity grows with region size and caps what can be banked', () => {
    const s = createGame(37);
    expect(treasuryCapacity(s.grid)).toBe(0);
    setTile(s.grid, 2, 6, Tile.Treasury);
    expect(treasuryCapacity(s.grid)).toBe(50);
    setTile(s.grid, 3, 6, Tile.Treasury);
    setTile(s.grid, 4, 6, Tile.Treasury);
    setTile(s.grid, 5, 6, Tile.Treasury);
    expect(treasuryCapacity(s.grid)).toBe(4 * 60);
    s.gold = STARTING_GOLD + 230; // purse 150, vault 230 of 240
    s.drops.push({ x: 4, y: 9, gold: 50 });
    for (let t = 0; t < 10; t += 0.05) tick(s, 0.05);
    expect(s.gold).toBe(STARTING_GOLD + 240);
    expect(looseGold(s)).toBe(40);
  });

  it('selling a Treasury tile the vault cannot spare spills gold on the floor', () => {
    const s = createGame(38);
    setTile(s.grid, 2, 6, Tile.Treasury);
    s.gold = STARTING_GOLD + 50;
    expect(paintRoom(s, 2, 6, Tile.Treasury)).toBe('sold');
    expect(s.gold).toBe(STARTING_GOLD + sellPrice(Tile.Treasury));
    expect(looseGold(s)).toBe(50);
  });

  it('spending draws on the purse before the vault, so the vault only fills with new gold', () => {
    const s = createGame(40);
    setTile(s.grid, 2, 6, Tile.Treasury);
    expect(paintRoom(s, 2, 7, Tile.Lair)).toBe('built');
    expect(s.purse).toBe(STARTING_GOLD - ROOM_COST[Tile.Lair]);
    s.drops.push({ x: 2, y: 8, gold: 25 });
    for (let t = 0; t < 8; t += 0.05) tick(s, 0.05);
    expect(s.gold).toBe(STARTING_GOLD - ROOM_COST[Tile.Lair] + 25);
    expect(vaultGold(s)).toBe(25);
    expect(treasurySpace(s)).toBe(25);
    // Spending 100 empties the purse (135) only partly; the vault is untouched.
    expect(paintRoom(s, 2, 9, Tile.Treasury)).toBe('built');
    expect(vaultGold(s)).toBe(25);
  });

  it('payday draws wages; the unpaid grow angry, then leave', () => {
    const s = createGame(39);
    const hound = spawn(s, 'cwn', { x: 2, y: 7 });
    s.gold = 25;
    payWages(s);
    expect(s.gold).toBe(5);
    expect(hound.unpaid).toBe(0);
    expect(s.log.at(-1)?.text).toMatch(/Payday\. 20 gold paid/);
    payWages(s);
    expect(hound.unpaid).toBe(1);
    expect(s.entities).toContain(hound);
    expect(s.log.at(-1)?.text).toMatch(/owed/);
    payWages(s);
    expect(s.entities).not.toContain(hound);
    expect(s.log.at(-1)?.text).toMatch(/unpaid/);
  });
});
