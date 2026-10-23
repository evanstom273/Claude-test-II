import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { GangId } from '../data/cast';
import type { GameData, ItemId, WeaponId } from './types';

/** The persistent game: what gets saved. Runtime-only state lives in uiStore. */
export interface GameStoreState {
  slot: number | null;
  data: GameData | null;
}

export const gameStore = createStore<GameStoreState>()(() => ({ slot: null, data: null }));

export function useGame<T>(selector: (d: GameData) => T): T {
  return useStore(gameStore, (s) => (s.data ? selector(s.data) : (undefined as T)));
}

export function useGameData(): GameData | null {
  return useStore(gameStore, (s) => s.data);
}

function clone(d: GameData): GameData {
  return structuredClone(d);
}

export const WEAPON_ORDER: WeaponId[] = ['fists', 'bat', 'pistol', 'smg', 'shotgun'];

export const game = {
  get data(): GameData {
    const d = gameStore.getState().data;
    if (!d) throw new Error('No game loaded');
    return d;
  },
  get loaded() {
    return gameStore.getState().data !== null;
  },
  get slot() {
    return gameStore.getState().slot;
  },
  start(slot: number, data: GameData) {
    gameStore.setState({ slot, data: clone(data) });
  },
  clear() {
    gameStore.setState({ slot: null, data: null });
  },
  update(recipe: (d: GameData) => void) {
    const cur = gameStore.getState().data;
    if (!cur) return;
    const next = clone(cur);
    recipe(next);
    gameStore.setState({ data: next });
  },

  addCash(n: number) {
    game.update((d) => {
      d.cash = Math.max(0, d.cash + n);
      if (n > 0) d.stats.cashEarned += n;
    });
  },
  spend(n: number): boolean {
    if (game.data.cash < n) return false;
    game.update((d) => (d.cash -= n));
    return true;
  },
  damage(n: number): number {
    game.update((d) => (d.health = Math.max(0, d.health - n)));
    return game.data.health;
  },
  heal(n: number) {
    game.update((d) => (d.health = Math.min(d.maxHealth, d.health + n)));
  },
  hasWeapon(w: WeaponId) {
    return w === 'fists' || (game.data.weapons[w] ?? 0) > 0;
  },
  giveWeapon(w: WeaponId, ammo: number) {
    game.update((d) => {
      d.weapons[w] = (d.weapons[w] ?? 0) + ammo;
      if (WEAPON_ORDER.indexOf(w) > WEAPON_ORDER.indexOf(d.current)) d.current = w;
    });
  },
  /** Use one round; returns false if empty. Melee never runs out. */
  useAmmo(): boolean {
    const w = game.data.current;
    if (w === 'fists' || w === 'bat') return true;
    const left = game.data.weapons[w] ?? 0;
    if (left <= 0) return false;
    game.update((d) => {
      d.weapons[w] = left - 1;
      if (left - 1 <= 0) d.current = nextWeapon(d, 1);
    });
    return true;
  },
  cycleWeapon(dir = 1) {
    game.update((d) => (d.current = nextWeapon(d, dir)));
  },
  addItem(id: ItemId, n = 1) {
    game.update((d) => (d.items[id] = (d.items[id] ?? 0) + n));
  },
  respect(g: GangId, delta: number) {
    game.update((d) => (d.respect[g] = Math.max(-100, Math.min(100, d.respect[g] + delta))));
  },
};

function nextWeapon(d: GameData, dir: number): WeaponId {
  const owned = WEAPON_ORDER.filter((w) => w === 'fists' || (d.weapons[w] ?? 0) > 0);
  const i = owned.indexOf(d.current);
  return owned[(i + dir + owned.length) % owned.length] ?? 'fists';
}
