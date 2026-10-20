export * from './grid';
export * from './rng';
export * from './path';
export * from './entities';
export * from './economy';
export * from './waves';
export * from './game';
export * from './ai';

import { updateEntity } from './ai';
import { type GameState, step } from './game';

/** Advance the whole sim by dt seconds with the standard behaviours. */
export function tick(s: GameState, dt: number): void {
  step(s, dt, updateEntity);
}
