import Phaser from 'phaser';
import { BOSSES, type BossDef, type EnemyDef } from '../../data/enemies';
import type { BossId } from '../../data/maps/types';
import { ui } from '../../state/uiStore';
import { sfx } from '../audio';
import { ATLAS } from '../textures';
import type { World } from '../world/types';
import { Enemy } from './Enemy';

const { Angle, Distance } = Phaser.Math;

function bossEnemyDef(b: BossDef): EnemyDef {
  return {
    kind: b.id,
    name: b.name,
    anim: b.anim,
    hp: b.hp,
    atk: b.atk,
    def: b.def,
    xp: b.xp,
    gold: [b.gold, b.gold],
    speed: 0,
    behavior: 'brute',
    aggro: 9999,
    poise: 1,
  };
}

export abstract class Boss extends Enemy {
  readonly boss: BossDef;
  fighting = false;
  phase = 1;
  protected busyUntil = 0;
  protected step = 0;
  protected vulnerable = false;

  constructor(world: World, x: number, y: number, id: BossId) {
    const b = BOSSES[id];
    super(world, x, y, bossEnemyDef(b));
    this.boss = b;
    this.isBoss = true;
    this.shadow.setTexture(ATLAS, 'shadow_big');
    this.body.setSize(22, 12).setOffset(5, 18);
    this.body.setImmovable(true);
    this.setOrigin(0.5, 0.5);
  }

  protected configureBody() {
    this.body.setCollideWorldBounds(true);
  }

  start() {
    this.fighting = true;
    this.busyUntil = this.world.time.now + 1200;
    sfx('roar');
    this.world.fx.shake(500, 0.006);
    this.updateBar();
  }

  protected updateBar() {
    ui.setBoss({ name: this.boss.name, hp: Math.max(0, this.hp), maxHp: this.maxHp });
  }

  update(time: number, delta: number) {
    if (this.dead) return;
    this.age += delta / 1000;
    this.setDepth(this.feetY);
    this.shadow.setPosition(this.body.center.x, this.feetY - 1);
    if (!this.fighting) {
      this.setVelocity(0, 0);
      return;
    }
    this.fight(time, delta);
  }

  protected think() {}

  protected abstract fight(time: number, delta: number): void;

  protected onPhaseTwo() {}

