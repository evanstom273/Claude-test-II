import type { ZoneId } from '../../state/types';

export type ThemeId = 'village' | 'forest' | 'mine' | 'marsh' | 'rift';

export type BossId = 'thornmother' | 'colossus' | 'abbess' | 'hollow_king';

export type AmbientId = 'embers' | 'leaves' | 'dust' | 'spray' | 'motes';

export type MarkerDef =
  | { type: 'spawn'; name: string }
  | { type: 'exit'; to: ZoneId; spawn: string; label?: string }
  | { type: 'npc'; id: string }
  | { type: 'chest'; id: string; item?: string; count?: number; gold?: number }
  | { type: 'sign'; id: string; text: string[] }
  | { type: 'glowcap'; id: string }
  | { type: 'gate'; id: string; key: string }
  | { type: 'boss'; boss: BossId }
  | { type: 'arena'; boss: BossId }
  | { type: 'seal'; boss: BossId }
  | { type: 'hearth' }
  | { type: 'cat' }
  | { type: 'shrine' }
  | { type: 'light'; radius?: number; color?: number };

export interface MapDef {
  id: ZoneId;
  name: string;
  subtitle?: string;
  theme: ThemeId;
  music: string;
  /** 0..1 darkness overlay alpha. The village overrides this from story progress. */
  darkness: number;
  ambient?: AmbientId;
  rows: string[];
  markers: Record<string, MarkerDef>;
  /** Remap enemy letters to variants, e.g. { s: 'cave_slime' }. */
  enemyVariants?: Record<string, string>;
}
