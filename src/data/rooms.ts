/**
 * The rooms a steward can paint, in toolbar order, with what they cost and
 * what the manual says about them. The sim's ROOM_COST is derived from this.
 */
export type RoomKey = 'lair' | 'hatchery' | 'treasury' | 'pool';

export interface RoomEntry {
  key: RoomKey;
  name: string;
  cost: number;
  text: string;
}

export const ROOMS: readonly RoomEntry[] = [
  {
    key: 'lair',
    name: 'Lair',
    cost: 15,
    text: 'Straw on stone where the hall’s creatures sleep off their wounds; nothing arrives through the portal without a bed waiting, and creatures that dislike each other want beds in different rooms.',
  },
  {
    key: 'hatchery',
    name: 'Hatchery',
    cost: 25,
    text: 'A warm pit of eggs that the creatures eat from when hunger takes them; a hall without one is a hall that empties itself back through the portal.',
  },
  {
    key: 'treasury',
    name: 'Treasury',
    cost: 30,
    text: 'The vault the Coblynau carry gold into, fifty a tile and more in a large room; gold left on the floor is merely gold a mortal has not yet pocketed.',
  },
  {
    key: 'pool',
    name: 'Pool',
    cost: 40,
    text: 'Cold water in a cut stone basin for the beasts that came out of lakes; the Afanc and the Ceffyl Dŵr both want it, and would rather not share.',
  },
];

export const roomCost = (key: RoomKey): number => {
  const room = ROOMS.find((r) => r.key === key);
  if (!room) throw new Error(`unknown room ${key}`);
  return room.cost;
};
