import Phaser from 'phaser';
import { QUICK_ITEMS } from '../../data/items';
import { game } from '../../state/gameStore';
import { mitigate } from '../../state/progression';
import type { Facing } from '../../state/types';
import { ui } from '../../state/uiStore';
import { sfx } from '../audio';
import type { Controls } from '../input';
import { ATLAS } from '../textures';
import type { World } from '../world/types';
import type { Enemy } from './Enemy';

const BASE_SPEED = 82;
const ATTACK_MS = 210;
const ATTACK_COOLDOWN = 290;
const DASH_MS = 165;
const DASH_SPEED = 300;
const DASH_COOLDOWN = 650;
const BOLT_COST = 4;
const BOLT_COOLDOWN = 420;
const RADIANCE_COST = 12;
const RADIANCE_COOLDOWN = 4000;
const RADIANCE_RADIUS = 64;
const HURT_INVULN = 900;

export const FACING_VEC: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

type State = 'normal' | 'attack' | 'dash' | 'hurt' | 'dead' | 'frozen';

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  facing: Facing = 'down';
  state: State = 'normal';
  private world: World;
  private controls: Controls;
  private shadow: Phaser.GameObjects.Image;
  private invulnUntil = 0;
  private stateUntil = 0;
  private attackReadyAt = 0;
  private dashReadyAt = 0;
  private boltReadyAt = 0;
  private radianceReadyAt = 0;
  private swingHits = new Set<Enemy>();
  private swingCombo = 0;
  private lastSwingAt = 0;
  private dashVec = { x: 0, y: 0 };
  private lastAfterimage = 0;
  private mpTimer = 0;
  private lastSafe = { x: 0, y: 0 };
  private knock = { x: 0, y: 0 };
  private dustTimer = 0;

  constructor(world: World, x: number, y: number, facing: Facing, controls: Controls) {
    super(world, x, y, ATLAS, 'player_down_idle');
    this.world = world;
    this.controls = controls;
    world.add.existing(this);
    world.physics.add.existing(this);
    this.body.setSize(10, 7).setOffset(3, 9);
    this.setCollideWorldBounds(true);
    this.shadow = world.add.image(x, y + 7, ATLAS, 'shadow').setDepth(-5000);
    this.lastSafe = { x, y };
    this.face(facing);
  }

  get feetY() {
    return this.body.bottom;
  }

  get isDashing() {
    return this.state === 'dash';
  }

  get isInvulnerable() {
    return this.state === 'dash' || this.state === 'dead' || this.world.time.now < this.invulnUntil;
  }

  /** Point in front of the player, used for interaction. */
  reachPoint(dist = 12) {
    const v = FACING_VEC[this.facing];
    return { x: this.body.center.x + v.x * dist, y: this.body.center.y + v.y * dist };
  }

  face(f: Facing) {
    this.facing = f;
    this.setFlipX(f === 'left');
    this.play(`player_idle_${this.dirKey()}`, true);
  }

  freeze(on: boolean) {
    if (this.state === 'dead') return;
    this.state = on ? 'frozen' : 'normal';
    if (on) this.setVelocity(0, 0);
  }

  private dirKey() {
    return this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
  }

  cooldowns() {
    const now = this.world.time.now;
    const frac = (readyAt: number, total: number) => Math.max(0, Math.min(1, (readyAt - now) / total));
    return {
      bolt: frac(this.boltReadyAt, BOLT_COOLDOWN),
      dash: frac(this.dashReadyAt, DASH_COOLDOWN),
      radiance: frac(this.radianceReadyAt, RADIANCE_COOLDOWN),
    };
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;
    this.setDepth(this.feetY);
    this.shadow.setPosition(this.x, this.feetY - 1);
    if (this.state === 'dead' || this.state === 'frozen') {
      if (this.state === 'frozen') this.setVelocity(0, 0);
      return;
    }

    // Blink while invulnerable.
    this.setAlpha(time < this.invulnUntil && this.state !== 'dash' ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1);

    this.regenMana(delta);
    this.handleQuickItems();

    if (this.state === 'hurt') {
      this.setVelocity(this.knock.x, this.knock.y);
      this.knock.x *= 0.86;
      this.knock.y *= 0.86;
      if (time >= this.stateUntil) this.state = 'normal';
      return;
    }

    if (this.state === 'dash') {
      this.setVelocity(this.dashVec.x * DASH_SPEED, this.dashVec.y * DASH_SPEED);
      if (time - this.lastAfterimage > 28) {
        this.lastAfterimage = time;
        this.world.fx.afterimage(this);
      }
      if (time >= this.stateUntil) this.endDash();
      return;
    }

    if (this.state === 'attack') {
      this.checkSwingHits();
      const slow = 0.25;
      const ax = this.controls.axis();
      this.setVelocity(ax.x * BASE_SPEED * slow, ax.y * BASE_SPEED * slow);
      if (time >= this.stateUntil) {
        this.state = 'normal';
        this.play(`player_idle_${this.dirKey()}`, true);
      }
      return;
    }

    // Normal state: abilities first, then movement.
    const d = game.data;
    if (this.controls.pressed('attack') && time >= this.attackReadyAt) return this.startAttack(time);
    if (this.controls.pressed('dash')) {
      if (!d.abilities.dash) this.lockedAbility('dash');
      else if (time >= this.dashReadyAt) return this.startDash(time);
    }
    if (this.controls.pressed('bolt')) {
      if (!d.abilities.bolt) this.lockedAbility('bolt');
      else if (time >= this.boltReadyAt) this.castBolt(time);
    }
    if (this.controls.pressed('radiance')) {
      if (!d.abilities.radiance) this.lockedAbility('radiance');
      else if (time >= this.radianceReadyAt) this.castRadiance(time);
    }

    const ax = this.controls.axis();
    const speed = BASE_SPEED * game.stats().speed;
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y);
      // The touch stick is analogue; keys are always full speed.
      const mag = ax.analog ? Math.min(1, len) : 1;
      this.setVelocity((ax.x / len) * speed * mag, (ax.y / len) * speed * mag);
      let f: Facing = this.facing;
      if (ax.analog) f = Math.abs(ax.x) > Math.abs(ax.y) ? (ax.x > 0 ? 'right' : 'left') : ax.y > 0 ? 'down' : 'up';
      else if (ax.x !== 0 && ax.y === 0) f = ax.x > 0 ? 'right' : 'left';
      else if (ax.y !== 0 && ax.x === 0) f = ax.y > 0 ? 'down' : 'up';
      else {
        // Diagonal: keep the current facing if it's one of the two, else prefer vertical.
        const h: Facing = ax.x > 0 ? 'right' : 'left';
        const v: Facing = ax.y > 0 ? 'down' : 'up';
        if (this.facing !== h && this.facing !== v) f = v;
      }
      if (f !== this.facing) {
        this.facing = f;
        this.setFlipX(f === 'left');
      }
      this.play(`player_walk_${this.dirKey()}`, true);
      this.dustTimer += delta;
      if (this.dustTimer > 260) {
        this.dustTimer = 0;
        const t = this.world.level.map.def.theme;
        if (t !== 'rift' && t !== 'mine') this.world.fx.burst(this.x, this.feetY, 0xd8c8a0, 2, 12);
      }
    } else {
      this.setVelocity(0, 0);
      this.play(`player_idle_${this.dirKey()}`, true);
    }

    if (!this.world.level.isGapAt(this.body.center.x, this.body.center.y)) {
      this.lastSafe.x = this.x;
      this.lastSafe.y = this.y;
    }
    void dt;
  }

  private lockedAbility(id: 'bolt' | 'dash' | 'radiance') {
    const names = { bolt: 'Ember Bolt', dash: 'Ember Dash', radiance: 'Radiance' };
    ui.toast(`${names[id]} is not yet awakened.`, 'warn');
    sfx('deny');
  }

  private regenMana(delta: number) {
    this.mpTimer += delta * game.stats().mpRegen;
    if (this.mpTimer >= 1800) {
      this.mpTimer = 0;
      if (game.data.abilities.bolt) game.restoreMp(1);
    }
  }

  private handleQuickItems() {
    const actions = ['potion1', 'potion2', 'potion3', 'potion4'] as const;
    actions.forEach((a, i) => {
      if (!this.controls.pressed(a)) return;
      const id = QUICK_ITEMS[i];
      if (game.useItem(id)) {
        sfx('heal');
        this.world.fx.glow(this.x, this.y, id === 'tonic' ? 0x6fb0ff : id === 'elixir' ? 0xffd56b : 0x8aff8a, 12);
      } else {
        sfx('deny');
        if (!game.has(id)) ui.toast('None left!', 'warn');
      }
    });
  }

  private startAttack(time: number) {
    this.state = 'attack';
    this.stateUntil = time + ATTACK_MS;
    this.attackReadyAt = time + ATTACK_COOLDOWN;
    this.swingHits.clear();
    this.swingCombo = time - this.lastSwingAt < 520 ? (this.swingCombo + 1) % 3 : 0;
    this.lastSwingAt = time;
    this.setVelocity(0, 0);
    this.play(`player_walk_${this.dirKey()}`, true);
    this.anims.pause(this.anims.currentAnim!.frames[0]);
    sfx('swing');

    const v = FACING_VEC[this.facing];
    const angle = Math.atan2(v.y, v.x);
    const cx = this.body.center.x;
    const cy = this.body.center.y - 2;
    const slash = this.world.add
      .sprite(cx, cy, ATLAS, 'slash_0')
      .setOrigin(6 / 32, 0.5)
      .setRotation(angle)
      .setDepth(this.depth + (this.facing === 'up' ? -1 : 1))
      .setBlendMode(Phaser.BlendModes.ADD);
    // Alternate the swing direction for combos.
    if (this.swingCombo === 1) slash.setFlipY(true);
    let f = 0;
    this.world.time.addEvent({
      delay: 55,
      repeat: 2,
      callback: () => {
        f++;
        if (f < 3) slash.setFrame(`slash_${f}`);
        else slash.destroy();
      },
    });
    this.world.time.delayedCall(240, () => slash.active && slash.destroy());
    this.checkSwingHits();
  }

  private swingRect(): Phaser.Geom.Rectangle {
    const v = FACING_VEC[this.facing];
    const cx = this.body.center.x + v.x * 12;
    const cy = this.body.center.y - 2 + v.y * 12;
    const w = v.x !== 0 ? 22 : 30;
    const h = v.x !== 0 ? 28 : 22;
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  }

  private checkSwingHits() {
    const rect = this.swingRect();
    const atk = game.stats().atk;
    const power = atk * (this.swingCombo === 2 ? 1.3 : 1);
    for (const obj of this.world.enemies.getChildren()) {
      const e = obj as Enemy;
      if (!e.active || e.dead || this.swingHits.has(e)) continue;
      const b = e.body as Phaser.Physics.Arcade.Body;
      const er = new Phaser.Geom.Rectangle(b.x - 2, b.y - 4, b.width + 4, b.height + 6);
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, er)) {
        this.swingHits.add(e);
        this.world.hitEnemy(e, power, this.body.center.x, this.body.center.y, this.swingCombo === 2 ? 1.5 : 1);
      }
    }
    this.world.clearEnemyShots(rect.centerX, rect.centerY, 13);
  }

  private startDash(time: number) {
    const ax = this.controls.axis();
    let vx = ax.x;
    let vy = ax.y;
    if (vx === 0 && vy === 0) {
      vx = FACING_VEC[this.facing].x;
      vy = FACING_VEC[this.facing].y;
    }
    const len = Math.hypot(vx, vy);
    this.dashVec = { x: vx / len, y: vy / len };
    this.state = 'dash';
    this.stateUntil = time + DASH_MS;
    this.dashReadyAt = time + DASH_COOLDOWN;
    this.lastAfterimage = 0;
    sfx('dash');
    this.world.fx.burst(this.x, this.feetY, 0xffb040, 6, 30);
  }

  private endDash() {
    this.state = 'normal';
    this.invulnUntil = Math.max(this.invulnUntil, this.world.time.now + 60);
    if (this.world.level.isGapAt(this.body.center.x, this.body.center.y)) this.fall();
  }

  private fall() {
    sfx('fall');
    const dmg = Math.max(1, Math.round(game.stats().maxHp * 0.1));
    this.state = 'frozen';
    this.setVelocity(0, 0);
    this.world.tweens.add({
      targets: this,
      scale: 0.1,
      angle: 200,
      duration: 380,
      onComplete: () => {
        this.setScale(1).setAngle(0);
        this.setPosition(this.lastSafe.x, this.lastSafe.y);
        this.state = 'normal';
        this.invulnUntil = this.world.time.now + HURT_INVULN;
        const hp = game.damage(dmg);
        this.world.fx.number(this.x, this.y - 8, `${dmg}`, '#ff6a6a');
        ui.hurt();
        if (hp <= 0) this.die();
      },
    });
  }

  private castBolt(time: number) {
    if (!game.spendMp(BOLT_COST)) {
      sfx('deny');
      ui.toast('Not enough MP.', 'warn');
      return;
    }
    this.boltReadyAt = time + BOLT_COOLDOWN;
    const v = FACING_VEC[this.facing];
    const atk = game.stats().atk;
    this.world.fireBolt(this.body.center.x + v.x * 6, this.body.center.y - 3 + v.y * 6, Math.atan2(v.y, v.x), Math.round(atk * 0.7 + 6));
    sfx('bolt');
  }

  private castRadiance(time: number) {
    if (!game.spendMp(RADIANCE_COST)) {
      sfx('deny');
      ui.toast('Not enough MP.', 'warn');
      return;
    }
    this.radianceReadyAt = time + RADIANCE_COOLDOWN;
    sfx('radiance');
    const cx = this.body.center.x;
    const cy = this.body.center.y;
    this.world.fx.ring(cx, cy, RADIANCE_RADIUS, 0xffd56b, 420);
    this.world.fx.ring(cx, cy, RADIANCE_RADIUS * 0.6, 0xfff3b0, 300);
    this.world.fx.glow(cx, cy, [0xffd56b, 0xfff3b0], 24, 70);
    this.world.fx.shake(150, 0.004);
    this.world.dynamicLights.push({ x: cx, y: cy, radius: 140, color: 0xffe0a0, intensity: 1.5 });
    this.world.time.delayedCall(250, () => this.world.dynamicLights.pop());
    const dmg = Math.round(game.stats().atk * 1.5 + 15);
    for (const obj of this.world.enemies.getChildren()) {
      const e = obj as Enemy;
      if (!e.active || e.dead) continue;
      if (Phaser.Math.Distance.Between(cx, cy, e.x, e.y) <= RADIANCE_RADIUS + 8) this.world.hitEnemy(e, dmg, cx, cy, 2);
    }
    this.world.clearEnemyShots(cx, cy, RADIANCE_RADIUS + 12);
    this.invulnUntil = Math.max(this.invulnUntil, time + 250);
  }

  hurt(amount: number, fromX: number, fromY: number) {
    if (this.isInvulnerable) return;
    const dmg = mitigate(amount, game.stats().def);
    const hp = game.damage(dmg);
    sfx('hurt');
    ui.hurt();
    this.world.fx.number(this.x, this.y - 8, `${dmg}`, '#ff6a6a');
    this.world.fx.flash(this, 0xff5050, 110);
    this.world.fx.shake(110, 0.005);
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.knock = { x: Math.cos(a) * 170, y: Math.sin(a) * 170 };
    this.state = 'hurt';
    this.stateUntil = this.world.time.now + 160;
    this.invulnUntil = this.world.time.now + HURT_INVULN;
    if (hp <= 0) this.die();
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.setVelocity(0, 0);
    this.body.enable = false;
    sfx('death');
    this.play(`player_idle_down`);
    this.world.tweens.add({ targets: this, angle: 90, alpha: 0.5, duration: 600, ease: 'Bounce.easeOut' });
    this.world.fx.burst(this.x, this.y, [0xb8433b, 0x1a1423], 16, 50);
    this.world.time.delayedCall(1100, () => ui.open('gameover'));
  }

  destroy(fromScene?: boolean) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
