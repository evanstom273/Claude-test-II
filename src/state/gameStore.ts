import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { ITEMS, isEquipment, item, type EquipSlot } from '../data/items';
import { QUESTS } from '../data/quests';
import { bus } from './bus';
import { derivedStats, MAX_LEVEL, xpToNext, type DerivedStats } from './progression';
import type { AbilityId, FlagValue, GameData, QuestId, ZoneId } from './types';
import { ui } from './uiStore';

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

/** Copy the data deeply enough that every nested record is fresh. */
function cloneData(d: GameData): GameData {
  return {
    ...d,
    inventory: { ...d.inventory },
    equipment: { ...d.equipment },
    abilities: { ...d.abilities },
    quests: Object.fromEntries(Object.entries(d.quests).map(([k, v]) => [k, { ...v! }])),
    flags: { ...d.flags },
    pos: d.pos ? { ...d.pos } : null,
    entry: { ...d.entry },
    explored: { ...d.explored },
    killsByType: { ...d.killsByType },
    stats: { ...d.stats },
  };
}

const ABILITY_NAMES: Record<AbilityId, string> = {
  bolt: 'Ember Bolt',
  dash: 'Ember Dash',
  radiance: 'Radiance',
};

export const game = {
  get data(): GameData {
    const d = gameStore.getState().data;
    if (!d) throw new Error('No game loaded');
    return d;
  },

  get loaded(): boolean {
    return gameStore.getState().data !== null;
  },

  get slot(): number | null {
    return gameStore.getState().slot;
  },

  start(slot: number, data: GameData) {
    gameStore.setState({ slot, data: cloneData(data) });
  },

  clear() {
    gameStore.setState({ slot: null, data: null });
  },

  update(recipe: (d: GameData) => void) {
    const cur = gameStore.getState().data;
    if (!cur) return;
    const next = cloneData(cur);
    recipe(next);
    gameStore.setState({ data: next });
  },

  stats(): DerivedStats {
    return derivedStats(game.data);
  },

  // ---- Inventory ----------------------------------------------------------

  count(id: string): number {
    return game.data.inventory[id] ?? 0;
  },

  has(id: string, n = 1): boolean {
    return game.count(id) >= n;
  },

  giveItem(id: string, n = 1, silent = false) {
    const def = item(id);
    game.update((d) => {
      d.inventory[id] = (d.inventory[id] ?? 0) + n;
    });
    if (!silent) ui.toast(n > 1 ? `${def.name} ×${n}` : def.name, 'item', def.icon);
  },

  takeItem(id: string, n = 1): boolean {
    if (!game.has(id, n)) return false;
    game.update((d) => {
      const left = (d.inventory[id] ?? 0) - n;
      if (left > 0) d.inventory[id] = left;
      else delete d.inventory[id];
      // Unequip anything we no longer own.
      for (const slot of Object.keys(d.equipment) as EquipSlot[]) {
        if (d.equipment[slot] === id && !d.inventory[id]) d.equipment[slot] = null;
      }
    });
    game.clampVitals();
    return true;
  },

  addGold(n: number) {
    game.update((d) => {
      d.gold = Math.max(0, d.gold + n);
    });
  },

  spendGold(n: number): boolean {
    if (game.data.gold < n) return false;
    game.addGold(-n);
    return true;
  },

  equip(id: string) {
    const def = item(id);
    if (!isEquipment(def) || !game.has(id)) return;
    game.update((d) => {
      d.equipment[def.kind] = id;
    });
    game.clampVitals();
    bus.emit('equipmentChanged', {});
  },

  unequip(slot: EquipSlot) {
    game.update((d) => {
      d.equipment[slot] = null;
    });
    game.clampVitals();
    bus.emit('equipmentChanged', {});
  },

  /** Use a consumable. Returns false if it would do nothing or we have none. */
  useItem(id: string): boolean {
    const def = ITEMS[id];
    if (!def || def.kind !== 'consumable' || !game.has(id)) return false;
    const s = game.stats();
    const d = game.data;
    const wantsHp = !!def.heal && d.hp < s.maxHp;
    const wantsMp = !!def.mana && d.mp < s.maxMp;
    if (!wantsHp && !wantsMp) return false;
    game.takeItem(id);
    const before = d.hp;
    game.update((g) => {
      if (def.heal) g.hp = Math.min(s.maxHp, g.hp + def.heal);
      if (def.mana) g.mp = Math.min(s.maxMp, g.mp + def.mana);
      g.stats.potionsUsed++;
    });
    bus.emit('playerHealed', { amount: game.data.hp - before });
    return true;
  },

  // ---- Vitals -------------------------------------------------------------

  clampVitals() {
    const s = game.stats();
    const d = game.data;
    if (d.hp > s.maxHp || d.mp > s.maxMp) {
      game.update((g) => {
        g.hp = Math.min(g.hp, s.maxHp);
        g.mp = Math.min(g.mp, s.maxMp);
      });
    }
  },

  damage(n: number): number {
    game.update((d) => {
      d.hp = Math.max(0, d.hp - n);
    });
    return game.data.hp;
  },

  heal(n: number) {
    const max = game.stats().maxHp;
    game.update((d) => {
      d.hp = Math.min(max, d.hp + n);
    });
  },

  restoreMp(n: number) {
    const max = game.stats().maxMp;
    if (game.data.mp >= max) return;
    game.update((d) => {
      d.mp = Math.min(max, d.mp + n);
    });
  },

  spendMp(n: number): boolean {
    if (game.data.mp < n) return false;
    game.update((d) => {
      d.mp -= n;
    });
    return true;
  },

  fullRestore() {
    const s = game.stats();
    game.update((d) => {
      d.hp = s.maxHp;
      d.mp = s.maxMp;
    });
  },

  gainXp(n: number) {
    if (game.data.level >= MAX_LEVEL) return;
    let levelled = 0;
    game.update((d) => {
      d.xp += n;
      while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
        d.xp -= xpToNext(d.level);
        d.level++;
        levelled++;
      }
      if (d.level >= MAX_LEVEL) d.xp = 0;
    });
    if (levelled > 0) {
      game.fullRestore();
      const lvl = game.data.level;
      ui.toast(`Level ${lvl}! You feel stronger.`, 'level');
      bus.emit('levelUp', { level: lvl });
    }
  },

  // ---- Flags, quests, abilities ------------------------------------------

  flag(key: string): FlagValue | undefined {
    return game.data.flags[key];
  },

  setFlag(key: string, value: FlagValue = true) {
    game.update((d) => {
      d.flags[key] = value;
    });
  },

  quest(id: QuestId) {
    return game.data.quests[id];
  },

  questActive(id: QuestId): boolean {
    return game.data.quests[id]?.status === 'active';
  },

  questDone(id: QuestId): boolean {
    return game.data.quests[id]?.status === 'complete';
  },

  startQuest(id: QuestId, stage = 0) {
    if (game.data.quests[id]) return;
    game.update((d) => {
      d.quests[id] = { status: 'active', stage };
    });
    ui.toast(`New quest: ${QUESTS[id].title}`, 'quest');
  },

  setStage(id: QuestId, stage: number, announce = true) {
    game.update((d) => {
      const q = d.quests[id];
      if (q) q.stage = stage;
      else d.quests[id] = { status: 'active', stage };
    });
    if (announce) ui.toast(`Quest updated: ${QUESTS[id].title}`, 'quest');
  },

  completeQuest(id: QuestId) {
    if (game.questDone(id)) return;
    game.update((d) => {
      d.quests[id] = { status: 'complete', stage: d.quests[id]?.stage ?? 0 };
    });
    ui.toast(`Quest complete: ${QUESTS[id].title}`, 'quest');
  },

  grantAbility(id: AbilityId) {
    if (game.data.abilities[id]) return;
    game.update((d) => {
      d.abilities[id] = true;
    });
    ui.toast(`New power: ${ABILITY_NAMES[id]}`, 'level');
    bus.emit('ability', { id });
  },

  recordKill(kind: string) {
    game.update((d) => {
      d.killsByType[kind] = (d.killsByType[kind] ?? 0) + 1;
      d.stats.kills++;
    });
  },

  setZone(zone: ZoneId, spawn: string) {
    game.update((d) => {
      d.zone = zone;
      d.entry = { zone, spawn };
      d.pos = null;
    });
  },

  addPlaytime(ms: number) {
    game.update((d) => {
      d.stats.playtimeMs += ms;
    });
  },
};

export { ABILITY_NAMES };