  takeHit(amount: number, fromX: number, fromY: number): void {
    if (this.dead || !this.fighting) return;
    const dmg = this.vulnerable ? amount * 1.6 : amount;
    this.hp -= dmg;
    this.world.fx.flash(this);
    this.updateBar();
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.onPhaseTwo();
    }
    if (this.hp <= 0) this.die();
    void fromX;
    void fromY;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.fighting = false;
    this.body.enable = false;
    this.setVelocity(0, 0);
    ui.setBoss(null);
    sfx('roar');
    const cx = this.body.center.x;
    const cy = this.body.center.y;
    let n = 0;
    this.world.time.addEvent({
      delay: 140,
      repeat: 10,
      callback: () => {
        n++;
        sfx('boom');
        this.world.fx.burst(cx + Phaser.Math.Between(-14, 14), cy + Phaser.Math.Between(-16, 10), [0xffffff, 0xffd56b, 0xf2a33a], 12, 70);
        this.world.fx.shake(120, 0.006);
        this.setTint(n % 2 ? 0xffffff : 0xff6060).setTintMode(Phaser.TintModes.FILL);
      },
    });
    this.world.time.delayedCall(1650, () => {
      this.world.fx.ring(cx, cy, 90, 0xfff3b0, 600);
      this.world.fx.glow(cx, cy, [0xffd56b, 0xffffff], 40, 90);
      this.world.tweens.add({
        targets: this,
        alpha: 0,
        scaleY: 1.6,
        scaleX: 0.4,
        duration: 500,
        onComplete: () => {
          this.world.bossDefeated(this);
          this.destroy();
        },
      });
    });
  }

  // ---- Helpers for patterns -----------------------------------------------------

  protected get cx() {
    return this.body.center.x;
  }

  protected get cy() {
    return this.body.center.y;
  }

  protected angleToPlayer() {
    const p = this.world.player;
    return Angle.Between(this.cx, this.cy, p.body.center.x, p.body.center.y);
  }

  protected distToPlayer() {
    const p = this.world.player;
    return Distance.Between(this.cx, this.cy, p.body.center.x, p.body.center.y);
  }

  protected ring(count: number, speed: number, frame: string, offset = 0, damage = this.boss.atk * 0.75, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      this.world.fireEnemyShot(this.cx, this.cy, a, speed, frame, damage, opts);
    }
    sfx('shoot');
  }

  protected fan(count: number, spread: number, speed: number, frame: string, damage = this.boss.atk * 0.75, opts = {}) {
    const base = this.angleToPlayer();
    for (let i = 0; i < count; i++) {
      const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
      this.world.fireEnemyShot(this.cx, this.cy, a, speed, frame, damage, opts);
    }
    sfx('shoot');
  }

  protected randomArenaPoint(margin = 24): { x: number; y: number } {
    const r = this.world.arenaBounds;
    if (!r) return { x: this.home.x, y: this.home.y };
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(r.x + margin, r.right - margin);
      const y = Phaser.Math.Between(r.y + margin, r.bottom - margin);
      if (!this.world.level.isBlockedAt(x, y)) return { x, y };
    }
    return { x: this.home.x, y: this.home.y };
  }

  protected countAlive(kind: string) {
    return this.world.enemies.getChildren().filter((e) => (e as Enemy).def.kind === kind && !(e as Enemy).dead).length;
  }

  protected summon(kind: string, count: number, max: number) {
    const alive = this.countAlive(kind);
    for (let i = 0; i < Math.min(count, max - alive); i++) {
      const p = this.randomArenaPoint(32);
      this.world.fx.smoke(p.x, p.y, 8);
      this.world.fx.burst(p.x, p.y, [0x4b2e75, 0xa070e0], 10, 40);
      this.world.time.delayedCall(250, () => {
        if (!this.dead) this.world.spawnEnemy(kind, p.x, p.y);
      });
    }
  }

  /** Telegraphed circles that erupt after `ms`. */
  protected eruptions(points: { x: number; y: number }[], radius: number, ms: number, damage: number, colors: number[]) {
    for (const p of points) {
      this.world.fx.warnCircle(p.x, p.y, radius, ms);
      this.world.time.delayedCall(ms, () => {
        if (this.dead) return;
        this.world.fx.burst(p.x, p.y, colors, 14, 60);
        this.world.fx.smoke(p.x, p.y, 4);
        this.world.hazard(p.x, p.y, radius, damage);
      });
    }
    this.world.time.delayedCall(ms, () => !this.dead && sfx('slam'));
  }

  protected teleport(to: { x: number; y: number }, onDone?: () => void) {
    this.body.enable = false;
    this.world.fx.burst(this.cx, this.cy, [0xa070e0, 0x6fd0f0], 14, 50);
    this.world.tweens.add({
      targets: this,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        if (this.dead) return;
        this.setPosition(to.x, to.y);
        this.body.enable = true;
        this.body.reset(to.x, to.y);
        this.world.tweens.add({ targets: this, alpha: 1, duration: 260, onComplete: () => onDone?.() });
      },
    });
  }
}

// ---- The Thornmother ------------------------------------------------------------

class Thornmother extends Boss {
  private nextBurrow = 0;

  protected fight(time: number) {
    this.setVelocity(0, 0);
    if (time < this.busyUntil) return;
    const p2 = this.phase === 2;
    if (p2 && time > this.nextBurrow) {
      this.nextBurrow = time + 9000;
      this.busyUntil = time + 1600;
      this.teleport(this.randomArenaPoint(40));
      return;
    }
    const pattern = this.step++ % 5;
    switch (pattern) {
      case 0:
        this.ring(p2 ? 14 : 10, 68, 'orb_spore', Math.random(), this.boss.atk * 0.75, { light: 0xff8080 });
        if (p2) this.world.time.delayedCall(320, () => !this.dead && this.ring(14, 68, 'orb_spore', Math.random() + 0.2, this.boss.atk * 0.75, { light: 0xff8080 }));
        this.busyUntil = time + (p2 ? 1500 : 1900);
        break;
      case 1:
        this.fan(p2 ? 5 : 3, 0.6, 125, 'thorn');
        this.world.time.delayedCall(350, () => !this.dead && this.fan(p2 ? 5 : 3, 0.6, 125, 'thorn'));
        this.busyUntil = time + 1500;
        break;
      case 2: {
        const p = this.world.player;
        const pts = [{ x: p.x, y: p.feetY - 3 }];
        for (let i = 0; i < (p2 ? 4 : 2); i++) pts.push({ x: p.x + Phaser.Math.Between(-36, 36), y: p.feetY + Phaser.Math.Between(-28, 28) });
        this.eruptions(pts, 13, p2 ? 650 : 800, this.boss.atk * 1.2, [0x6dbb4f, 0x3a7a35, 0xd64545]);
        this.busyUntil = time + 1700;
        break;
      }
      case 3:
        this.summon('thornling', 2, p2 ? 4 : 3);
        this.busyUntil = time + 1400;
        break;
      case 4:
        this.ring(p2 ? 16 : 12, 55, 'thorn', 0, this.boss.atk * 0.7);
        this.busyUntil = time + 1600;
        break;
    }
  }

