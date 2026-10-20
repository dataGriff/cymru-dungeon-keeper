import { BESTIARY } from '../data/bestiary';
import { Tile, type Vec, isMarked, isRoom, regionSizeAt, tileAt } from '../sim/grid';
import type { GameState } from '../sim/game';
import type { Entity } from '../sim/entities';
import { el } from './dom';

const TILE_NAME: Record<Tile, string> = {
  [Tile.Rock]: 'Rock',
  [Tile.Gold]: 'Gold seam',
  [Tile.Floor]: 'Floor',
  [Tile.Lair]: 'Lair',
  [Tile.Hatchery]: 'Hatchery',
  [Tile.Treasury]: 'Treasury',
  [Tile.Portal]: 'Portal',
  [Tile.Heart]: 'The Heart',
  [Tile.Gate]: 'The Gate',
};

export interface Tooltip {
  root: HTMLElement;
  /** Describe what is under the pointer at board-relative CSS pixels (cx, cy). */
  show(s: GameState, tile: Vec, entity: Entity | null, cx: number, cy: number): void;
  hide(): void;
}

export function createTooltip(): Tooltip {
  const root = el('div', { className: 'tooltip hidden' });
  root.setAttribute('role', 'tooltip');
  let last = '';
  return {
    root,
    show(s, tile, entity, cx, cy) {
      const t = tileAt(s.grid, tile.x, tile.y);
      let text: string;
      if (entity) {
        const st = BESTIARY[entity.kind];
        text = `${st.name} · ${Math.ceil(entity.hp)}/${entity.maxHp}` + (entity.carrying > 0 ? ` · carrying ${entity.carrying}g` : '');
      } else {
        text = TILE_NAME[t];
        if (isRoom(t)) text += ` · region of ${regionSizeAt(s.grid, tile.x, tile.y, t)}`;
        if (isMarked(s.grid, tile.x, tile.y)) text += ' · marked';
        const drop = s.drops.find((d) => d.x === tile.x && d.y === tile.y);
        if (drop) text += ` · ${drop.gold} gold on the floor`;
      }
      if (text !== last) {
        root.textContent = text;
        last = text;
      }
      root.style.left = `${cx + 14}px`;
      root.style.top = `${cy + 18}px`;
      root.classList.remove('hidden');
    },
    hide() {
      root.classList.add('hidden');
    },
  };
}
