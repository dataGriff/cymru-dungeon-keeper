/**
 * Player settings that persist: motion, flicker, text size, integer scaling,
 * the theme.
 * Applied as data attributes and CSS variables on <html>, so the stylesheet
 * and the renderer both read them.
 */
export interface Settings {
  /** Disable animations (page turns, blinking). Also follows prefers-reduced-motion. */
  reducedMotion: boolean;
  /** Steady torches. */
  noFlicker: boolean;
  /** Root text size as a percentage. */
  textScale: 100 | 125 | 150;
  /** Board scale: 0 fits the column; 1..4 are exact integer multiples. */
  scale: 0 | 1 | 2 | 3 | 4;
  /** Colour-blind safe health bars (blue for the hall, orange for mortals, patterned). */
  safeColours: boolean;
  /** The look: the default hall or high contrast (see src/design/themes.ts). */
  theme: 'hall' | 'contrast';
}

const KEY = 'annwn.settings.v1';

export const DEFAULTS: Settings = {
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  noFlicker: false,
  textScale: 100,
  scale: 0,
  safeColours: false,
  theme: 'hall',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Push the settings into the document. */
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset['reducedMotion'] = String(s.reducedMotion);
  root.dataset['safeColours'] = String(s.safeColours);
  root.style.fontSize = `${s.textScale}%`;
  root.style.setProperty('--board-scale', String(s.scale));
}
