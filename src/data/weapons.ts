import type { WeaponId } from '../state/types';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  melee: boolean;
  damage: number;
  /** Reach for melee, max distance for guns (world px). */
  range: number;
  /** Attacks per second. */
  rate: number;
  spread: number;
  pellets: number;
  knock: number;
  /** Rounds you get when you buy it, and when you buy more ammo. */
  ammo: number;
  price: number;
  ammoPrice: number;
  /** Held sprite and pickup icon. */
  frame: string | null;
  /** How far the bang carries for the AI (px). */
  noise: number;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  fists: { id: 'fists', name: 'Fists', melee: true, damage: 9, range: 13, rate: 3.2, spread: 0, pellets: 1, knock: 110, ammo: 0, price: 0, ammoPrice: 0, frame: null, noise: 0 },
  bat: { id: 'bat', name: 'Cricket Bat', melee: true, damage: 24, range: 17, rate: 2, spread: 0, pellets: 1, knock: 210, ammo: 1, price: 40, ammoPrice: 0, frame: 'w_bat', noise: 0 },
  pistol: { id: 'pistol', name: 'Pistol', melee: false, damage: 24, range: 170, rate: 3, spread: 0.04, pellets: 1, knock: 70, ammo: 24, price: 180, ammoPrice: 40, frame: 'w_pistol', noise: 240 },
  smg: { id: 'smg', name: 'SMG', melee: false, damage: 12, range: 150, rate: 10, spread: 0.11, pellets: 1, knock: 40, ammo: 90, price: 550, ammoPrice: 70, frame: 'w_smg', noise: 260 },
  shotgun: { id: 'shotgun', name: 'Shotgun', melee: false, damage: 13, range: 100, rate: 1.2, spread: 0.3, pellets: 6, knock: 120, ammo: 16, price: 450, ammoPrice: 60, frame: 'w_shotgun', noise: 280 },
};
