import Phaser from 'phaser';
import type { Faction, Look } from '../../data/cast';
import { WEAPONS } from '../../data/weapons';
import type { Point, WeaponId } from '../../state/types';
import { B, TILE, blockAt } from '../city/tiles';
import { ATLAS, ROT } from '../textures';
import type { World } from '../world';
import type { Car } from './Car';

export type Facing = 'down' | 'up' | 'left' | 'right';
export type Role = 'player' | 'civ' | 'cop' | 'gang' | 'staff' | 'target';

/** People are drawn at 32px and shown at half size: one tile tall. */
export const PERSON_SCALE = 0.5;
const HALF_W = 3.5;
const HALF_H = 2.5;

let nextId = 1;

/** Anyone walking about the city, the player included. */
export class Actor {
  readonly id = nextId++;
  look: Look;
  faction: Faction;
  role: Role;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: Facing = 'down';
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  held: Phaser.GameObjects.Image | null = null;
  hp: number;
  maxHp: number;
  dead = false;
  deadAt = 0;
  weapon: WeaponId = 'fists';
  aim = Math.PI / 2;
  attackReadyAt = 0;
  swingUntil = 0;
  moving = false;
  running = false;
  car: Car | null = null;
  /** Knockback that decays over a moment. */
  knock = { x: 0, y: 0 };
  stunUntil = 0;
  // ---- AI ----
  persistent = false;
  staffOf: number | null = null;
  post: Point | null = null;
  name: string | null = null;
  /** Hostile to the player. */
  hostile = false;
  target: Actor | null = null;
  state = 'wander';
  stateUntil = 0;
  goal: Point | null = null;
  thinkAt = 0;
  seenCrime = 0;
  lastCrimeAt = -1e9;
  tough = false;
  reportAt = 0;
  surrender = false;
  jobTarget = false;
  /** Cash dropped when they go down. */
  wallet = 0;
  /** Set when spawned for the police response, so they can be stood down. */
  responder = false;
  sidestepUntil = 0;
  stuck = 0;

  constructor(
    private world: World,
    look: Look,
    x: number,
    y: number,
    role: Role,
    hp = 40,
  ) {
    this.look = look;
    this.faction = look.faction;
    this.role = role;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    const s = world.gfx;
    this.shadow = s.add.image(x, y, ATLAS, 'shadow').setDepth(-50000).setAlpha(0.9);
    this.sprite = s.add.sprite(x, y, ATLAS, `${look.id}_down_idle`).setOrigin(0.5, 0.97).setScale(PERSON_SCALE);
    this.sync();
  }

  get alive() {
    return !this.dead;
  }

  /** Point at the middle of the body, for bullets and line of sight. */
  get cx() {
    return this.x;
  }
  get cy() {
    return this.y - 7;
  }

  setLook(look: Look) {
    this.look = look;
    this.sprite.anims.stop();
    this.sprite.setFrame(`${look.id}_${this.dirKey()}_idle`);
  }

  setWeapon(w: WeaponId) {
    this.weapon = w;
    const frame = WEAPONS[w].frame;
    if (!frame) {
      this.held?.destroy();
      this.held = null;
      return;
    }
    if (!this.held) this.held = this.world.gfx.add.image(this.x, this.y, ROT, frame).setScale(PERSON_SCALE).setOrigin(0.18, 0.5);
    else this.held.setFrame(frame);
  }

  dirKey() {
    return this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
  }

  faceAngle(a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.facing = Math.abs(c) > Math.abs(s) ? (c > 0 ? 'right' : 'left') : s > 0 ? 'down' : 'up';
  }

