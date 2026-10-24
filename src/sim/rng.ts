/** Small seedable PRNG (mulberry32) so the sim is deterministic under test and saveable. */
export interface Rng {
  (): number;
  /** Internal state, so a game can be saved mid-stream and resumed exactly. */
  state: number;
}

export function mulberry32(seed: number): Rng {
  const rng = (() => {
    rng.state = (rng.state + 0x6d2b79f5) >>> 0;
    let t = rng.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  rng.state = seed >>> 0;
  return rng;
}

export const randRange = (rng: Rng, lo: number, hi: number): number => lo + rng() * (hi - lo);
export const randInt = (rng: Rng, lo: number, hi: number): number => Math.floor(randRange(rng, lo, hi + 1));
