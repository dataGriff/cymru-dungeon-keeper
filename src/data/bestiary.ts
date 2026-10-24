/**
 * Every creature's text and stats live here, in one typed object.
 * The manual panel, the sim and the printable manual (later) all read from it.
 */

export type BeastKind =
  | 'coblyn'
  | 'cwn'
  | 'pwca'
  | 'gwyllgi'
  | 'ceffyl'
  | 'afanc'
  | 'teg'
  | 'knight'
  | 'priest'
  | 'lord'
  | 'levy'
  | 'relic';

export type Appetite = 'none' | 'low' | 'high' | 'ruinous';
/** The hall's own, the mortals who come for the Heart, or the Fair Folk who come for terms. */
export type Allegiance = 'hall' | 'mortal' | 'fair';

export interface BeastEntry {
  kind: BeastKind;
  /** Display name, e.g. "Cŵn Annwn". */
  name: string;
  /** Italic one-line gloss under the name. */
  gloss: string;
  /** Flavour paragraph. */
  flavour: string;
  /** "Field notes" bullets. */
  notes: readonly string[];
  stats: {
    /** Vigour: hit points. */
    hp: number;
    /** Blow: damage per swing. */
    attack: number;
    /** Pace: tiles per second. */
    speed: number;
    /** Wage: shown in the manual; the POC does not charge it. */
    wage: number;
    appetite: Appetite;
    allegiance: Allegiance;
  };
}

/** Hunger-rate multiplier per appetite. */
export const APPETITE_RATE: Record<Appetite, number> = {
  none: 0,
  low: 0.5,
  high: 0.9,
  ruinous: 1.3,
};

