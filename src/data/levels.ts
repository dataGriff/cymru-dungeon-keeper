/**
 * Levels are data: a map drawn in ASCII, the starting purse, which denizens
 * may answer the portal, the wave schedule, and how the level is won.
 *
 * Map legend:  # rock   * gold seam   . floor   H Heart   P Portal   G Gate
 *              L Lair   F Hatchery    T Treasury   W Pool
 * A level may also set goldFraction to sprinkle seams into plain rock.
 */
import type { BeastKind } from './bestiary';
import { CAIRN, SIEGE, type WaveSchedule, waveComposition, waveTime } from './waves';

export type WinCondition =
  /** Clear every wave on the schedule. */
  | { kind: 'waves' }
  /** Hold the Heart until the Hunt returns at `at` seconds; then the hounds do the rest. */
  | { kind: 'hunt'; at: number };

export interface Level {
  id: string;
  name: string;
  /** One paragraph, in the manual's voice, shown before the level. */
  briefing: string;
  /** The new idea this level teaches, for the level select. */
  lesson: string;
  width: number;
  height: number;
  rows: string[];
  startGold: number;
  /** Fraction of plain rock that becomes gold seam (0 for hand-placed seams only). */
  goldFraction: number;
  /** Denizens the portal may send. Coblynau always come. */
  allowed: BeastKind[];
  schedule: WaveSchedule;
  win: WinCondition;
}

export const LEGEND = {
  '#': 'rock',
  '*': 'gold',
  '.': 'floor',
  H: 'heart',
  P: 'portal',
  G: 'gate',
  L: 'lair',
  F: 'hatchery',
  T: 'treasury',
  W: 'pool',
} as const;
export type LegendChar = keyof typeof LEGEND;

/** Build a rows array of solid rock with a 5x5 chamber, like the POC's start layout. */
function cairnRows(w: number, h: number): string[] {
  const rows = Array.from({ length: h }, () => '#'.repeat(w).split(''));
  const hx = 3;
  const hy = 8;
  for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx - 2; x <= hx + 2; x++) (rows[y] as string[])[x] = '.';
  (rows[hy] as string[])[hx] = 'H';
  (rows[hy - 2] as string[])[hx - 2] = 'P';
  (rows[8] as string[])[w - 1] = 'G';
  (rows[8] as string[])[w - 2] = '.';
  return rows.map((r) => r.join(''));
}

/** Errors in a level definition, empty if it is sound. Run at build time by the tests. */
export function validateLevel(level: Level): string[] {
  const errors: string[] = [];
  if (!level.id || !/^[a-z0-9-]+$/.test(level.id)) errors.push('id must be kebab-case');
  if (level.rows.length !== level.height) errors.push(`height ${level.height} but ${level.rows.length} rows`);
  let hearts = 0;
  let portals = 0;
  let gates = 0;
  level.rows.forEach((row, y) => {
    if (row.length !== level.width) errors.push(`row ${y} has ${row.length} chars, width is ${level.width}`);
    for (const ch of row) {
      if (!(ch in LEGEND)) errors.push(`row ${y}: unknown tile '${ch}'`);
      if (ch === 'H') hearts++;
      if (ch === 'P') portals++;
      if (ch === 'G') gates++;
    }
  });
  if (hearts !== 1) errors.push(`exactly one Heart required, found ${hearts}`);
  if (portals < 1) errors.push('a Portal is required');
  if (gates < 1) errors.push('at least one Gate is required');
  if (level.startGold < 0) errors.push('startGold must not be negative');
  if (level.goldFraction < 0 || level.goldFraction > 1) errors.push('goldFraction must be 0..1');
  if (level.schedule.waves.length === 0 && level.win.kind === 'waves') errors.push('a waves win needs at least one wave');
  level.schedule.waves.forEach((w, i) => {
    if (w.gate >= gates) errors.push(`wave ${i + 1} uses gate ${w.gate} but there are ${gates}`);
    if (i > 0 && w.at <= (level.schedule.waves[i - 1]?.at ?? 0)) errors.push(`wave ${i + 1} is not after wave ${i}`);
  });
  if (level.win.kind === 'hunt' && level.win.at <= 0) errors.push('hunt time must be positive');
  if (!level.briefing) errors.push('briefing is required');
  return errors;
}

export const ALL_DENIZENS: BeastKind[] = ['cwn', 'pwca', 'gwyllgi', 'ceffyl', 'afanc', 'teg'];

