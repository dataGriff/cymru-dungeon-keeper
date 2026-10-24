/** Save slots in localStorage, plus file export and import. */
import type { GameState } from '../sim/game';
import { type SaveData, fromJSON, toJSON } from '../sim/save';

export const SLOT_KEY = 'annwn.save.v1';
export const CAMPAIGN_KEY = 'annwn.campaign.v1';

export function saveToSlot(s: GameState): boolean {
  try {
    localStorage.setItem(SLOT_KEY, toJSON(s));
    return true;
  } catch {
    return false;
  }
}

export function loadFromSlot(): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY);
    return raw ? fromJSON(raw) : null;
  } catch {
    return null;
  }
}

export function slotInfo(): { level: string; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return { level: typeof data.level === 'string' ? data.level : data.level.name, savedAt: data.savedAt };
  } catch {
    return null;
  }
}

/** Campaign progress: the index of the furthest level reached. */
export function campaignProgress(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(CAMPAIGN_KEY) ?? '0') || 0);
  } catch {
    return 0;
  }
}

export function setCampaignProgress(index: number): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, String(Math.max(campaignProgress(), index)));
  } catch {
    /* ignore */
  }
}

/** Hand the player a file. */
export function download(name: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask the player for a file and read it as text. */
export function pickFile(accept = '.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      f.text().then(resolve, () => resolve(null));
    });
    input.click();
  });
}
