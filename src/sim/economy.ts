import { Tile, type RoomTile } from './grid';

export const ROOM_COST: Record<RoomTile, number> = {
  [Tile.Lair]: 15,
  [Tile.Hatchery]: 25,
  [Tile.Treasury]: 30,
};

export const GOLD_SEAM_PAYOUT = 25;
export const DIG_SECONDS = 0.9;
export const STARTING_GOLD = 120;
export const HEART_HP = 100;

export const sellPrice = (room: RoomTile): number => Math.floor(ROOM_COST[room] / 2);
