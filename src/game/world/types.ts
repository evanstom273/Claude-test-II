import type Phaser from 'phaser';
import type { Fx } from '../fx';
import type { Level } from './Level';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { Boss } from '../entities/bosses';
import type { Light } from './Lighting';

export interface ShotOptions {
  spin?: number;
  light?: number;
  lightRadius?: number;
  life?: number;
  /** Turn rate towards the player, radians per second. */
  homing?: number;
  scale?: number;
  /** Ignore walls. */
  ghost?: boolean;
}

/** What entities are allowed to ask of the world they live in. */
export interface World extends Phaser.Scene {
  level: Level;
  player: Player;
  fx: Fx;
  enemies: Phaser.GameObjects.Group;
  dynamicLights: Light[];
  fireEnemyShot(x: number, y: number, angle: number, speed: number, frame: string, damage: number, opts?: ShotOptions): void;
  fireBolt(x: number, y: number, angle: number, damage: number): void;
  hurtPlayer(amount: number, fromX: number, fromY: number): void;
  hitEnemy(enemy: Enemy, amount: number, fromX: number, fromY: number, knock?: number): void;
  spawnEnemy(kind: string, x: number, y: number): Enemy;
  enemyDied(enemy: Enemy): void;
  clearEnemyShots(x: number, y: number, radius: number): void;
  isPaused(): boolean;
  /** Damage the player if they're within `radius` of (x, y). */
  hazard(x: number, y: number, radius: number, damage: number): boolean;
  bossDefeated(boss: Boss): void;
  /** Walkable bounds of the current boss arena, in world pixels. */
  arenaBounds: Phaser.Geom.Rectangle | null;
}