export const THE_CAIRN: Level = {
  id: 'cairn',
  name: 'The Cairn',
  briefing:
    'The hall under the cairn is small, dry, and dug by better stewards than you. Arawn has ridden out with the Hunt and left the keys on the Heart. Three waves of mortals have heard. Dig, build a Lair and a Hatchery for the hounds, keep the Heart, and read the manual.',
  lesson: 'Hounds first. Then gold. Then a dog for the corridor.',
  width: 24,
  height: 16,
  rows: cairnRows(24, 16),
  startGold: 150,
  goldFraction: 0.09,
  allowed: ['cwn', 'gwyllgi', 'teg'],
  schedule: CAIRN,
  win: { kind: 'waves' },
};

export const THE_SEAM: Level = {
  id: 'seam',
  name: 'The Seam',
  briefing:
    'This hall is poor. The rock here was worked out by the old Coblynau and what is left is thin, so every coin must be carried to a vault before it is yours, and the mortals know the way to a pile as well as you do. Build the Treasury early and keep it near the Heart. A Pwca will come for it, which is a compliment of a sort.',
  lesson: 'Gold is only gold in a vault, and a Pwca counts it too.',
  width: 24,
  height: 16,
  rows: [
    '########################',
    '########################',
    '###**###################',
    '###..###########*#######',
    '###..#######............',
    '#P....###########.#####G',
    '#.....####*######.#####.',
    '#..H...........##.......',
    '#.....####*#####.#######',
    '#.....####*#####.#######',
    '###.....########.#######',
    '####*###########.#######',
    '####*###########.#######',
    '################........',
    '########################',
    '########################',
  ],
  startGold: 90,
  goldFraction: 0,
  allowed: ['cwn', 'pwca', 'gwyllgi', 'teg'],
  schedule: {
    name: 'The Seam',
    waves: [
      { at: 50, gate: 0, heroes: ['knight', 'levy', 'levy'] },
      { at: 110, gate: 0, heroes: ['knight', 'priest', 'levy', 'levy', 'levy'] },
      { at: 170, gate: 0, heroes: ['knight', 'knight', 'priest', 'levy', 'levy'] },
    ],
  },
  win: { kind: 'waves' },
};

export const THE_POOL: Level = {
  id: 'pool',
  name: 'The Pool',
  briefing:
    'Water has found the hall: two black pools, cold enough to take the skin off a hand, and something has been composing its grievances at the bottom of the deeper one. Dig to the water and the Afanc will consider you; lay a third Pool tile and the Ceffyl Dŵr will consider the Afanc. The lord of the cantref above has sent his best man to see about the noise.',
  lesson: 'The water-beasts, and what they think of each other.',
  width: 32,
  height: 20,
  rows: [
    '################################',
    '################################',
    '####WW##########################',
    '####WW###############*##########',
    '#########*####################G#',
    '##P.....######################.#',
    '##......######*###############.#',
    '##..H.......###.....##########.#',
    '##......######.....###.....#...#',
    '##......####*......###.#######.#',
    '#######.##########.##..#..##...#',
    '#######.##########.##.....#....#',
    '#######......#####.##..##......#',
    '############.#####.#######.#####',
    '####WWW#####.............*.#####',
    '####WWW#######################G#',
    '####WW########################.#',
    '##############################.#',
    '################################',
    '################################',
  ],
  startGold: 180,
  goldFraction: 0.05,
  allowed: ALL_DENIZENS,
  schedule: {
    name: 'The Pool',
    waves: [
      { at: 45, gate: 0, heroes: ['knight', 'knight', 'levy', 'levy'] },
      { at: 105, gate: 1, heroes: ['knight', 'priest', 'knight', 'levy', 'levy', 'levy'] },
      { at: 165, gate: 0, heroes: ['lord', 'priest', 'knight', 'levy', 'levy'] },
      { at: 225, gate: 1, heroes: ['lord', 'knight', 'knight', 'priest', 'priest'] },
    ],
  },
  win: { kind: 'waves' },
};