export const BESTIARY: Record<BeastKind, BeastEntry> = {
  coblyn: {
    kind: 'coblyn',
    name: 'Coblyn',
    gloss: 'Coblynau, the knockers of the mine.',
    flavour:
      "Small, wiry, and perpetually indignant, the Coblyn is the oldest tenant of any Welsh dark. Miners once heard them tapping behind the seam and followed the sound to gold or to ruin, depending on the Coblyn's mood. They dig tirelessly for a steward who leaves them unbothered, and they are the only creatures here who will carry gold without pocketing it.",
    notes: [
      'Digs any rock you mark. Gold seams pay 25 a tile.',
      'Flees heroes rather than fight. Replaced from the portal only when fewer than three remain.',
      'Will not use a Lair. Sleeps standing, in the rock.',
    ],
    stats: { hp: 12, attack: 1, speed: 3.2, wage: 0, appetite: 'none', allegiance: 'hall' },
  },
  cwn: {
    kind: 'cwn',
    name: 'Cŵn Annwn',
    gloss: "The hounds of Arawn's hunt.",
    flavour:
      'White as milk with ears the colour of a fresh wound, the Cŵn Annwn run ahead of the Wild Hunt and are heard before they are seen. Their cry grows quieter as they close, so that the loudest baying means safety and silence means teeth. They are loyal in the way that weather is loyal: reliably, and to no one in particular.',
    notes: [
      'Arrives once you have a Lair of 4 tiles and a Hatchery of 2.',
      'Eats often. A starving hound will leave for the hunt and not return.',
      'Rushes the nearest mortal on sight. Keep your Lair between the Gate and the Heart.',
    ],
    stats: { hp: 34, attack: 4, speed: 2.6, wage: 8, appetite: 'high', allegiance: 'hall' },
  },
  pwca: {
    kind: 'pwca',
    name: 'Pwca',
    gloss: 'A changeling spirit of ill repute.',
    flavour:
      'The Pwca is whatever shape inconveniences you most. In the hall it keeps the form of a thin, long-fingered thing with two lamp-yellow eyes, which it closes when it wishes not to be seen, and then it is simply not seen. It fights by being somewhere else, then by being exactly where the blade was a moment ago.',
    notes: [
      'Arrives once you have a Lair of 2 and a Treasury of 2.',
      'Fast and fragile. Trades blows badly with knights, well with pilgrims.',
      'Skims a coin from the Treasury now and then. The manual recommends you do not count.',
    ],
    stats: { hp: 18, attack: 3, speed: 3.6, wage: 4, appetite: 'low', allegiance: 'hall' },
  },
  afanc: {
    kind: 'afanc',
    name: 'Afanc',
    gloss: 'The beast of the deep lake.',
    flavour:
      'Something between a beaver, a crocodile, and a bad decision, the Afanc was dragged from Llyn Barfog by oxen and chained in a mountain pool, where it has been composing its grievances ever since. It does not so much attack as arrive. Walls in its path become suggestions.',
    notes: [
      'Arrives once you have a Lair of 9 tiles, a Treasury of 4, and 300 gold on hand.',
      'Slow. Position it near the Heart and let the mortals come to it.',
      'Eats a Hatchery bare in a single sitting. Build two.',
    ],
    stats: { hp: 90, attack: 9, speed: 1.3, wage: 30, appetite: 'ruinous', allegiance: 'hall' },
  },
  gwyllgi: {
    kind: 'gwyllgi',
    name: 'Gwyllgi',
    gloss: 'The black dog of the crossroads.',
    flavour:
      'Where two roads meet there is a dog, and the dog is the size of a calf, and its eyes are the colour of a forge. The Gwyllgi does not hunt; it waits. Travellers who meet it describe a long silence and then nothing, because the ones who describe it are the ones it let pass. In the hall it chooses a corridor and becomes part of it. It is slower to anger than the hounds and a great deal harder to move once angered.',
    notes: [
      'Arrives once you have a Lair of 6 and a Treasury of 3.',
      'Holds the road: takes half damage standing in a corridor. Give it one.',
      'Slow to anger. It will not leave its post for a mortal more than four tiles off.',
    ],
    stats: { hp: 50, attack: 5, speed: 2.0, wage: 12, appetite: 'high', allegiance: 'hall' },
  },
  ceffyl: {
    kind: 'ceffyl',
    name: 'Ceffyl Dŵr',
    gloss: 'The water horse that is not a horse.',
    flavour:
      'It comes up out of the Pool grey and dripping and lets you believe it is a horse for as long as it takes you to climb on. Then it is in the air, then it is mist, and the rider is somewhere else entirely. In the hall it is lightning in a corridor: it hits once, hard, and is gone before the blade comes round. It will share a Pool with the Afanc with very bad grace.',
    notes: [
      'Arrives once you have a Pool of 3 and a Lair of 4.',
      'Charges, strikes, breaks off. Long corridors suit it; so does a second Pool.',
      'Dislikes the Afanc. Two Pools, or one of them sulks.',
    ],
    stats: { hp: 40, attack: 6, speed: 4.0, wage: 15, appetite: 'high', allegiance: 'hall' },
  },
  teg: {
    kind: 'teg',
    name: 'Tylwyth Teg emissary',
    gloss: 'An envoy of the Fair Folk, with terms.',
    flavour:
      'They come when the vault is full enough to be interesting, dressed in a courtesy so complete it is a kind of weapon. The emissary wants nothing, it says, and then names a price. Its gold is real, its healing is real, and its wards hold until exactly when it said they would. Do not strike it. Do not let the Pwca near it. It keeps a list, and the list is long, and the Fair Folk live a very long time.',
    notes: [
      'Arrives when the vault holds 150 gold, and stays about a minute.',
      'Trades gold for healing or a ward on the Gate. The card in the manual has the terms.',
      'Leaves offended if struck, or if anything is lifted from its sleeve. Keep the Pwca elsewhere.',
    ],
    stats: { hp: 20, attack: 0, speed: 2.4, wage: 0, appetite: 'none', allegiance: 'fair' },
  },
  knight: {
    kind: 'knight',
    name: 'Mortal Knight',
    gloss: 'A hero of men, armoured and sure.',
    flavour:
      'He has heard that Arawn is away and that the hall below the cairn holds treasure and a Heart that, if struck, will end the long winter of his people. Both rumours are true. He arrives in good steel with a red plume and a face that has never once doubted the plan, and he will walk through solid rock, slowly, if the steward is foolish enough to give him no other road.',
    notes: [
      'Enters at the Gate each wave. Walks to the Heart and strikes it.',
      'Tunnels through rock at a quarter speed. A long open corridor is a gift to him; a maze is not.',
      'Drops gold on death, which your Coblynau will gather.',
    ],
    stats: { hp: 40, attack: 5, speed: 1.9, wage: 0, appetite: 'none', allegiance: 'mortal' },
  },
  priest: {
    kind: 'priest',
    name: 'Hedge-Priest',
    gloss: 'A wandering holy man with a nail-studded staff.',
    flavour:
      'Barefoot, loud, and entirely certain, the hedge-priest comes to cleanse the hall and bless whatever is left. His staff was a fence-post until recently. He is not a strong fighter but he is a persistent one, and he keeps walking while others are still deciding whether to be afraid.',
    notes: [
      'Weak alone, dangerous in company. Waves after the second mix priests with knights.',
      'Heals a nearby knight a little each second. Kill the priest first.',
      'Frightened by the Afanc; will not approach it.',
    ],
    stats: { hp: 22, attack: 3, speed: 2.2, wage: 0, appetite: 'none', allegiance: 'mortal' },
  },
  lord: {
    kind: 'lord',
    name: 'Cantref Lord',
    gloss: 'A lord of a hundred farms, come to collect.',
    flavour:
      'He holds a cantref above and intends to hold one below. He is slow, heavy, and used to doors being opened for him, which the hall does not do, so he opens them with his shield. He does not waste himself on Coblynau. He walks straight at whatever in the hall looks most like a rival and settles the matter there, and if the hall\'s best creature is sleeping he will wait politely until it wakes.',
    notes: [
      'Goes for your strongest creature, not the nearest. Let the hounds soften him first.',
      'Heavily armoured and slow. Pits and snares were made for him.',
      "Drops a lord's purse: 60 gold. Worth the trouble.",
    ],
    stats: { hp: 70, attack: 7, speed: 1.6, wage: 0, appetite: 'none', allegiance: 'mortal' },
  },
  levy: {
    kind: 'levy',
    name: 'Cwrw-drunk Levy',
    gloss: 'A farmhand with a billhook and three pints in him.',
    flavour:
      'The lord brought twenty of them and nineteen are still deciding. They come down the stair singing, because they were told the hall was empty, and they stop singing at roughly the same moment. Alone, a levy is nothing. In a crowd he is nothing multiplied, until the first of them dies, at which point the arithmetic reverses and the whole crowd remembers it has a farm to get back to.',
    notes: [
      'Weak, cheap, and many. Waves bring them in handfuls.',
      'Panics when the first levy falls; the rest run for the Gate. Kill one loudly.',
      'Drops six gold and a billhook nobody wants.',
    ],
    stats: { hp: 16, attack: 2, speed: 2.4, wage: 0, appetite: 'none', allegiance: 'mortal' },
  },
  relic: {
    kind: 'relic',
    name: "Saint's Reliquary bearer",
    gloss: 'A finger-bone in a box, and the man who carries it.',
    flavour:
      "The box is silver and the bone is a saint's, or so the man was told, and it makes no difference to the hall whether it is true: near the relic, the hall's creatures cannot bring themselves to bite. The bearer has no weapon and does not need one. He walks to the Heart with his eyes shut, and everything that should stop him stands aside and watches.",
    notes: [
      'No attack, but no creature within two and a half tiles of him will fight.',
      "Kill the bearer first, from outside the circle: the Ceffyl Dŵr's charge, or a boulder.",
      'The relic drops with him. 20 gold and a lesson.',
    ],
    stats: { hp: 30, attack: 0, speed: 1.8, wage: 0, appetite: 'none', allegiance: 'mortal' },
  },
};

