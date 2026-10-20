/**
 * Waves are data: when, through which Gate, and who. A level carries one of
 * these; the sim reads nothing else to decide what comes down the stair.
 */
import type { HeroKind } from './bestiary';

export interface WaveSpec {
  /** Sim seconds at which the wave is announced. */
  at: number;
  /** Index into the level's Gates. */
  gate: number;
  heroes: HeroKind[];
}

export interface WaveSchedule {
  name: string;
  waves: WaveSpec[];
}

export const FIRST_WAVE_AT = 40;
export const WAVE_INTERVAL = 55;

/** The classic shape: wave n brings 1+n mortals; from wave 2 every second one is a Hedge-Priest. */
export function waveComposition(n: number): HeroKind[] {
  const out: HeroKind[] = [];
  for (let i = 0; i < 1 + n; i++) out.push(n >= 2 && i % 2 === 1 ? 'priest' : 'knight');
  return out;
}

export const waveTime = (n: number): number => FIRST_WAVE_AT + (n - 1) * WAVE_INTERVAL;

/**
 * The Cairn: three waves. The classic composition, plus a pair of levies on
 * the later waves so the steward meets a crowd before the campaign asks
 * harder questions. The lord and the reliquary bearer wait for the Siege.
 */
export const CAIRN: WaveSchedule = {
  name: 'The Cairn',
  waves: [
    { at: waveTime(1), gate: 0, heroes: waveComposition(1) },
    { at: waveTime(2), gate: 0, heroes: [...waveComposition(2), 'levy', 'levy'] },
    { at: waveTime(3), gate: 0, heroes: [...waveComposition(3), 'levy', 'levy'] },
  ],
};

/**
 * The Siege: for larger maps with two Gates. The Cantref Lord comes on the
 * last two waves, with his levies, through whichever Gate you forgot.
 */
export const SIEGE: WaveSchedule = {
  name: 'The Siege',
  waves: [
    { at: 40, gate: 0, heroes: ['knight', 'knight', 'levy', 'levy'] },
    { at: 95, gate: 1, heroes: ['knight', 'priest', 'knight', 'levy', 'levy', 'levy'] },
    { at: 150, gate: 0, heroes: ['lord', 'levy', 'levy', 'levy', 'priest'] },
    { at: 205, gate: 1, heroes: ['lord', 'knight', 'priest', 'relic', 'levy', 'levy'] },
  ],
};

/** Every hero kind and the role it plays, for the manual and the wave designer. */
export const HERO_ROLES: Record<HeroKind, string> = {
  knight: 'The line: walks to the Heart and strikes it.',
  priest: 'The medic: heals knights, fears the Afanc.',
  lord: 'The duelist: hunts your strongest creature.',
  levy: 'The crowd: many and weak; breaks when the first dies.',
  relic: 'The hush: nothing near him will fight. Kill him first.',
};