export const THE_FAIR_COURT: Level = {
  id: 'fair-court',
  name: 'The Fair Court',
  briefing:
    'The Tylwyth Teg have taken an interest, which is never free. Their emissary will come whenever the vault is worth a visit, and it will sell you a ward on the Gate or a blessing on the hall at prices it considers fair. The mortals, meanwhile, have found a saint, or part of one. Nothing of yours will fight near the box he is carried in. Kill the bearer first, from outside the circle, and do not let the Pwca near the emissary.',
  lesson: 'Terms with the Fair Folk; the hush of a relic.',
  width: 32,
  height: 20,
  rows: [
    '################################',
    '################################',
    '#####################*##########',
    '######*#########################',
    '#P......#####*################G#',
    '#.......######################.#',
    '#..H....#######.........#.....##',
    '#.......#######.#######.#.######',
    '#.......#######.#######.#.######',
    '####.##########.#######...######',
    '####.###*######.################',
    '####............################',
    '################.###############',
    '################.###*###########',
    '################.##########*####',
    '################...............G',
    '#####WWW########################',
    '#####WWW###########*############',
    '################################',
    '################################',
  ],
  startGold: 200,
  goldFraction: 0.05,
  allowed: ALL_DENIZENS,
  schedule: {
    name: 'The Fair Court',
    waves: [
      { at: 45, gate: 0, heroes: ['knight', 'knight', 'levy', 'levy'] },
      { at: 100, gate: 1, heroes: ['knight', 'priest', 'relic', 'levy', 'levy'] },
      { at: 155, gate: 0, heroes: ['lord', 'priest', 'knight', 'relic'] },
      { at: 215, gate: 1, heroes: ['lord', 'knight', 'knight', 'priest', 'relic', 'levy', 'levy'] },
    ],
  },
  win: { kind: 'waves' },
};

export const THE_HUNT_RETURNS: Level = {
  id: 'hunt-returns',
  name: 'The Hunt Returns',
  briefing:
    'Word has come down the stair ahead of the mortals: Arawn is riding home, and the Hunt with him, and they will be at the Gate in a little under five minutes. Every lord with a grudge and a priest with a relic has heard the same and means to be at the Heart first. You do not have to win. You have to hold. When the horns sound, get out of the way of the hounds.',
  lesson: 'Hold until the horns.',
  width: 32,
  height: 20,
  rows: [
    '################################',
    '################################',
    '##########*#####################',
    '####*#########*###############G#',
    '#P........####################.#',
    '#.........#######*############.#',
    '#....H.........##..............#',
    '#.........#####.#.######.#######',
    '#.........#####.#.######.#######',
    '####.##########.#.####*#.#######',
    '####.######*###...####...#######',
    '####.##########.######.#########',
    '####.......###........#.########',
    '##########.###########.#....####',
    '#####WWW##.............#.#.#####',
    '#####WWW##############.#.#.#####',
    '######################...#.....G',
    '##############*#################',
    '################################',
    '################################',
  ],
  startGold: 220,
  goldFraction: 0.06,
  allowed: ALL_DENIZENS,
  schedule: {
    name: 'The Hunt Returns',
    waves: [
      { at: 40, gate: 0, heroes: ['knight', 'knight', 'levy', 'levy', 'levy'] },
      { at: 90, gate: 1, heroes: ['knight', 'priest', 'knight', 'relic', 'levy', 'levy'] },
      { at: 140, gate: 0, heroes: ['lord', 'priest', 'knight', 'knight', 'levy', 'levy', 'levy'] },
      { at: 190, gate: 1, heroes: ['lord', 'lord', 'priest', 'priest', 'relic', 'knight', 'knight'] },
      { at: 240, gate: 0, heroes: ['lord', 'lord', 'knight', 'knight', 'knight', 'priest', 'priest', 'relic', 'levy', 'levy', 'levy', 'levy'] },
    ],
  },
  win: { kind: 'hunt', at: 285 },
};

export const CAMPAIGN: readonly Level[] = [THE_CAIRN, THE_SEAM, THE_POOL, THE_FAIR_COURT, THE_HUNT_RETURNS];

export const levelById = (id: string): Level | undefined => CAMPAIGN.find((l) => l.id === id);

/** A siege on the Pool map, for free play. */
export const SIEGE_LEVEL: Level = { ...THE_POOL, id: 'siege', name: 'The Siege', schedule: SIEGE, briefing: 'Free play on the Pool. Two Gates, lords, and the bearer.', lesson: 'Everything at once.' };

/** The waves a sandbox keeps throwing: the classic shape, growing, forever. */
export function endlessSchedule(waves = 12): WaveSchedule {
  return {
    name: 'Endless',
    waves: Array.from({ length: waves }, (_, i) => {
      const n = i + 1;
      const heroes = [...waveComposition(Math.min(n, 4))];
      if (n >= 3) heroes.push('levy', 'levy');
      if (n >= 5) heroes.push('lord');
      if (n >= 6 && n % 2 === 0) heroes.push('relic');
      return { at: waveTime(n), gate: i % 2, heroes };
    }),
  };
}