/** Manual page order: the six tabs, left to right. */
export const BESTIARY_ORDER: readonly BeastKind[] = [
  'coblyn',
  'cwn',
  'pwca',
  'gwyllgi',
  'ceffyl',
  'afanc',
  'teg',
  'knight',
  'priest',
  'lord',
  'levy',
  'relic',
];

/** Mortal kinds, for wave schedules. */
export type HeroKind = 'knight' | 'priest' | 'lord' | 'levy' | 'relic';

/** The running header starts at this page and increments per entry. */
export const MANUAL_FIRST_PAGE = 14;

export const MANUAL_FOOTNOTE =
  'From the manual. Keep this page open while you play; the hall does not forgive a steward who cannot tell a hound from a hound of men.';

/**
 * Who cannot stand whom. Two creatures that dislike each other squabble when
 * they share a Lair or Pool region: mood suffers, never HP. Symmetric.
 */
export const DISLIKES: readonly (readonly [BeastKind, BeastKind])[] = [
  ['cwn', 'pwca'],
  ['afanc', 'ceffyl'],
];

export const dislikes = (a: BeastKind, b: BeastKind): boolean =>
  DISLIKES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** The emissary's terms. */
export const TRADES = {
  heal: { cost: 40, label: 'A blessing on the hall', text: 'Every creature of the hall is made whole. 40 gold.' },
  ward: { cost: 60, label: 'A ward on the Gate', text: 'No mortal passes the Gate for thirty seconds. 60 gold.' },
} as const;
export type TradeKind = keyof typeof TRADES;
export const WARD_SECONDS = 30;

