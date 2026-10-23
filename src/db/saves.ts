import { migrateSave } from '../state/newGame';
import type { GameData } from '../state/types';
import { db as defaultDb, type CityDB, type SaveRecord } from './db';

export async function listSaves(db: CityDB = defaultDb): Promise<SaveRecord[]> {
  return db.saves.orderBy('slot').toArray();
}

export async function latestSave(db: CityDB = defaultDb): Promise<SaveRecord | undefined> {
  return db.saves.orderBy('updatedAt').last();
}

export async function readSave(slot: number, db: CityDB = defaultDb): Promise<GameData | undefined> {
  const rec = await db.saves.get(slot);
  return rec ? migrateSave(rec.data) : undefined;
}

export async function writeSave(slot: number, data: GameData, db: CityDB = defaultDb): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.saves, async () => {
    const existing = await db.saves.get(slot);
    await db.saves.put({
      slot,
      cash: data.cash,
      day: data.day,
      jobsDone: data.stats.jobsDone,
      playtimeMs: data.stats.playtimeMs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // Round-trip through JSON so nothing un-cloneable sneaks into IndexedDB.
      data: JSON.parse(JSON.stringify(data)) as GameData,
    });
  });
}

export async function deleteSave(slot: number, db: CityDB = defaultDb): Promise<void> {
  await db.saves.delete(slot);
}
