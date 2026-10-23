import Phaser from 'phaser';
import { ENEMIES, type EnemyDef } from '../../data/enemies';
import { sfx } from '../audio';
import { ATLAS } from '../textures';
import type { World } from '../world/types';

const { Distance, Angle } = Phaser.Math;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  dead = false;
  isBoss = false;
  protected world: World;
  readonly home: Phaser.Math.Vector2;
  protected mode = 'idle';
  protected modeUntil = 0;
  protected nextActionAt = 0;
  protected knockUntil = 0;
  protected aim = { x: 0, y: 0 };
  protected shadow: Phaser.GameObjects.Image;
  protected wobble = Math.random() * Math.PI * 2;
  /** Seconds since spawn, for idle motion. */
  protected age = 0;

  constructor(world: World, x: number, y: number, kind: string | EnemyDef, frame?: string) {
    const def = typeof kind === 'string' ? ENEMIES[kind] : kind;
    super(world, x, y, ATLAS, frame ?? (def.anim === 'drowned' ? 'drowned_down_idle' : `${def.anim}_0`));
    this.world = world;
    this.def = def;
    this.hp = def.hp;
    this.maxHp = this.hp;
    this.home = new Phaser.Math.Vector2(x, y);
    world.add.existing(this);
    world.physics.add.existing(this);
    this.shadow = world.add.image(x, y, ATLAS, 'shadow').setDepth(-5000);
    this.play(`${def.anim}_move`);
    this.anims.setProgress(Math.random());
    this.configureBody();
    this.nextActionAt = world.time.now + 400 + Math.random() * 1200;
  }

  protected configureBody() {
    const b = this.body;
    if (this.def.behavior === 'turret') {
      b.setSize(12, 10).setOffset(2, 6);
      b.setImmovable(true);
    } else if (this.def.flying) {
      b.setSize(10, 8).setOffset(3, 5);
    } else {
      b.setSize(10, 7).setOffset(3, 9);
    }
    b.setCollideWorldBounds(true);
  }

  get feetY() {
    return this.body.bottom;
  }

  protected toPlayer() {
    const p = this.world.player;
    return {
      dist: Distance.Between(this.body.center.x, this.body.center.y, p.body.center.x, p.body.center.y),
      angle: Angle.Between(this.body.center.x, this.body.center.y, p.body.center.x, p.body.center.y),
    };
  }

  protected playerVisible() {
    return this.world.player.state !== 'dead';
  }

  protected moveAngle(angle: number, speed: number) {
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  update(time: number, delta: number) {
    if (this.dead) return;
    this.age += delta / 1000;
    this.setDepth(this.feetY);
    const hover = this.def.flying ? 6 + Math.sin(this.age * 4 + this.wobble) * 1.5 : 0;
    this.shadow.setPosition(this.body.center.x, this.feetY + (this.def.flying ? hover : -1));
    this.shadow.setScale(this.def.flying ? 0.7 : 1);

    if (time < this.knockUntil) {
      this.body.velocity.scale(0.85);
      return;
    }
    this.think(time, delta);
    if (this.def.flips && Math.abs(this.body.velocity.x) > 2) this.setFlipX(this.body.velocity.x < 0);
  }

  /** Behaviour, run every frame unless stunned by knockback. */
  protected think(time: number, delta: number) {
    const { dist, angle } = this.toPlayer();
    const aggro = this.playerVisible() && dist < this.def.aggro;
    const fromHome = Distance.Between(this.x, this.y, this.home.x, this.home.y);
    switch (this.def.behavior) {
      case 'hopper':
        return this.hopper(time, dist, angle, aggro, fromHome);
      case 'flyer':
        return this.flyer(time, dist, angle, aggro, delta);
      case 'charger':
      case 'skitter':
        return this.charger(time, dist, angle, aggro, fromHome);
      case 'turret':
        return this.turret(time, dist, angle, aggro);
      case 'thrower':
        return this.thrower(time, dist, angle, aggro, fromHome);
      case 'phaser':
        return this.phaser(time, dist, angle, aggro);
      case 'brute':
        return this.brute(time, dist, angle, aggro, fromHome);
      case 'blinker':
        return this.blinker(time, dist, angle, aggro);
    }
  }

  private wander(time: number, speed: number, fromHome: number) {
    if (time < this.nextActionAt) return;
    if (this.mode === 'wander') {
      this.setVelocity(0, 0);
      this.mode = 'idle';
      this.nextActionAt = time + 800 + Math.random() * 1800;
      return;
    }
    const a = fromHome > 40 ? Angle.Between(this.x, this.y, this.home.x, this.home.y) : Math.random() * Math.PI * 2;
    this.moveAngle(a, speed * 0.5);
    this.mode = 'wander';
    this.nextActionAt = time + 400 + Math.random() * 500;
  }

  private hopper(time: number, _dist: number, angle: number, aggro: boolean, fromHome: number) {
    if (this.mode === 'hop') {
      if (time >= this.modeUntil) {
        this.setVelocity(0, 0);
        this.mode = 'rest';
        this.setFrame(`${this.def.anim}_1`);
        this.nextActionAt = time + (aggro ? 500 + Math.random() * 500 : 1400 + Math.random() * 1600);
      }
      return;
    }
    if (!this.anims.isPlaying) this.play(`${this.def.anim}_move`);
    if (time < this.nextActionAt) {
      this.setVelocity(0, 0);
      return;
    }
    let a = angle;
    if (!aggro) a = fromHome > 48 ? Angle.Between(this.x, this.y, this.home.x, this.home.y) : Math.random() * Math.PI * 2;
    this.moveAngle(a, this.def.speed * (aggro ? 1 : 0.5));
    this.mode = 'hop';
    this.modeUntil = time + 280;
    this.play(`${this.def.anim}_move`);
  }

  private flyer(time: number, dist: number, angle: number, aggro: boolean, delta: number) {
    this.wobble += delta / 1000 * 5;
    if (aggro) {
      const side = Math.sin(this.wobble) * 0.9;
      const a = angle + side;
      const sp = this.def.speed * (dist < 20 ? 1.2 : 1);
      this.moveAngle(a, sp);
    } else {
      const a = Angle.Between(this.x, this.y, this.home.x + Math.cos(this.wobble * 0.4) * 30, this.home.y + Math.sin(this.wobble * 0.6) * 20);
      this.moveAngle(a, this.def.speed * 0.4);
    }
    void time;
  }

  private charger(time: number, dist: number, angle: number, aggro: boolean, fromHome: number) {
    const skitter = this.def.behavior === 'skitter';
    switch (this.mode) {
      case 'windup':
        this.setVelocity(0, 0);
        this.x += Math.sin(time * 0.08) * 0.3;
        if (time >= this.modeUntil) {
          this.mode = 'lunge';
          this.modeUntil = time + (skitter ? 280 : 380);
          this.moveAngle(Math.atan2(this.aim.y, this.aim.x), this.def.speed * (skitter ? 3.6 : 3.8));
          this.clearTint();
        }
        return;
      case 'lunge':
        if (time >= this.modeUntil || this.body.blocked.none === false) {
          this.mode = 'recover';
          this.modeUntil = time + 650;
          this.setVelocity(0, 0);
        }
        return;
      case 'recover':
        this.body.velocity.scale(0.8);
        if (time >= this.modeUntil) this.mode = 'idle';
        return;
    }
    if (!aggro) return this.wander(time, this.def.speed, fromHome);
    if (dist < (skitter ? 52 : 64) && time >= this.nextActionAt) {
      this.mode = 'windup';
      this.modeUntil = time + (skitter ? 260 : 420);
      this.aim = { x: Math.cos(angle), y: Math.sin(angle) };
      this.setTint(0xffa0a0);
      this.nextActionAt = time + 1600;
      return;
    }
    // Approach. Crabs scuttle sideways.
    const a = skitter ? angle + Math.sin(time * 0.006 + this.wobble) * 1.1 : angle;
    this.moveAngle(a, this.def.speed);
    this.mode = 'approach';
  }

  private turret(time: number, dist: number, angle: number, aggro: boolean) {
    this.setVelocity(0, 0);
    if (!aggro || time < this.nextActionAt) return;
    this.nextActionAt = time + 1700 + Math.random() * 500;
    this.anims.stop();
    this.setFrame(`${this.def.anim}_1`);
    this.world.time.delayedCall(220, () => {
      if (this.dead) return;
      this.world.fireEnemyShot(this.body.center.x, this.body.center.y - 4, angle, 95, this.def.shot ?? 'thorn', this.def.shotAtk ?? this.def.atk);
      sfx('shoot');
      this.world.time.delayedCall(250, () => !this.dead && this.setFrame(`${this.def.anim}_0`));
    });
    void dist;
  }

  private thrower(time: number, dist: number, angle: number, aggro: boolean, fromHome: number) {
    if (this.mode === 'windup') {
      this.setVelocity(0, 0);
      if (time >= this.modeUntil) {
        this.mode = 'idle';
        this.clearTint();
        this.world.fireEnemyShot(this.body.center.x, this.body.center.y - 4, angle, 105, this.def.shot ?? 'bone', this.def.shotAtk ?? this.def.atk, { spin: 14 });
        sfx('shoot');
      }
      return;
    }
    if (!aggro) return this.wander(time, this.def.speed, fromHome);
    if (time >= this.nextActionAt && dist < 140) {
      this.mode = 'windup';
      this.modeUntil = time + 320;
      this.nextActionAt = time + 2200 + Math.random() * 600;
      this.setTint(0xffe0a0);
      return;
    }
    if (dist > 90) this.moveAngle(angle, this.def.speed);
    else if (dist < 48) this.moveAngle(angle + Math.PI, this.def.speed);
    else this.moveAngle(angle + Math.PI / 2 * (Math.sin(this.wobble + time * 0.001) > 0 ? 1 : -1), this.def.speed * 0.6);
  }

  private phaser(time: number, dist: number, angle: number, aggro: boolean) {
    this.setAlpha(0.6 + Math.sin(this.age * 3 + this.wobble) * 0.25);
    if (!aggro) {
      const a = Angle.Between(this.x, this.y, this.home.x + Math.cos(this.age) * 24, this.home.y + Math.sin(this.age * 0.7) * 16);
      this.moveAngle(a, this.def.speed * 0.5);
      return;
    }
    this.moveAngle(angle, this.def.speed);
    if (time >= this.nextActionAt && dist < 120) {
      this.nextActionAt = time + 2800 + Math.random() * 1200;
      this.world.fireEnemyShot(this.body.center.x, this.body.center.y, angle, 70, this.def.shot ?? 'orb_tide', this.def.shotAtk ?? this.def.atk, { light: 0x6fd0f0 });
      sfx('shoot');
    }
  }

  private brute(time: number, dist: number, angle: number, aggro: boolean, fromHome: number) {
    switch (this.mode) {
      case 'windup':
        this.setVelocity(0, 0);
        if (time >= this.modeUntil) {
          this.mode = 'lunge';
          this.modeUntil = time + 240;
          this.moveAngle(Math.atan2(this.aim.y, this.aim.x), 190);
          this.clearTint();
        }
        return;
      case 'lunge':
        if (time >= this.modeUntil) {
          this.mode = 'recover';
          this.modeUntil = time + 700;
          this.setVelocity(0, 0);
        }
        return;
      case 'recover':
        this.setVelocity(0, 0);
        if (time >= this.modeUntil) this.mode = 'idle';
        return;
    }
    if (!aggro) return this.wander(time, this.def.speed, fromHome);
    if (dist < 34 && time >= this.nextActionAt) {
      this.mode = 'windup';
      this.modeUntil = time + 520;
      this.nextActionAt = time + 1500;
      this.aim = { x: Math.cos(angle), y: Math.sin(angle) };
      this.setTint(0xff8080);
      return;
    }
    this.moveAngle(angle, this.def.speed);
  }

  private blinker(time: number, dist: number, angle: number, aggro: boolean) {
    switch (this.mode) {
      case 'fading':
        this.setVelocity(0, 0);
        return;
      case 'windup':
        this.setVelocity(0, 0);
        if (time >= this.modeUntil) {
          this.mode = 'lunge';
          this.modeUntil = time + 300;
          this.clearTint();
          this.moveAngle(angle, 210);
        }
        return;
      case 'lunge':
        if (time >= this.modeUntil) {
          this.mode = 'idle';
          this.setVelocity(0, 0);
        }
        return;
    }
    this.setAlpha(0.85);
    if (!aggro) {
      this.setVelocity(0, 0);
      return;
    }
    if (time >= this.nextActionAt && dist < 170) {
      this.nextActionAt = time + 3200 + Math.random() * 1200;
      this.blink();
      return;
    }
    this.moveAngle(angle, this.def.speed * (dist < 40 ? 0.3 : 1));
  }

  private blink() {
    this.mode = 'fading';
    this.body.enable = false;
    this.world.fx.burst(this.x, this.y, [0x4b2e75, 0xa070e0], 8, 30);
    this.world.tweens.add({
      targets: this,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        if (this.dead) return;
        const p = this.world.player;
        let tx = p.x;
        let ty = p.y;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 34 + Math.random() * 14;
          const cx = p.x + Math.cos(a) * r;
          const cy = p.y + Math.sin(a) * r;
          if (!this.world.level.isBlockedAt(cx, cy + 4)) {
            tx = cx;
            ty = cy;
            break;
          }
        }
        this.setPosition(tx, ty);
        this.body.enable = true;
        this.body.reset(tx, ty);
        this.world.tweens.add({ targets: this, alpha: 0.9, duration: 180 });
        this.mode = 'windup';
        this.modeUntil = this.world.time.now + 380;
        this.setTint(0xff80c0);
      },
    });
  }

  /** Called by the world when something hits this enemy. Returns damage dealt. */
  takeHit(amount: number, fromX: number, fromY: number, knock = 1): void {
    if (this.dead) return;
    this.hp -= amount;
    this.world.fx.flash(this);
    const poise = this.def.poise ?? 0;
    const k = 150 * knock * (1 - poise);
    if (k > 1 && this.mode !== 'fading') {
      const a = Angle.Between(fromX, fromY, this.x, this.y);
      this.setVelocity(Math.cos(a) * k, Math.sin(a) * k);
      this.knockUntil = this.world.time.now + 140;
      if (this.mode === 'windup' || this.mode === 'lunge') {
        this.mode = 'recover';
        this.modeUntil = this.world.time.now + 300;
        this.clearTint();
      }
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.body.enable = false;
    this.setVelocity(0, 0);
    sfx('kill');
    this.world.fx.burst(this.body.center.x, this.body.center.y, this.burstColors(), 14, 55);
    this.world.fx.smoke(this.body.center.x, this.body.center.y, 4);
    this.world.enemyDied(this);
    this.world.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 0.4,
      duration: 220,
      onComplete: () => this.destroy(),
    });
  }

  protected burstColors(): number[] {
    const map: Record<string, number[]> = {
      slime: [0x6dbb4f, 0xb0e878],
      cave_slime: [0x5aa0d8, 0xd8f0ff],
      bog_slime: [0x8a9a4a, 0xe0e8b0],
      bat: [0x8a5fc0, 0x4b2e75],
      cave_bat: [0x6a5a4a, 0xffcf5a],
      wolf: [0x9a98a8, 0xf4efe4],
      gloam_wolf: [0x4b3a6a, 0xff5a8a],
      thornling: [0xd64545, 0x6dbb4f],
      skeleton: [0xf4efe4, 0xc9c2b3],
      crawler: [0xf2a33a, 0x8a5a3b],
      wisp: [0x5fd0c4, 0xf4efe4],
      drowned: [0x7fa08a, 0x2f4a3a],
      crab: [0xd64545, 0x8f2b3a],
      shade: [0x8a5fc0, 0x1a1423],
    };
    return map[this.def.kind] ?? [0xffffff];
  }

  destroy(fromScene?: boolean) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
