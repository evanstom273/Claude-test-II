import Phaser from 'phaser';
import { CAR_SPECS, type CarModel, type CarSpec } from '../art/cars';
import { carFrameKey } from '../art/registry';
import { B, TILE, blockAt } from '../city/tiles';
import { ATLAS } from '../textures';
import type { World } from '../world';
import type { Actor } from './Actor';

let nextId = 1;

/** Cars are drawn at twice world resolution and shown a little larger than half size. */
export const CAR_SCALE = 0.6;

export interface CarInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
}

/** What drives a car that the player isn't in. */
export interface CarAI {
  kind: 'traffic' | 'pursuit' | 'flee' | 'parked';
  path: { x: number; y: number }[];
  dir: number;
  stuck: number;
  reverseUntil: number;
  honkAt: number;
  cruise: number;
}

/**
 * A car: arcade physics with grip (so it can drift with the handbrake),
 * collisions against the tile grid sampled round its outline, and damage that
 * ends in fire and then a bang.
 */
export class Car {
  readonly id = nextId++;
  model: CarModel;
  colour: number;
  spec: CarSpec;
  x: number;
  y: number;
  angle: number;
  vx = 0;
  vy = 0;
  len: number;
  wid: number;
  hp: number;
  maxHp: number;
  burning = false;
  burnUntil = 0;
  wrecked = false;
  driver: Actor | null = null;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  siren = false;
  input: CarInput = { throttle: 0, steer: 0, handbrake: false };
  ai: CarAI | null = null;
  persistent = false;
  jobTarget = false;
  lastCrashAt = 0;
  lastSmokeAt = 0;
  lastSkidAt = 0;
  /** Stolen by the player at some point (for the stats and the chop shop). */
  stolen = false;

  constructor(
    private world: World,
    model: CarModel,
    colour: number,
    x: number,
    y: number,
    angle: number,
  ) {
    this.model = model;
    this.colour = colour;
    this.spec = CAR_SPECS[model];
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.len = this.spec.len * CAR_SCALE;
    this.wid = this.spec.wid * CAR_SCALE;
    this.hp = this.spec.hp;
    this.maxHp = this.spec.hp;
    const s = world.gfx;
    this.shadow = s.add.image(x, y, ATLAS, 'shadow_car').setDepth(-50000).setScale((this.len + 4) / 28, (this.wid + 3) / 16);
    this.sprite = s.add.image(x, y, ATLAS, carFrameKey(model, colour)).setScale(CAR_SCALE);
    this.sync();
  }

  get isPolice() {
    return this.model === 'police';
  }

  get maxSpeed() {
    return this.spec.speed * 210;
  }

  /** Signed speed along the heading. */
  get speed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  get absSpeed() {
    return Math.hypot(this.vx, this.vy);
  }

  /** Two circles along the body, for bumping into things. */
  circles(): [number, number, number][] {
    const r = this.wid / 2 + 0.5;
    const off = this.len / 2 - r;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return [
      [this.x + c * off, this.y + s * off, r],
      [this.x - c * off, this.y - s * off, r],
    ];
  }

  /** A world point relative to the car (forward, right). */
  local(f: number, r: number) {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return { x: this.x + c * f - s * r, y: this.y + s * f + c * r };
  }

