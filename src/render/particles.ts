/**
 * Render-side particles. The sim never sees these: they are fed from the
 * sim's events (a dig, a hit, a death, the Heart struck, an arrival) and
 * from the lights (embers off torches, motes in the Gate's daylight).
 * Square, pixel-sized, and capped, so they cost little and look of a piece
 * with the sprites.
 */
import type { SimEvent } from '../sim/game';
import type { Light } from './lighting';
import { PX, TILE } from './tiles';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** In logical pixels. */
  size: number;
  color: string;
  /** Drawn additively, so it glows. */
  glow: boolean;
  gravity: number;
  drag: number;
  /** Sideways wobble amplitude, for embers. */
  sway: number;
}

export const MAX_PARTICLES = 420;

export interface Emitters {
  heart: { x: number; y: number } | null;
  portal: { x: number; y: number } | null;
}

export class Particles {
  list: Particle[] = [];
  private emberClock = 0;

  private add(p: Partial<Particle> & { x: number; y: number; color: string }): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push({ vx: 0, vy: 0, life: 1, max: 1, size: 1, glow: false, gravity: 0, drag: 0.9, sway: 0, ...p });
  }

  private burst(x: number, y: number, n: number, opts: { speed: number; up?: number; colors: string[]; life: number; size?: number; glow?: boolean; gravity?: number; drag?: number }): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = opts.speed * (0.4 + Math.random() * 0.8);
      const life = opts.life * (0.6 + Math.random() * 0.6);
      this.add({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.up ?? 0),
        life,
        max: life,
        size: opts.size ?? 1,
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)] as string,
        glow: opts.glow ?? false,
        gravity: opts.gravity ?? 0,
        drag: opts.drag ?? 0.9,
      });
    }
  }

  /** Turn the sim's events into bursts. Tile coordinates in, screen pixels out. */
  react(events: readonly SimEvent[], at: Emitters): void {
    const c = (v: number): number => (v + 0.5) * TILE;
    for (const ev of events) {
      switch (ev.kind) {
        case 'dig':
          this.burst(c(ev.x), c(ev.y), 10, { speed: 70, up: 40, colors: ['#3c304a', '#2d2439', '#4b3d5c'], life: 0.7, gravity: 260, drag: 0.94 });
          this.burst(c(ev.x), c(ev.y), 8, { speed: 18, up: 10, colors: ['rgba(120,105,130,0.5)', 'rgba(90,80,100,0.5)'], life: 1.2, size: 2, drag: 0.92 });
          if (ev.gold) this.burst(c(ev.x), c(ev.y), 12, { speed: 45, up: 30, colors: ['#ffe08a', '#e3b341', '#fff6d0'], life: 0.9, glow: true, gravity: 60 });
          break;
        case 'hit':
          this.burst(c(ev.x), c(ev.y) - 6, 6, { speed: 90, colors: ['#ff5a4a', '#ffb070', '#d8232a'], life: 0.3, glow: true, drag: 0.85 });
          break;
        case 'death':
          this.burst(c(ev.x), c(ev.y), 12, { speed: 20, up: 12, colors: ['rgba(60,50,70,0.7)', 'rgba(40,32,48,0.7)'], life: 1.4, size: 2, drag: 0.93 });
          for (let i = 0; i < 6; i++) {
            const life = 1.6 + Math.random();
            this.add({ x: c(ev.x) + (Math.random() - 0.5) * 8, y: c(ev.y) - 8, vx: (Math.random() - 0.5) * 6, vy: -20 - Math.random() * 14, life, max: life, color: ev.hero ? '#d8e4ff' : '#ffd0a0', glow: true, drag: 0.98, sway: 6 });
          }
          break;
        case 'heart':
          if (at.heart) this.burst(c(at.heart.x), c(at.heart.y), 10, { speed: 80, up: 20, colors: ['#ff3a44', '#ffd0d0', '#b4202c'], life: 0.6, glow: true, gravity: 140 });
          break;
        case 'arrive':
          if (at.portal) this.burst(c(at.portal.x), c(at.portal.y), 16, { speed: 40, colors: ['#e8d0ff', '#a070ff', '#5a30a0'], life: 0.9, glow: true, drag: 0.9 });
          break;
        default:
          break;
      }
    }
  }

  /** Embers lift off warm lights; motes hang in cold ones. */
  ambient(lights: readonly Light[], dt: number): void {
    this.emberClock += dt;
    const step = 1 / 30;
    while (this.emberClock >= step) {
      this.emberClock -= step;
      for (const l of lights) {
        if (l.temper === 'warm' && Math.random() < 0.05) {
          const life = 1.5 + Math.random() * 1.5;
          this.add({ x: l.x + (Math.random() - 0.5) * 18, y: l.y + (Math.random() - 0.5) * 10, vx: 0, vy: -10 - Math.random() * 12, life, max: life, color: Math.random() < 0.3 ? '#ffd07a' : '#ff8a2a', glow: true, drag: 0.99, sway: 5 });
        } else if (l.temper === 'cold' && Math.random() < 0.06) {
          const life = 2.5 + Math.random() * 2;
          this.add({ x: l.x - 6 - Math.random() * 30, y: l.y + (Math.random() - 0.5) * 20, vx: -4 - Math.random() * 4, vy: (Math.random() - 0.5) * 3, life, max: life, color: 'rgba(200, 215, 240, 0.6)', glow: true, drag: 0.995, sway: 2 });
        }
      }
    }
  }

  update(dt: number, t: number): void {
    const out: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * dt;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k;
      p.vy *= k;
      p.x += (p.vx + (p.sway ? Math.sin(t * 3 + p.y * 0.1) * p.sway : 0)) * dt;
      p.y += p.vy * dt;
      out.push(p);
    }
    this.list = out;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const glow of [false, true]) {
      ctx.globalCompositeOperation = glow ? 'lighter' : 'source-over';
      for (const p of this.list) {
        if (p.glow !== glow) continue;
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.4);
        ctx.fillStyle = p.color;
        const s = p.size * PX;
        // Snap to the pixel grid so particles sit with the sprites.
        ctx.fillRect(Math.round(p.x / PX) * PX - s / 2, Math.round(p.y / PX) * PX - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