  protected onPhaseTwo() {
    ui.banner('The Thornmother', 'Her roots tear free of the earth!');
    this.world.fx.shake(400, 0.008);
    sfx('roar');
  }
}

// ---- The Rustbound Colossus ----------------------------------------------------

class Colossus extends Boss {
  private chargeVec = { x: 0, y: 0 };
  private mode2: 'walk' | 'windup' | 'charge' | 'stunned' | 'slam' = 'walk';
  private modeEnds = 0;

  protected fight(time: number) {
    const p2 = this.phase === 2;
    switch (this.mode2) {
      case 'charge':
        this.setVelocity(this.chargeVec.x * 230, this.chargeVec.y * 230);
        if (!this.body.blocked.none) {
          sfx('slam');
          this.world.fx.shake(350, 0.012);
          this.world.fx.burst(this.cx, this.cy, [0xa0683a, 0x6a4024, 0xd8b080], 20, 70);
          this.setVelocity(0, 0);
          this.mode2 = 'stunned';
          this.modeEnds = time + 2300;
          this.vulnerable = true;
          this.setTint(0x9aa0ff);
          ui.toast('The Colossus is stunned!', 'info');
          if (p2) this.ring(10, 80, 'orb_rock', 0, this.boss.atk * 0.6);
        } else if (time > this.modeEnds) {
          this.setVelocity(0, 0);
          this.mode2 = 'walk';
          this.busyUntil = time + 700;
        }
        return;
      case 'stunned':
        this.setVelocity(0, 0);
        if (Math.floor(time / 200) % 2) this.world.fx.burst(this.cx, this.y - 18, 0xffd56b, 1, 15, 'spark');
        if (time > this.modeEnds) {
          this.vulnerable = false;
          this.clearTint();
          this.mode2 = 'walk';
          this.busyUntil = time + 500;
        }
        return;
      case 'windup':
      case 'slam':
        this.setVelocity(0, 0);
        return;
    }
    // Walking towards the player.
    const a = this.angleToPlayer();
    const d = this.distToPlayer();
    if (d > 26) this.setVelocity(Math.cos(a) * (p2 ? 34 : 26), Math.sin(a) * (p2 ? 34 : 26));
    else this.setVelocity(0, 0);
    this.setFlipX(Math.cos(a) < 0);
    if (time < this.busyUntil) return;

    const choice = d < 54 ? 'slam' : this.step++ % 2 === 0 ? 'charge' : 'rocks';
    if (choice === 'slam') {
      this.mode2 = 'slam';
      this.setTint(0xffb070);
      this.world.fx.warnCircle(this.cx, this.feetY - 4, 54, 650);
      this.world.tweens.add({ targets: this, y: this.y - 5, duration: 600, ease: 'Quad.easeOut' });
      this.world.time.delayedCall(650, () => {
        if (this.dead) return;
        this.y += 5;
        this.clearTint();
        sfx('slam');
        this.world.fx.shake(300, 0.012);
        this.world.fx.ring(this.cx, this.feetY - 4, 56, 0xd8b080, 300);
        this.world.fx.burst(this.cx, this.feetY, [0xa0683a, 0xd8b080], 18, 70);
        this.world.hazard(this.cx, this.feetY - 4, 54, this.boss.atk);
        if (p2) this.ring(8, 90, 'orb_rock', Math.random(), this.boss.atk * 0.6);
        this.mode2 = 'walk';
        this.busyUntil = this.world.time.now + (p2 ? 900 : 1300);
      });
    } else if (choice === 'charge') {
      this.mode2 = 'windup';
      const ang = this.angleToPlayer();
      this.chargeVec = { x: Math.cos(ang), y: Math.sin(ang) };
      this.world.fx.warnLine(this.cx, this.cy, ang, 220, 22, 700);
      this.setTint(0xff8060);
      this.world.time.delayedCall(700, () => {
        if (this.dead) return;
        this.clearTint();
        this.mode2 = 'charge';
        this.modeEnds = this.world.time.now + 1500;
        sfx('dash');
      });
    } else {
      const p = this.world.player;
      const pts = [{ x: p.x, y: p.feetY - 3 }];
      for (let i = 0; i < (p2 ? 6 : 3); i++) pts.push({ x: p.x + Phaser.Math.Between(-60, 60), y: p.feetY + Phaser.Math.Between(-48, 48) });
      this.eruptions(pts, 12, 900, this.boss.atk * 0.8, [0xa0683a, 0x6a4024, 0x8a8c96]);
      this.busyUntil = time + 1600;
    }
  }

