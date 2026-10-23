import type Phaser from 'phaser';
import type { CityMap } from './city/tiles';
import type { Actor } from './entities/Actor';
import type { Car } from './entities/Car';
import type { Fx } from './fx';
import type { Light } from './Lighting';

export type CrimeKind = 'gunfire' | 'assault' | 'murder' | 'carjack' | 'explosion' | 'copAssault' | 'robbery' | 'roadkill';

export interface Crime {
  id: number;
  kind: CrimeKind;
  x: number;
  y: number;
  at: number;
  by: Actor;
  victim?: Actor;
  /** How far away it can be heard; sight is checked separately. */
  heard: number;
}

/** What entities and systems need from the city scene. */
export interface World {
  /** The scene, for creating game objects. */
  gfx: Phaser.Scene;
  city: CityMap;
  /** Scene time in ms. */
  now: number;
  actors: Actor[];
  cars: Car[];
  player: Actor;
  fx: Fx;
  crimes: Crime[];
  dynamicLights: Light[];
  decals: { obj: Phaser.GameObjects.GameObject; at: number }[];
  crime(kind: CrimeKind, by: Actor, x: number, y: number, victim?: Actor, heard?: number): void;
  hurtActor(a: Actor, dmg: number, fromX: number, fromY: number, by: Actor | null, knock?: number): void;
  hurtCar(c: Car, dmg: number, by: Actor | null): void;
  explode(x: number, y: number, by: Actor | null): void;
  removeActor(a: Actor): void;
}
