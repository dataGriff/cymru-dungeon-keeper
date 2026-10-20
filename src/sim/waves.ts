import type { BeastKind } from '../data/bestiary';

export const FIRST_WAVE_AT = 40;
export const WAVE_INTERVAL = 55;
export const FINAL_WAVE = 3;
/** Seconds between heroes stepping through the Gate within one wave. */
export const WAVE_STAGGER = 0.7;

/** Wave n brings 1+n mortals; from wave 2 every second one is a Hedge-Priest. */
export function waveComposition(n: number): BeastKind[] {
  const out: BeastKind[] = [];
  for (let i = 0; i < 1 + n; i++) out.push(n >= 2 && i % 2 === 1 ? 'priest' : 'knight');
  return out;
}

export const waveTime = (n: number): number => FIRST_WAVE_AT + (n - 1) * WAVE_INTERVAL;
