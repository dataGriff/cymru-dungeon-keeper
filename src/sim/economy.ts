import { Tile, type RoomTile } from './grid';

export const ROOM_COST: Record<RoomTile, number> = {
  [Tile.Lair]: 15,
  [Tile.Hatchery]: 25,
  [Tile.Treasury]: 30,
  [Tile.Pool]: 40,
};

export const GOLD_SEAM_PAYOUT = 25;
export const DIG_SECONDS = 0.9;
export const STARTING_GOLD = 150;
export const HEART_HP = 100;

export const sellPrice = (room: RoomTile): number => Math.floor(ROOM_COST[room] / 2);

/** Gold one Treasury tile holds; a tile in a region of 4+ holds more. */
export const TREASURY_BASE_CAPACITY = 50;
export const TREASURY_REGION_BONUS = 10;
/** Payday comes round this often; the first one waits until the steward has met a wave. */
export const PAY_INTERVAL = 60;
export const FIRST_PAYDAY = 90;
/** How many unpaid paydays a creature tolerates: angry after the first, gone on the second. */
export const UNPAID_TOLERANCE = 2;
