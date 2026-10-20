import { describe, expect, it } from 'vitest';
import { createBot } from './bot';
import { createGame } from './game';
import { tick } from './index';

/** Play the Cairn with the scripted steward on one seed; true if the hall stands. */
export function playCairn(seed: number, opts = { traps: true, trades: true }): { won: boolean; time: number; heart: number } {
  const s = createGame(seed);
  const bot = createBot(opts);
  for (let i = 0; i < 30 * 400 && s.status === 'playing'; i++) {
    bot(s);
    tick(s, 1 / 30);
  }
  return { won: s.status === 'won', time: s.time, heart: s.heartHp };
}

describe('balance', () => {
  it('a reasonable plan survives the Cairn on more than 60% of seeds', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => 1000 + i * 7);
    const results = seeds.map((seed) => playCairn(seed));
    const wins = results.filter((r) => r.won).length;
    const rate = wins / seeds.length;
    // Logged so the balance notes can quote it.
    console.log(`Cairn survival: ${wins}/${seeds.length} (${Math.round(rate * 100)}%)`);
    expect(rate).toBeGreaterThan(0.6);
  }, 60000);
});
