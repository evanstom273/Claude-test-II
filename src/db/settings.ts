import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { db } from './db';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  screenShake: true,
  damageNumbers: true,
};

export const settingsStore = createStore<Settings>()(() => DEFAULT_SETTINGS);

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useStore(settingsStore, selector);
}

export async function loadSettings(): Promise<void> {
  try {
    const rec = await db.settings.get('settings');
    if (rec) settingsStore.setState({ ...DEFAULT_SETTINGS, ...(rec.value as Partial<Settings>) });
  } catch (err) {
    console.warn('Could not load settings', err);
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.setState(patch);
  db.settings.put({ key: 'settings', value: settingsStore.getState() }).catch((err) => {
    console.warn('Could not save settings', err);
  });
}
