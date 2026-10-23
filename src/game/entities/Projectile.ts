import Phaser from 'phaser';
import { ATLAS } from '../textures';
import type { ShotOptions, World } from '../world/types';

export class Projectile extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  damage: number;
  life: number;
  spin: number;
  light?: number;
  lightRadius: number;
  homing: number;
  ghost: boolean;
  private speed: number;
  private world: World;

  constructor(world: World, x: number, y: number, angle: number, speed: number, frame: string, damage: number, opts: ShotOptions = {}) {
    super(world, x, y, ATLAS, frame);
    this.world = world;
    world.add.existing(this);
    world.physics.add.existing(this);
    this.damage = damage;
    this.speed = speed;
    this.life = opts.life ?? 3200;
    this.spin = opts.spin ?? 0;
    this.light = opts.light;
    this.lightRadius = opts.lightRadius ?? 26;
    this.homing = opts.homing ?? 0;
    this.ghost = !!opts.ghost;
    this.setScale(opts.scale ?? 1);
    this.body.setCircle(3, 1, 1);
    this.setRotation(this.spin ? 0 : angle);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.setDepth(11000);
  }

  tick(delta: number) {
    this.life -= delta;
    if (this.life <= 0) return this.pop();
    if (this.spin) this.rotation += this.spin * (delta / 1000);
    if (this.homing) {
      const p = this.world.player;
      const want = Phaser.Math.Angle.Between(this.x, this.y, p.body.center.x, p.body.center.y);
      const cur = Math.atan2(this.body.velocity.y, this.body.velocity.x);
      const next = Phaser.Math.Angle.RotateTo(cur, want, this.homing * (delta / 1000));
      this.setVelocity(Math.cos(next) * this.speed, Math.sin(next) * this.speed);
    }
    if (this.life < 300) this.setAlpha(this.life / 300);
  }

  pop() {
    if (!this.active) return;
    this.world.fx.burst(this.x, this.y, this.light ?? 0xffffff, 4, 30);
    this.destroy();
  }
}
