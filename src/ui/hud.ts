import { BESTIARY } from '../data/bestiary';
import { drawBeast } from '../render/sprites';
import { isCreature } from '../sim/entities';
import { type GameState, finalWave, heroCount, looseGold, nextWave, treasuryCapacity, vaultGold } from '../sim/game';
import { el } from './dom';

export interface Hud {
  root: HTMLElement;
  update(s: GameState, paused: boolean, speed: number): void;
}

export function createHud(): Hud {
  const gold = el('span', { className: 'hud-item' });
  const heart = el('span', { className: 'hud-item' });
  const wave = el('span', { className: 'hud-item' });
  const creatures = el('span', { className: 'hud-item' });
  const clock = el('span', { className: 'hud-item hud-clock' });
  const status = el('span', { className: 'hud-item hud-status' });
  const tally = el('span', { className: 'hud-item hud-tally' });
  const preview = el('span', { className: 'hud-preview' });
  preview.setAttribute('aria-label', 'Next wave');
  const root = el('div', { className: 'hud' }, [gold, heart, wave, creatures, tally, clock, status, preview]);
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Hall status');
  for (const [node, label] of [
    [gold, 'Gold'],
    [heart, 'Heart'],
    [wave, 'Wave'],
    [creatures, 'Creatures'],
    [status, 'Next wave or mortals'],
  ] as const) {
    node.setAttribute('aria-label', label);
  }
  // A quiet live region a screen reader hears every few seconds, not every frame.
  const live = el('div', { className: 'sr-only' });
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  root.append(live);
  let lastLive = -Infinity;
  let previewKey = '';
  const renderPreview = (s: GameState): void => {
    const heroes = s.wave < finalWave(s) ? nextWave(s) : [];
    const key = heroes.join(',');
    if (key === previewKey) return;
    previewKey = key;
    preview.replaceChildren();
    for (const kind of heroes) {
      const c = el('canvas', { className: 'hud-icon', title: BESTIARY[kind].name });
      c.width = 24;
      c.height = 28;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        drawBeast(ctx, kind, 12, 28, 2, { facing: -1 });
      }
      preview.append(c);
    }
    preview.title = heroes.length ? `Next wave: ${heroes.map((k) => BESTIARY[k].name).join(', ')}` : '';
  };
  return {
    root,
    update(s, paused, speed) {
      renderPreview(s);
      const loose = looseGold(s);
      const cap = treasuryCapacity(s.grid);
      const banked = vaultGold(s);
      gold.textContent = `Gold ${s.gold}` + (cap > 0 ? ` · Vault ${banked}/${cap}` : '') + (loose > 0 ? ` · Floor ${loose}` : '');
      heart.textContent = `Heart ${Math.ceil(s.heartHp)}/100`;
      heart.classList.toggle('hud-danger', s.heartHp < 35);
      wave.textContent = `Wave ${s.wave}/${finalWave(s)}`;
      creatures.textContent = `Creatures ${s.entities.filter(isCreature).length}`;
      tally.textContent = s.slain + s.fled > 0 ? `Slain ${s.slain} · Fled ${s.fled}` : '';
      clock.textContent = (paused ? 'Paused ' : speed === 1 ? '' : `${speed}× `) + (s.level.id.startsWith('sandbox') ? `· seed ${s.seed}` : `· ${s.level.name}`);
      const mortals = heroCount(s) + s.pendingHeroes.length;
      if (mortals > 0) {
        status.textContent = `Mortals in the hall: ${mortals}`;
        status.classList.add('hud-danger');
      } else if (s.level.win.kind === 'hunt' && s.wave >= finalWave(s)) {
        status.textContent = s.hunt ? 'The Hunt is here.' : `The Hunt returns in ${Math.max(0, Math.ceil(s.level.win.at - s.time))}s`;
        status.classList.remove('hud-danger');
      } else if (s.wave < finalWave(s)) {
        status.textContent = `Next wave ${Math.max(0, Math.ceil(s.nextWaveAt - s.time))}s`;
        status.classList.remove('hud-danger');
      } else {
        status.textContent = 'The stair is quiet.';
        status.classList.remove('hud-danger');
      }
      if (s.time - lastLive >= 8) {
        lastLive = s.time;
        live.textContent = `${gold.textContent}. ${heart.textContent}. ${wave.textContent}. ${status.textContent}.`;
      }
    },
  };
}