  protected onPhaseTwo() {
    ui.banner('The Rustbound Colossus', 'Its core blazes white-hot!');
    sfx('roar');
    this.world.fx.shake(400, 0.01);
  }
}

// ---- The Drowned Abbess --------------------------------------------------------

class Abbess extends Boss {
  private nextTeleport = 0;
  private spiralUntil = 0;
  private spiralAngle = 0;
  private lastSpiralShot = 0;

  protected fight(time: number) {
    const p2 = this.phase === 2;
    // Drift in a slow figure-eight around home.
    const tx = this.home.x + Math.sin(this.age * 0.6) * 60;
    const ty = this.home.y + Math.sin(this.age * 1.2) * 18;
    this.setVelocity((tx - this.x) * 1.4, (ty - this.y) * 1.4);
    this.setAlpha(0.88 + Math.sin(this.age * 3) * 0.1);

    if (time < this.spiralUntil) {
      if (time - this.lastSpiralShot > (p2 ? 95 : 120)) {
        this.lastSpiralShot = time;
        this.spiralAngle += 0.36;
        const arms = p2 ? 3 : 2;
        for (let i = 0; i < arms; i++) this.world.fireEnemyShot(this.cx, this.cy, this.spiralAngle + (i * Math.PI * 2) / arms, 70, 'orb_tide', this.boss.atk * 0.7, { light: 0x6fd0f0 });
        if (Math.random() < 0.3) sfx('shoot');
      }
      return;
    }
    if (time < this.busyUntil) return;
    if (time > this.nextTeleport) {
      this.nextTeleport = time + (p2 ? 5500 : 8000);
      this.busyUntil = time + 1000;
      const to = this.randomArenaPoint(40);
      this.teleport(to, () => {
        this.home.set(this.x, this.y);
        this.ring(p2 ? 12 : 8, 80, 'orb_tide', Math.random(), this.boss.atk * 0.7, { light: 0x6fd0f0 });
      });
      return;
    }
    switch (this.step++ % 4) {
      case 0:
        this.spiralUntil = time + (p2 ? 2600 : 2200);
        this.busyUntil = this.spiralUntil + 700;
        break;
      case 1: {
        const waves = p2 ? 3 : 2;
        for (let w = 0; w < waves; w++) {
          this.world.time.delayedCall(w * 380, () => !this.dead && this.ring(16, 75, 'orb_tide', w * 0.2, this.boss.atk * 0.7, { light: 0x6fd0f0 }));
        }
        this.busyUntil = time + 1500 + waves * 300;
        break;
      }
      case 2:
        for (let i = 0; i < (p2 ? 7 : 5); i++) {
          this.world.time.delayedCall(i * 110, () => !this.dead && this.fan(1, 0, 150, 'orb_tide', this.boss.atk * 0.8, { light: 0x6fd0f0 }));
        }
        this.busyUntil = time + 1500;
        break;
      case 3:
        this.summon('wisp', 2, p2 ? 4 : 3);
        this.busyUntil = time + 1200;
        break;
    }
  }

  protected onPhaseTwo() {
    ui.banner('The Drowned Abbess', 'Her hymn rises to a scream!');
    sfx('roar');
    this.world.level.lighting.setDarkness(Math.min(0.75, this.world.level.lighting.level + 0.3));
  }
}

// ---- The Hollow King ------------------------------------------------------------

class HollowKing extends Boss {
  private mode2: 'walk' | 'busy' | 'dash' = 'walk';
  private dashVec = { x: 0, y: 0 };
  private modeEnds = 0;
  private nextSummon = 0;