  /** Move with collision against the tile grid, one axis at a time so we slide along walls. */
  move(dx: number, dy: number) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx && !this.blocked(this.x + sx, this.y)) this.x += sx;
      if (sy && !this.blocked(this.x, this.y + sy)) this.y += sy;
    }
  }

  blocked(x: number, y: number) {
    const c = this.world.city;
    const cy = y - 2;
    const pts = [
      [x - HALF_W, cy - HALF_H],
      [x + HALF_W, cy - HALF_H],
      [x - HALF_W, cy + HALF_H],
      [x + HALF_W, cy + HALF_H],
    ];
    for (const [px, py] of pts) if (blockAt(c, Math.floor(px / TILE), Math.floor(py / TILE)) & B.PED) return true;
    return false;
  }

  /** Walk (or run) towards an angle at a speed. */
  walk(angle: number, speed: number) {
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.moving = speed > 1;
    if (this.moving && this.world.now >= this.swingUntil) this.faceAngle(angle);
  }

  stop() {
    this.vx = 0;
    this.vy = 0;
    this.moving = false;
  }

  step(dt: number) {
    if (this.dead || this.car) return;
    const kx = this.knock.x * dt;
    const ky = this.knock.y * dt;
    this.knock.x *= Math.pow(0.02, dt);
    this.knock.y *= Math.pow(0.02, dt);
    const stunned = this.world.now < this.stunUntil;
    this.move((stunned ? 0 : this.vx * dt) + kx, (stunned ? 0 : this.vy * dt) + ky);
  }

  /** Put the sprite, shadow and gun where the actor is. */
  sync() {
    const s = this.sprite;
    s.setPosition(Math.round(this.x * 2) / 2, Math.round(this.y * 2) / 2);
    s.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1);
    if (this.dead) return;
    const dir = this.dirKey();
    s.setFlipX(this.facing === 'left');
    if (this.moving && this.world.now >= this.stunUntil) {
      const key = `${this.look.id}_${this.running ? 'run' : 'walk'}_${dir}`;
      if (s.anims.currentAnim?.key !== key) s.play(key, true);
    } else {
      if (s.anims.isPlaying) s.anims.stop();
      s.setFrame(`${this.look.id}_${dir}_idle`);
    }
    if (this.held) {
      const swinging = this.world.now < this.swingUntil;
      let ang = this.aim;
      if (WEAPONS[this.weapon].melee) {
        // Bats rest on the shoulder and sweep through the aim when swung.
        const t = swinging ? 1 - (this.swingUntil - this.world.now) / 220 : 0;
        ang = swinging ? this.aim - 1.4 + t * 2.8 : this.facing === 'left' ? -2.3 : -0.8;
      }
      const left = Math.cos(ang) < 0;
      const hx = this.facing === 'left' ? -2 : this.facing === 'right' ? 2 : this.facing === 'down' ? 3.5 : -3.5;
      const hy = this.facing === 'up' ? -8 : -6;
      this.held
        .setPosition(this.x + hx, this.y + hy)
        .setRotation(ang)
        .setFlipY(left)
        .setDepth(this.facing === 'up' ? this.y - 0.1 : this.y + 0.1)
        .setVisible(!this.car);
    }
  }

  die(world: World, fromAngle = 0) {
    if (this.dead) return;
    this.dead = true;
    this.deadAt = world.now;
    this.stop();
    this.sprite.anims.stop();
    this.sprite.setFrame(`${this.look.id}_side_idle`);
    this.sprite.setFlipX(Math.cos(fromAngle) < 0);
    this.sprite.setAngle(Math.cos(fromAngle) < 0 ? -90 : 90);
    this.sprite.setTint(0xb8a8a8);
    this.sprite.setDepth(this.y - 8);
    this.held?.destroy();
    this.held = null;
    this.shadow.setVisible(false);
    const blood = world.gfx.add.image(this.x + (Math.cos(fromAngle) < 0 ? -5 : 5), this.y - 2, ATLAS, `blood_${this.id % 3}`).setDepth(-60000).setAlpha(0.9);
    world.decals.push({ obj: blood, at: world.now });
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.held?.destroy();
  }
}

export function tileUnder(a: { x: number; y: number }) {
  return { tx: Math.floor(a.x / TILE), ty: Math.floor((a.y - 2) / TILE) };
}
