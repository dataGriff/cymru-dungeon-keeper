/**
 * Three detuned sawtooth drones through a slowly wobbling lowpass, plus
 * random roof drips. Everything starts from a click, as browsers require.
 */
export interface CaveAudio {
  readonly on: boolean;
  toggle(): Promise<boolean>;
}

export function createCaveAudio(): CaveAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let dripTimer: number | null = null;
  let on = false;

  const build = (): void => {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 1.2;
    filter.connect(master);

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

  const drip = (): void => {
    if (!ctx || !master || !on) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const start = 1800 + Math.random() * 800;
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.16);
    scheduleDrip();
  };

  const scheduleDrip = (): void => {
    if (dripTimer !== null) window.clearTimeout(dripTimer);
    dripTimer = window.setTimeout(drip, 2500 + Math.random() * 6000);
  };

  return {
    get on() {
      return on;
    },
    async toggle() {
      if (!ctx) build();
      if (!ctx || !master) return false;
      on = !on;
      if (on) {
        await ctx.resume();
        master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
        scheduleDrip();
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        if (dripTimer !== null) window.clearTimeout(dripTimer);
        dripTimer = null;
      }
      return on;
    },
  };
}
