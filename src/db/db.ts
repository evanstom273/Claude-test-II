import Dexie, { type EntityTable } from 'dexie';
import type { GameData, ZoneId } from '../state/types';

export interface SaveRecord {
  slot: number;
  playerName: string;
  level: number;
  zone: ZoneId;
  embers: number;
  playtimeMs: number;
  createdAt: number;
  updatedAt: number;
  data: GameData;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class HearthDB extends Dexie {
  saves!: EntityTable<SaveRecord, 'slot'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'hearthlight') {
    super(name);
    this.version(1).stores({
      saves: 'slot, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new HearthDB();

export const SLOT_COUNT = 3;
