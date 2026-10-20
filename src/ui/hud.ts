import { type GameState, heroCount, looseGold, treasuryCapacity, vaultGold } from '../sim/game';
import { isCreature } from '../sim/entities';
import { FINAL_WAVE } from '../sim/waves';
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
  const root = el('div', { className: 'hud' }, [gold, heart, wave, creatures, clock, status]);
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'off');
  return {
    root,
    update(s, paused, speed) {
      const loose = looseGold(s);
      const cap = treasuryCapacity(s.grid);
      const banked = vaultGold(s);
      gold.textContent = `Gold ${s.gold}` + (cap > 0 ? ` · Vault ${banked}/${cap}` : '') + (loose > 0 ? ` · Floor ${loose}` : '');
      heart.textContent = `Heart ${Math.ceil(s.heartHp)}/100`;
      heart.classList.toggle('hud-danger', s.heartHp < 35);
      wave.textContent = `Wave ${s.wave}/${FINAL_WAVE}`;
      creatures.textContent = `Creatures ${s.entities.filter(isCreature).length}`;
      clock.textContent = paused ? 'Paused' : speed === 1 ? '' : `${speed}×`;
      const mortals = heroCount(s) + s.pendingHeroes.length;
      if (mortals > 0) {
        status.textContent = `Mortals in the hall: ${mortals}`;
        status.classList.add('hud-danger');
      } else if (s.wave < FINAL_WAVE) {
        status.textContent = `Next wave ${Math.max(0, Math.ceil(s.nextWaveAt - s.time))}s`;
        status.classList.remove('hud-danger');
      } else {
        status.textContent = 'The stair is quiet.';
        status.classList.remove('hud-danger');
      }
    },
  };
}
