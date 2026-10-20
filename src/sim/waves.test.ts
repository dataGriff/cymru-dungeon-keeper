import { describe, expect, it } from 'vitest';
import { createGame, heroCount, spawn } from './game';
import { GATE_POS } from './grid';
import { tick } from './index';
import { FINAL_WAVE, FIRST_WAVE_AT, WAVE_INTERVAL, waveComposition, waveTime } from './waves';

const run = (s: ReturnType<typeof createGame>, seconds: number, dt = 0.1): void => {
  for (let t = 0; t < seconds - 1e-9; t += dt) tick(s, dt);
};

describe('waves', () => {
  it('first wave at 40s, then every 55s', () => {
    expect(waveTime(1)).toBe(40);
    expect(waveTime(2)).toBe(95);
    expect(waveTime(3)).toBe(150);
    const s = createGame(20);
    run(s, FIRST_WAVE_AT - 0.5);
    expect(s.wave).toBe(0);
    expect(heroCount(s)).toBe(0);
    run(s, 1);
    expect(s.wave).toBe(1);
    expect(s.nextWaveAt).toBe(FIRST_WAVE_AT + WAVE_INTERVAL);
    run(s, 3);
    expect(heroCount(s)).toBe(2);
    expect(s.log.some((l) => /Wave 1/.test(l.text))).toBe(true);
  });

  it('wave n brings 1+n heroes; from wave 2 every second one is a priest', () => {
    expect(waveComposition(1)).toEqual(['knight', 'knight']);
    expect(waveComposition(2)).toEqual(['knight', 'priest', 'knight']);
    expect(waveComposition(3)).toEqual(['knight', 'priest', 'knight', 'priest']);
  });

  it('heroes step through the Gate', () => {
    const s = createGame(21);
    run(s, FIRST_WAVE_AT + 0.2);
    const hero = s.entities.find((e) => e.kind === 'knight');
    expect(hero).toBeDefined();
    expect(hero!.x).toBeGreaterThan(GATE_POS.x - 1);
    expect(hero!.y).toBe(GATE_POS.y);
  });

  it('heroes reach the Heart through solid rock and strike it', () => {
    const s = createGame(22);
    s.entities = []; // no Coblynau to be distracted by
    spawn(s, 'knight', GATE_POS);
    run(s, 70, 0.05);
    expect(s.heartHp).toBeLessThan(100);
    expect(s.log.some((l) => /Steel on the Heart/.test(l.text))).toBe(true);
  });

  it('is won when wave 3 is cleared with no mortal left standing', () => {
    const s = createGame(23);
    s.wave = FINAL_WAVE;
    s.pendingHeroes = [];
    const k = spawn(s, 'knight', GATE_POS);
    tick(s, 0.1);
    expect(s.status).toBe('playing');
    k.hp = 0;
    s.entities = s.entities.filter((e) => e !== k);
    tick(s, 0.1);
    expect(s.status).toBe('won');
  });

  it('is not won while wave 3 heroes are still queued at the Gate', () => {
    const s = createGame(24);
    s.wave = FINAL_WAVE;
    s.pendingHeroes = ['knight'];
    s.spawnTimer = 5;
    tick(s, 0.1);
    expect(s.status).toBe('playing');
  });

  it('is lost when the Heart reaches zero', () => {
    const s = createGame(25);
    s.heartHp = 1;
    s.entities = [];
    const k = spawn(s, 'knight', { x: 4, y: 8 });
    k.cooldown = 0;
    tick(s, 0.1);
    expect(s.heartHp).toBe(0);
    expect(s.status).toBe('lost');
  });
});
