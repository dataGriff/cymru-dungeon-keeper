import { type GameState, heroCount } from '../sim/game';
import { isCreature } from '../sim/entities';
import { FINAL_WAVE } from '../sim/waves';
import { el } from './dom';

export interface Hud {
  root: HTMLElement;
  update(s: GameState): void;
}

export function createHud(): Hud {
  const gold = el('span', { className: 'hud-item' });
  const heart = el('span', { className: 'hud-item' });
  const wave = el('span', { className: 'hud-item' });
  const creatures = el('span', { className: 'hud-item' });
  const status = el('span', { className: 'hud-item hud-status' });
  const root = el('div', { className: 'hud' }, [gold, heart, wave, creatures, status]);
  return {
    root,
    update(s) {
      gold.textContent = `Gold ${s.gold}`;
      heart.textContent = `Heart ${Math.ceil(s.heartHp)}/100`;
      heart.classList.toggle('hud-danger', s.heartHp < 35);
      wave.textContent = `Wave ${s.wave}/${FINAL_WAVE}`;
      creatures.textContent = `Creatures ${s.entities.filter(isCreature).length}`;
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