  step(dt: number) {
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const rx = -fy;
    const ry = fx;
    let vf = this.vx * fx + this.vy * fy;
    let vl = this.vx * rx + this.vy * ry;
    const inp = this.wrecked || !this.driver ? { throttle: 0, steer: 0, handbrake: true } : this.input;
    const max = this.maxSpeed;
    const accel = this.spec.accel * 230;

    if (inp.throttle > 0) {
      if (vf < 0) vf = Math.min(0, vf + 520 * dt);
      else if (vf < max * inp.throttle) vf = Math.min(max, vf + accel * inp.throttle * (1 - (vf / max) * 0.5) * dt);
    } else if (inp.throttle < 0) {
      if (vf > 6) vf = Math.max(0, vf - 480 * dt);
      else vf = Math.max(-max * 0.35, vf - accel * 0.7 * -inp.throttle * dt);
    } else {
      vf *= Math.pow(0.45, dt);
    }
    if (inp.handbrake) vf *= Math.pow(this.driver ? 0.35 : 0.05, dt);
    vf *= 1 - 0.12 * dt;

    const grip = inp.handbrake ? 1.4 : 8 * this.spec.grip;
    vl *= Math.max(0, 1 - grip * dt);

    const speedFactor = Math.max(-1, Math.min(1, vf / 60));
    this.angle += inp.steer * 3.1 * speedFactor * dt * (inp.handbrake ? 1.4 : 1);

    this.vx = fx * vf + rx * vl;
    this.vy = fy * vf + ry * vl;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.collideTiles();

    // Skid marks when sliding hard.
    if (Math.abs(vl) > 55 && this.world.now - this.lastSkidAt > 40) {
      this.lastSkidAt = this.world.now;
      for (const side of [-1, 1]) {
        const p = this.local(-this.len * 0.3, side * this.wid * 0.35);
        const m = this.world.gfx.add.image(p.x, p.y, ATLAS, 'skid').setRotation(this.angle).setDepth(-60000);
        this.world.decals.push({ obj: m, at: this.world.now });
      }
    }
    this.sync();
  }

  private collideTiles() {
    const c = this.world.city;
    const hl = this.len / 2;
    const hw = this.wid / 2;
    const samples: [number, number][] = [
      [hl, -hw],
      [hl, hw],
      [-hl, -hw],
      [-hl, hw],
      [hl, 0],
      [-hl, 0],
      [0, -hw],
      [0, hw],
    ];
    for (let iter = 0; iter < 3; iter++) {
      let px = 0;
      let py = 0;
      for (const [f, r] of samples) {
        const p = this.local(f, r);
        const tx = Math.floor(p.x / TILE);
        const ty = Math.floor(p.y / TILE);
        if (!(blockAt(c, tx, ty) & B.CAR)) continue;
        // Push out through the nearest open side of the tile.
        const opts: [number, number, number][] = [];
        const x0 = tx * TILE;
        const y0 = ty * TILE;
        if (!(blockAt(c, tx - 1, ty) & B.CAR)) opts.push([x0 - p.x - 0.01, 0, p.x - x0]);
        if (!(blockAt(c, tx + 1, ty) & B.CAR)) opts.push([x0 + TILE - p.x + 0.01, 0, x0 + TILE - p.x]);
        if (!(blockAt(c, tx, ty - 1) & B.CAR)) opts.push([0, y0 - p.y - 0.01, p.y - y0]);
        if (!(blockAt(c, tx, ty + 1) & B.CAR)) opts.push([0, y0 + TILE - p.y + 0.01, y0 + TILE - p.y]);
        if (!opts.length) continue;
        opts.sort((a, b) => a[2] - b[2]);
        const [dx, dy] = opts[0];
        if (Math.abs(dx) > Math.abs(px)) px = dx;
        if (Math.abs(dy) > Math.abs(py)) py = dy;
      }
      if (!px && !py) break;
      this.x += px;
      this.y += py;
      const len = Math.hypot(px, py);
      const nx = px / len;
      const ny = py / len;
      const vn = this.vx * nx + this.vy * ny;
      if (vn < 0) {
        this.vx -= 1.3 * vn * nx;
        this.vy -= 1.3 * vn * ny;
        this.impact(-vn);
      }
    }
  }

  /** A knock of some speed: damage, noise, sparks. */
  impact(speed: number, other?: Car) {
    if (speed < 35) return;
    const w = this.world;
    if (w.now - this.lastCrashAt > 120) {
      this.lastCrashAt = w.now;
      w.fx.crash(this.x, this.y, speed);
    }
    if (speed > 50) w.hurtCar(this, (speed - 50) * 0.22, other?.driver ?? null);
  }

  sync() {
    this.sprite.setPosition(this.x, this.y).setRotation(this.angle).setDepth(this.y + this.wid / 2 + 3);
    this.shadow.setPosition(this.x + 1.5, this.y + 2.5).setRotation(this.angle);
  }

  wreck() {
    this.wrecked = true;
    this.burning = false;
    this.siren = false;
    this.sprite.setFrame(`car_${this.model}_burnt`);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
