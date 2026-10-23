import type { GameData } from './types';
import { baseStats } from './progression';

export function createNewGame(playerName: string): GameData {
  const base = baseStats(1);
  return {
    version: 1,
    playerName: playerName.trim() || 'Wren',
    level: 1,
    xp: 0,
    hp: base.maxHp,
    mp: base.maxMp,
    gold: 30,
    inventory: { rusty_sword: 1, padded_tunic: 1, draught: 3 },
    equipment: { weapon: 'rusty_sword', armor: 'padded_tunic', charm: null },
    abilities: { bolt: false, dash: false, radiance: false },
    quests: {},
    flags: {},
    zone: 'village',
    pos: null,
    entry: { zone: 'village', spawn: 'start' },
    explored: {},
    killsByType: {},
    stats: { playtimeMs: 0, kills: 0, deaths: 0, chestsOpened: 0, damageDealt: 0, potionsUsed: 0 },
  };
}

/** Bring an older or partial save up to the current shape. */
export function migrateSave(raw: unknown): GameData {
  const fresh = createNewGame('Wren');
  const d = (raw ?? {}) as Partial<GameData>;
  return {
    ...fresh,
    ...d,
    version: 1,
    inventory: { ...(d.inventory ?? fresh.inventory) },
    equipment: { ...fresh.equipment, ...(d.equipment ?? {}) },
    abilities: { ...fresh.abilities, ...(d.abilities ?? {}) },
    quests: { ...(d.quests ?? {}) },
    flags: { ...(d.flags ?? {}) },
    entry: d.entry ?? fresh.entry,
    explored: { ...(d.explored ?? {}) },
    killsByType: { ...(d.killsByType ?? {}) },
    stats: { ...fresh.stats, ...(d.stats ?? {}) },
  };
}
