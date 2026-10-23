import type { EquipSlot } from '../data/items';

export type ZoneId = 'village' | 'whisperwood' | 'hollowdeep' | 'saltmere' | 'rift';

export type Facing = 'down' | 'up' | 'left' | 'right';

export type AbilityId = 'bolt' | 'dash' | 'radiance';

export type QuestId = 'main' | 'whiskers' | 'glowcaps' | 'ring' | 'slimes' | 'masterwork';

export interface QuestState {
  status: 'active' | 'complete';
  stage: number;
}

export type FlagValue = boolean | number | string;

export interface RunStats {
  playtimeMs: number;
  kills: number;
  deaths: number;
  chestsOpened: number;
  damageDealt: number;
  potionsUsed: number;
}

/** Everything that gets written to a save slot. Must stay JSON-serialisable. */
export interface GameData {
  version: 1;
  playerName: string;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  gold: number;
  inventory: Record<string, number>;
  equipment: Record<EquipSlot, string | null>;
  abilities: Record<AbilityId, boolean>;
  quests: Partial<Record<QuestId, QuestState>>;
  flags: Record<string, FlagValue>;
  zone: ZoneId;
  /** Player position in world pixels, or null to use the entry spawn. */
  pos: { x: number; y: number; facing: Facing } | null;
  /** Where the player respawns after falling. */
  entry: { zone: ZoneId; spawn: string };
  /** Base64 bitsets of explored tiles, per zone. */
  explored: Partial<Record<ZoneId, string>>;
  killsByType: Record<string, number>;
  stats: RunStats;
}
