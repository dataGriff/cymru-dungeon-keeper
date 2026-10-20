/** F3: milliseconds per subsystem, rolling, so the budget in docs/performance.md can be checked live. */
import { el } from './dom';

export type Phase = 'sim' | 'tiles' | 'entities' | 'lighting' | 'ui';
export const PHASES: Phase[] = ['sim', 'tiles', 'entities', 'lighting', 'ui'];

export interface Profiler {
  root: HTMLElement;
  visible: boolean;
  toggle(): void;
  /** Record a phase's cost for this frame. */
  mark(phase: Phase, ms: number): void;
  /** Call once per frame with the frame's total. */
  frame(totalMs: number, entities: number): void;
}

export function createProfiler(): Profiler {
  const root = el('pre', { className: 'profiler hidden' });
  root.setAttribute('aria-label', 'Frame timings');
  const avg: Record<Phase, number> = { sim: 0, tiles: 0, entities: 0, lighting: 0, ui: 0 };
  const cur: Record<Phase, number> = { sim: 0, tiles: 0, entities: 0, lighting: 0, ui: 0 };
  let frameAvg = 16.7;
  let n = 0;
  const profiler: Profiler = {
    root,
    visible: false,
    toggle() {
      profiler.visible = !profiler.visible;
      root.classList.toggle('hidden', !profiler.visible);
    },
    mark(phase, ms) {
      cur[phase] += ms;
    },
    frame(totalMs, entities) {
      const k = 0.05;
      for (const p of PHASES) {
        avg[p] = avg[p] + (cur[p] - avg[p]) * k;
        cur[p] = 0;
      }
      frameAvg = frameAvg + (totalMs - frameAvg) * k;
      if (!profiler.visible || n++ % 6 !== 0) return;
      const fps = 1000 / Math.max(0.01, frameAvg);
      root.textContent =
        `F3  ${fps.toFixed(0)} fps  ${frameAvg.toFixed(1)} ms/frame  ${entities} entities\n` +
        PHASES.map((p) => `${p.padEnd(9)} ${avg[p].toFixed(2).padStart(6)} ms`).join('\n');
    },
  };
  return profiler;
}
