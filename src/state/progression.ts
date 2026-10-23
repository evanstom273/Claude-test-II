import { ITEMS } from '../data/items';
import type { GameData } from './types';

export const MAX_LEVEL = 20;

export function xpToNext(level: number): number {
  return Math.round(15 * Math.pow(level, 1.6));
}

export interface BaseStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
}

export function baseStats(level: number): BaseStats {
  const l = level - 1;
  return {
    maxHp: 40 + l * 8,
    maxMp: 20 + l * 3,
    atk: 4 + l,
    def: 1 + Math.floor(l * 0.75),
  };
}

export interface DerivedStats extends BaseStats {
  speed: number;
  mpRegen: number;
  goldFind: number;
  light: number;
}

export function derivedStats(data: Pick<GameData, 'level' | 'equipment'>): DerivedStats {
  const s: DerivedStats = { ...baseStats(data.level), speed: 1, mpRegen: 1, goldFind: 1, light: 1 };
  for (const id of Object.values(data.equipment)) {
    if (!id) continue;
    const def = ITEMS[id];
    if (!def) continue;
    s.atk += def.atk ?? 0;
    s.def += def.def ?? 0;
    s.maxHp += def.maxHp ?? 0;
    s.maxMp += def.maxMp ?? 0;
    s.speed += def.speed ?? 0;
    s.mpRegen += def.mpRegen ?? 0;
    s.goldFind += def.goldFind ?? 0;
    s.light += def.light ?? 0;
  }
  return s;
}

/** Damage from an attack of `power` against a target with `def`. */
export function mitigate(power: number, def: number, variance = 0.1, rand = Math.random): number {
  const roll = 1 - variance + rand() * variance * 2;
  return Math.max(1, Math.round(power * roll * (1 - def / (def + 18))));
}
