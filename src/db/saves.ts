import { embersPlaced } from '../data/quests';
import { migrateSave } from '../state/newGame';
import type { GameData } from '../state/types';
import { db as defaultDb, type HearthDB, type SaveRecord } from './db';

export async function listSaves(db: HearthDB = defaultDb): Promise<SaveRecord[]> {
  return db.saves.orderBy('slot').toArray();
}

export async function latestSave(db: HearthDB = defaultDb): Promise<SaveRecord | undefined> {
  return db.saves.orderBy('updatedAt').last();
}

export async function readSave(slot: number, db: HearthDB = defaultDb): Promise<GameData | undefined> {
  const rec = await db.saves.get(slot);
  return rec ? migrateSave(rec.data) : undefined;
}

export async function writeSave(slot: number, data: GameData, db: HearthDB = defaultDb): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.saves, async () => {
    const existing = await db.saves.get(slot);
    await db.saves.put({
      slot,
      playerName: data.playerName,
      level: data.level,
      zone: data.zone,
      embers: embersPlaced(data),
      playtimeMs: data.stats.playtimeMs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // Round-trip through JSON so nothing un-cloneable sneaks into IndexedDB.
      data: JSON.parse(JSON.stringify(data)) as GameData,
    });
  });
}

export async function deleteSave(slot: number, db: HearthDB = defaultDb): Promise<void> {
  await db.saves.delete(slot);
}
