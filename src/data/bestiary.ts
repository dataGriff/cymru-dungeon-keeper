/**
 * Every creature's text and stats live here, in one typed object.
 * The manual panel, the sim and the printable manual (later) all read from it.
 */

export type BeastKind = 'coblyn' | 'cwn' | 'pwca' | 'afanc' | 'knight' | 'priest';

export type Appetite = 'none' | 'low' | 'high' | 'ruinous';
export type Allegiance = 'hall' | 'mortal';

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
    stats: { hp: 34, attack: 4, speed: 2.6, wage: 20, appetite: 'high', allegiance: 'hall' },
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
    stats: { hp: 18, attack: 3, speed: 3.6, wage: 10, appetite: 'low', allegiance: 'hall' },
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
    stats: { hp: 90, attack: 9, speed: 1.3, wage: 60, appetite: 'ruinous', allegiance: 'hall' },
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
};

/** Manual page order: the six tabs, left to right. */
export const BESTIARY_ORDER: readonly BeastKind[] = ['coblyn', 'cwn', 'pwca', 'afanc', 'knight', 'priest'];

/** The running header starts at this page and increments per entry. */
export const MANUAL_FIRST_PAGE = 14;

export const MANUAL_FOOTNOTE =
  'From the manual. Keep this page open while you play; the hall does not forgive a steward who cannot tell a hound from a hound of men.';

/** Gold a dead hero leaves on the floor. */
export const HERO_DROP: Record<'knight' | 'priest', number> = { knight: 30, priest: 12 };
