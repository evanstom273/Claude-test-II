import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { db } from './db';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  damageNumbers: boolean;
  touchControls: boolean;
}

/** Phones, tablets and foldables: anything whose main pointer is a finger. */
export const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  screenShake: true,
  damageNumbers: true,
  touchControls: IS_TOUCH_DEVICE,
};

export const settingsStore = createStore<Settings>()(() => DEFAULT_SETTINGS);

export function useSettings<T>(selector: (s: Settings) => T): T {
  return useStore(settingsStore, selector);
}

export function useTouch(): boolean {
  return useStore(settingsStore, (s) => s.touchControls);
}

// Lets CSS hide keyboard hints in touch mode (see the `touch:` variant).
if (typeof document !== 'undefined') {
  const apply = () => document.documentElement.classList.toggle('touch', settingsStore.getState().touchControls);
  apply();
  settingsStore.subscribe(apply);
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