  protected fight(time: number) {
    const p2 = this.phase === 2;
    if (this.mode2 === 'dash') {
      this.setVelocity(this.dashVec.x * 270, this.dashVec.y * 270);
      if (time % 40 < 17) this.world.fx.afterimage(this, 0xa070e0);
      if (time > this.modeEnds || !this.body.blocked.none) {
        this.setVelocity(0, 0);
        this.mode2 = 'walk';
        this.busyUntil = time + 600;
        if (p2) this.ring(12, 85, 'orb_gloam', Math.random(), this.boss.atk * 0.65, { light: 0xa070e0 });
      }
      return;
    }
    if (this.mode2 === 'busy') {
      this.setVelocity(0, 0);
      return;
    }
    const a = this.angleToPlayer();
    const d = this.distToPlayer();
    const sp = p2 ? 46 : 34;
    if (d > 30) this.setVelocity(Math.cos(a) * sp, Math.sin(a) * sp);
    else this.setVelocity(0, 0);
    this.setFlipX(Math.cos(a) < 0);
    if (time < this.busyUntil) return;

    if (time > this.nextSummon) {
      this.nextSummon = time + 16000;
      this.summon('shade', p2 ? 2 : 1, 2);
      this.busyUntil = time + 900;
      return;
    }
    const pick = d < 48 ? 'sweep' : (['fan', 'dash', p2 ? 'nova' : 'fan', 'dash'] as const)[this.step++ % 4];
    switch (pick) {
      case 'sweep': {
        this.mode2 = 'busy';
        const ang = a;
        const hx = this.cx + Math.cos(ang) * 22;
        const hy = this.cy + Math.sin(ang) * 22;
        this.world.fx.warnCircle(hx, hy, 34, 480, 0xa070e0);
        this.setTint(0xc0a0ff);
        this.world.time.delayedCall(480, () => {
          if (this.dead) return;
          this.clearTint();
          sfx('swing');
          sfx('slam');
          const s = this.world.add.sprite(this.cx, this.cy, ATLAS, 'slash_1').setOrigin(6 / 32, 0.5).setRotation(ang).setScale(2.2).setTint(0xc0a0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 1);
          this.world.tweens.add({ targets: s, alpha: 0, duration: 260, onComplete: () => s.destroy() });
          this.world.fx.shake(200, 0.008);
          this.world.hazard(hx, hy, 34, this.boss.atk);
          this.mode2 = 'walk';
          this.busyUntil = this.world.time.now + (p2 ? 700 : 1000);
        });
        break;
      }
      case 'fan':
        this.fan(p2 ? 7 : 5, 0.9, 95, 'orb_gloam', this.boss.atk * 0.7, { light: 0xa070e0, homing: p2 ? 1.1 : 0 });
        this.busyUntil = time + (p2 ? 1100 : 1500);
        break;
      case 'dash': {
        this.mode2 = 'busy';
        const ang = a;
        this.dashVec = { x: Math.cos(ang), y: Math.sin(ang) };
        this.world.fx.warnLine(this.cx, this.cy, ang, 140, 20, 600, 0xa070e0);
        this.world.time.delayedCall(600, () => {
          if (this.dead) return;
          sfx('dash');
          this.mode2 = 'dash';
          this.modeEnds = this.world.time.now + 480;
        });
        break;
      }
      case 'nova':
        for (let w = 0; w < 3; w++) {
          this.world.time.delayedCall(w * 300, () => !this.dead && this.ring(20, 70, 'orb_gloam', w * 0.15, this.boss.atk * 0.6, { light: 0xa070e0 }));
        }
        this.busyUntil = time + 1800;
        break;
    }
  }

  protected onPhaseTwo() {
    ui.banner('The Hollow King', '"I carried that light once. Let me show you what it cost."');
    sfx('roar');
    this.world.fx.shake(600, 0.01);
    this.world.level.lighting.setDarkness(0.9);
    this.setScale(1.15);
  }
}

export function createBoss(world: World, id: BossId, x: number, y: number): Boss {
  switch (id) {
    case 'thornmother':
      return new Thornmother(world, x, y, id);
    case 'colossus':
      return new Colossus(world, x, y, id);
    case 'abbess':
      return new Abbess(world, x, y, id);
    case 'hollow_king':
      return new HollowKing(world, x, y, id);
  }
}
