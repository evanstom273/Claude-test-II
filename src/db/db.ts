import Dexie, { type EntityTable } from 'dexie';
import type { GameData } from '../state/types';

export interface SaveRecord {
  slot: number;
  cash: number;
  day: number;
  jobsDone: number;
  playtimeMs: number;
  createdAt: number;
  updatedAt: number;
  data: GameData;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class CityDB extends Dexie {
  saves!: EntityTable<SaveRecord, 'slot'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'lowlife') {
    super(name);
    this.version(1).stores({
      saves: 'slot, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new CityDB();

export const SLOT_COUNT = 3;
