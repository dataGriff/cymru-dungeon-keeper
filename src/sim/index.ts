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

/** The sim runs at a fixed 30 Hz; rendering interpolates between ticks. */
export const TICK = 1 / 30;
/** Never simulate more than this much wall time in one frame (tab was hidden). */
export const MAX_FRAME = 0.25;

/** Advance the whole sim by dt seconds with the standard behaviours. */
export function tick(s: GameState, dt: number): void {
  step(s, dt, updateEntity);
}

export interface Clock {
  /** Unsimulated time carried over to the next frame. */
  acc: number;
}

/**
 * Feed wall-clock time in and get fixed ticks out, so the outcome does not
 * depend on frame rate. Returns the interpolation alpha for rendering.
 */
export function advance(s: GameState, clock: Clock, elapsed: number, speed = 1): number {
  clock.acc += Math.min(MAX_FRAME, elapsed) * speed;
  while (clock.acc >= TICK) {
    tick(s, TICK);
    clock.acc -= TICK;
  }
  return clock.acc / TICK;
}