/** Gold a dead hero leaves on the floor. */
export const HERO_DROP: Record<HeroKind, number> = { knight: 30, priest: 12, lord: 60, levy: 6, relic: 20 };

/** How far the relic's hush reaches: no creature inside it will fight. */
export const RELIC_RADIUS = 2.5;

// ---------- Engines of the Hall ----------

export type EngineKind = 'pit' | 'boulder' | 'snare';

export interface EngineEntry {
  kind: EngineKind;
  name: string;
  gloss: string;
  flavour: string;
  notes: readonly string[];
  stats: {
    cost: number;
    /** Seconds of a Coblyn's time to build. */
    build: number;
    /** Damage dealt (pit, boulder) or per second held (snare). */
    damage: number;
    /** Seconds of slow (pit) or hold (snare); tiles of travel (boulder). */
    effect: number;
  };
}

export const ENGINES: Record<EngineKind, EngineEntry> = {
  pit: {
    kind: 'pit',
    name: 'Pit',
    gloss: 'A hole with opinions.',
    flavour:
      'Dug by the Coblynau in an evening and covered with a lattice of lath and loose earth. A mortal who steps on it goes down to the waist, loses his dignity and some blood, and climbs out slower than he went in. The hall fills it in afterwards; a pit only works once, which is one more time than most plans.',
    notes: [
      "20 gold and a Coblyn's time. One use.",
      'Hurts and slows. Put it where the knight has no choice but to step.',
      'Your own creatures know where it is. Mortals do not.',
    ],
    stats: { cost: 20, build: 3, damage: 8, effect: 3 },
  },
  boulder: {
    kind: 'boulder',
    name: 'Boulder',
    gloss: 'A round stone with somewhere to be.',
    flavour:
      'Rolled into place at the top of a straight corridor and held by a wedge the Coblynau know how to kick. When a mortal comes down the corridor the wedge goes and so does the stone. It does not stop for anyone. It also does not turn corners, which is worth remembering when laying corridors.',
    notes: [
      '35 gold. Needs a straight run of floor; it rolls up to eight tiles.',
      'Crushes everything mortal in its path. Your creatures step aside; the mortals do not.',
      'One use. The stone stays where it stops.',
    ],
    stats: { cost: 35, build: 4, damage: 20, effect: 8 },
  },
  snare: {
    kind: 'snare',
    name: 'Cold iron snare',
    gloss: 'Iron, and cold, and waiting.',
    flavour:
      "Fair Folk cannot abide cold iron and neither, it turns out, can a knight's ankle. The snare bites and holds for a count of four, and in the hall four seconds is a long time to stand still. Lay it on the Heart's threshold and the hounds will do the rest. Do not lay it where the emissary walks.",
    notes: [
      '25 gold. Holds a mortal fast for four seconds.',
      'Hurts the Fair Folk too. The emissary will not forgive it.',
      'One use. The Coblynau reset nothing.',
    ],
    stats: { cost: 25, build: 3, damage: 1, effect: 4 },
  },
};

export const ENGINE_ORDER: readonly EngineKind[] = ['pit', 'boulder', 'snare'];
export const MANUAL_ENGINES_FIRST_PAGE = 31;
