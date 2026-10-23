import type { GangId } from '../data/cast';
import type { CarModel } from '../game/art/cars';

export type WeaponId = 'fists' | 'bat' | 'pistol' | 'smg' | 'shotgun';
export type ItemId = 'burger' | 'chips' | 'medkit' | 'pint';
export type JobType = 'steal_car' | 'hit' | 'deliver' | 'torch' | 'cull';
export type Giver = GangId | 'fixer';

export interface Point {
  x: number;
  y: number;
}

export interface Job {
  id: string;
  type: JobType;
  giver: Giver;
  title: string;
  brief: string;
  reward: number;
  /** Where to go next (world px), with a label for the HUD. */
  marker?: Point & { label: string };
  dropoff?: Point;
  model?: CarModel;
  targetName?: string;
  targetLook?: string;
  targetGang?: GangId;
  count?: number;
  progress?: number;
  timeLimitMs?: number;
  /** Game time left, counted down while playing. */
  timeLeftMs?: number;
  stage?: number;
}

export interface Stats {
  playtimeMs: number;
  jobsDone: number;
  kills: number;
  carsStolen: number;
  cashEarned: number;
  wasted: number;
  busted: number;
  maxWanted: number;
}

export interface GameData {
  version: 1;
  seed: number;
  cash: number;
  health: number;
  maxHealth: number;
  /** Ammo per gun; melee weapons hold 1 when owned. */
  weapons: Partial<Record<WeaponId, number>>;
  current: WeaponId;
  items: Partial<Record<ItemId, number>>;
  outfit: number;
  outfits: number[];
  respect: Record<GangId, number>;
  /** Minutes since midnight. */
  clock: number;
  day: number;
  job: Job | null;
  stats: Stats;
  /** Where to wake up; null means the safehouse. */
  pos: Point | null;
}
