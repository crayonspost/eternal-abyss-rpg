import type { PlayerSave, Settings } from "./types";

const SLOT_KEY = (s: number) => `eternal_abyss_save_${s}`;
const SETTINGS_KEY = "eternal_abyss_settings";

export function loadSlot(slot: number): PlayerSave | null {
  try {
    const raw = localStorage.getItem(SLOT_KEY(slot));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSlot(save: PlayerSave) {
  save.updatedAt = Date.now();
  localStorage.setItem(SLOT_KEY(save.slot), JSON.stringify(save));
}

export function deleteSlot(slot: number) {
  localStorage.removeItem(SLOT_KEY(slot));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { bgm: true, sfx: true, quality: "mid" };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function exportSave(save: PlayerSave): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(save))));
}

export function importSave(str: string): PlayerSave | null {
  try {
    const json = decodeURIComponent(escape(atob(str.trim())));
    const obj = JSON.parse(json);
    if (obj && obj.classKey && obj.stats) return obj as PlayerSave;
  } catch {}
  return null;
}
