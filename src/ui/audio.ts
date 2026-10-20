/**
 * The hall's sound. Ambient: three detuned sawtooth drones through a slowly
 * wobbling lowpass, plus random roof drips. Reactive: hound baying that gets
 * quieter as they close on a mortal (the manual says so, so it is true),
 * pick-on-stone when a dig lands, a bell when the Heart is struck, and
 * mortal footsteps that are louder in open halls than in corridors. All of
 * it is synthesised; nothing plays before the first click.
 */
import type { SimEvent } from '../sim/game';

export interface Mixer {
  master: number;
  ambient: number;
  sfx: number;
}

export interface CaveAudio {
  readonly on: boolean;
  readonly mixer: Mixer;
  toggle(): Promise<boolean>;
  setMixer(m: Partial<Mixer>): void;
  /** Feed the sim's events each frame; `heroDist` is the nearest mortal to each baying hound. */
  react(events: readonly SimEvent[], heroDist: (id: number, x: number, y: number) => number): void;
}

export function createCaveAudio(): CaveAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let ambientGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let dripTimer: number | null = null;
  let on = false;
  const mixer: Mixer = { master: 0.6, ambient: 0.8, sfx: 0.8 };
  let lastStep = 0;

  const build = (): void => {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    ambientGain = ctx.createGain();
    ambientGain.gain.value = mixer.ambient;
    ambientGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = mixer.sfx;
    sfxGain.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.2;
    filter.connect(ambientGain);

    const wobble = ctx.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.value = 0.07;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 45;
    wobble.connect(wobbleGain).connect(filter.frequency);
    wobble.start();

    for (const [hz, detune] of [
      [55, -6],
      [82.4, 4],
      [110, -3],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      osc.connect(g).connect(filter);
      osc.start();
    }
  };

  /** A short enveloped tone. */
  const tone = (
    type: OscillatorType,
    from: number,
    to: number,
    seconds: number,
    peak: number,
    dest: AudioNode | null = sfxGain,
  ): void => {
    if (!ctx || !dest || !on) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + seconds * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  };

  /** A burst of filtered noise: picks on stone, footsteps. */
  const noise = (seconds: number, peak: number, hz: number): void => {
    if (!ctx || !sfxGain || !on) return;
    const t = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = peak;
    src.connect(bp).connect(g).connect(sfxGain);
    src.start(t);
  };

  const drip = (): void => {
    if (!ctx || !ambientGain || !on) return;
    tone('sine', 1800 + Math.random() * 800, 400, 0.14, 0.18, ambientGain);
    scheduleDrip();
  };

  const scheduleDrip = (): void => {
    if (dripTimer !== null) window.clearTimeout(dripTimer);
    dripTimer = window.setTimeout(drip, 2500 + Math.random() * 6000);
  };

  /** The hound's cry: a falling howl whose loudness grows with distance from its quarry. */
  const bay = (dist: number): void => {
    const loud = Math.min(1, Math.max(0.08, (dist - 1) / 7));
    tone('triangle', 520, 240, 0.9, 0.22 * loud);
    tone('triangle', 780, 300, 0.7, 0.1 * loud);
  };

  const bell = (): void => {
    tone('sine', 660, 650, 1.6, 0.35);
    tone('sine', 1320, 1300, 0.9, 0.12);
    tone('square', 220, 215, 0.25, 0.08);
  };

  return {
    get on() {
      return on;
    },
    mixer,
    async toggle() {
      if (!ctx) build();
      if (!ctx || !master) return false;
      on = !on;
      if (on) {
        await ctx.resume();
        master.gain.setTargetAtTime(mixer.master, ctx.currentTime, 0.4);
        scheduleDrip();
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        if (dripTimer !== null) window.clearTimeout(dripTimer);
        dripTimer = null;
      }
      return on;
    },
    setMixer(m) {
      Object.assign(mixer, m);
      if (!ctx) return;
      if (master && on) master.gain.setTargetAtTime(mixer.master, ctx.currentTime, 0.05);
      if (ambientGain) ambientGain.gain.setTargetAtTime(mixer.ambient, ctx.currentTime, 0.05);
      if (sfxGain) sfxGain.gain.setTargetAtTime(mixer.sfx, ctx.currentTime, 0.05);
    },
    react(events, heroDist) {
      if (!on || !ctx) return;
      for (const ev of events) {
        switch (ev.kind) {
          case 'dig':
            noise(0.08, ev.gold ? 0.5 : 0.35, ev.gold ? 2400 : 1400);
            if (ev.gold) tone('sine', 2200, 2100, 0.25, 0.08);
            break;
          case 'heart':
            bell();
            break;
          case 'bay':
            bay(heroDist(ev.id, ev.x, ev.y));
            break;
          case 'hit':
            noise(0.05, 0.2, 900);
            break;
          case 'death':
            tone('sawtooth', ev.hero ? 180 : 320, 60, 0.5, 0.12);
            break;
          case 'wave':
            tone('square', 110, 100, 1.2, 0.1);
            tone('square', 165, 150, 1.2, 0.07);
            break;
          case 'arrive':
            tone('sine', 300, 600, 0.3, 0.06);
            break;
          case 'step': {
            // Louder in the open, and never more than ten a second across all mortals.
            const now = ctx.currentTime;
            if (now - lastStep < 0.1) break;
            lastStep = now;
            noise(0.04, 0.05 + 0.04 * ev.open, 300);
            break;
          }
        }
      }
    },
  };
}
