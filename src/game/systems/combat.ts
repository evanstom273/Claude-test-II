import Phaser from 'phaser';
import { WEAPONS } from '../../data/weapons';
import { game } from '../../state/gameStore';
import { ui } from '../../state/uiStore';
import type { WeaponId } from '../../state/types';
import { sfx } from '../audio';
import { B, blockedPx } from '../city/tiles';
import type { Actor } from '../entities/Actor';
import type { Car } from '../entities/Car';
import type { CityScene } from '../scenes/CityScene';
import { ATLAS } from '../textures';

export interface Pickup {
  kind: 'cash' | 'weapon' | 'health' | 'package';
  x: number;
  y: number;
  amount: number;
  weapon?: WeaponId;
  sprite: Phaser.GameObjects.Image;
  expireAt: number;
}

/** Volume for a sound at a world point, from how far it is from the camera. */
export function distVol(w: CityScene, x: number, y: number, range = 320) {
  const v = w.cameras.main.midPoint;
  return Math.max(0, 1 - Math.hypot(x - v.x, y - v.y) / range);
}

const angleDiff = (a: number, b: number) => Math.abs(Phaser.Math.Angle.Wrap(a - b));

/** Swing or shoot. Returns false if the weapon wasn't ready or was empty. */
export function attack(w: CityScene, a: Actor, angle: number): boolean {
  if (a.dead || a.car) return false;
  const spec = WEAPONS[a.weapon];
  if (w.now < a.attackReadyAt) return false;
  a.attackReadyAt = w.now + 1000 / spec.rate;
  a.aim = angle;
  a.faceAngle(angle);
  if (spec.melee) {
    melee(w, a, angle);
    return true;
  }
  if (a.role === 'player' && !game.useAmmo()) {
    sfx('empty');
    return false;
  }
  shoot(w, a, angle);
  return true;
}

function melee(w: CityScene, a: Actor, angle: number) {
  const spec = WEAPONS[a.weapon];
  a.swingUntil = w.now + 220;
  sfx('swing', distVol(w, a.x, a.y));
  const reach = spec.range + 5;
  const hits = w.actors
    .filter((o) => o !== a && !o.dead && !o.car && Math.hypot(o.x - a.x, o.cy - a.cy) <= reach && angleDiff(Math.atan2(o.cy - a.cy, o.x - a.x), angle) < 1.1)
    .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))
    .slice(0, a.weapon === 'bat' ? 2 : 1);
  for (const o of hits) {
    sfx('punch', distVol(w, o.x, o.y));
    w.hurtActor(o, spec.damage * (0.85 + Math.random() * 0.3), a.x, a.y, a, spec.knock);
  }
  if (!hits.length) {
    for (const c of w.cars) {
      if (c.wrecked) continue;
      const near = c.circles().some(([cx, cy, r]) => Math.hypot(cx - a.x, cy - a.cy) < r + spec.range);
      if (near) {
        sfx('bump', distVol(w, c.x, c.y));
        w.hurtCar(c, a.weapon === 'bat' ? 5 : 1, a);
        break;
      }
    }
  }
}

function shoot(w: CityScene, a: Actor, angle: number) {
  const spec = WEAPONS[a.weapon];
  const mx = a.x + Math.cos(angle) * 8;
  const my = a.cy - 1 + Math.sin(angle) * 8;
  w.fx.muzzle(mx, my, angle);
  sfx(a.weapon as 'pistol' | 'smg' | 'shotgun', distVol(w, a.x, a.y, 420));
  w.flashLight(mx, my, 0xffd84f, 46);
  w.crime('gunfire', a, a.x, a.y, undefined, spec.noise);
  const near = w.actors.filter((o) => o !== a && !o.dead && !o.car && Math.hypot(o.x - a.x, o.y - a.y) < spec.range + 12);
  const cars = w.cars.filter((c) => Math.hypot(c.x - a.x, c.y - a.y) < spec.range + 20);
  for (let p = 0; p < spec.pellets; p++) {
    const ang = angle + (Math.random() * 2 - 1) * spec.spread;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let hit: { x: number; y: number; actor?: Actor; car?: Car } | null = null;
    for (let d = 4; d < spec.range && !hit; d += 3) {
      const x = mx + dx * d;
      const y = my + dy * d;
      if (blockedPx(w.city, x, y, B.SIGHT)) {
        hit = { x, y };
        w.fx.sparks(x - dx * 2, y - dy * 2, 3);
        if (Math.random() < 0.3) sfx('ricochet', distVol(w, x, y));
        break;
      }
      for (const o of near) {
        if (Math.hypot(o.x - x, o.cy - y) < 5.5) {
          hit = { x, y, actor: o };
          break;
        }
      }
      if (hit) break;
      for (const c of cars) {
        if (c.circles().some(([cx, cy, r]) => Math.hypot(cx - x, cy - y) < r)) {
          hit = { x, y, car: c };
          break;
        }
      }
    }
    const end = hit ?? { x: mx + dx * spec.range, y: my + dy * spec.range };
    w.fx.tracer(mx, my, end.x, end.y);
    if (hit?.actor) w.hurtActor(hit.actor, spec.damage * (0.85 + Math.random() * 0.3), a.x, a.y, a, spec.knock);
    if (hit?.car) {
      w.fx.sparks(hit.x, hit.y, 3);
      w.hurtCar(hit.car, spec.damage * 0.35, a);
    }
  }
}

/** Damage a person. Handles death, drops and who saw it. */
export function hurtActor(w: CityScene, a: Actor, dmg: number, fromX: number, fromY: number, by: Actor | null, knock = 80) {
  if (a.dead) return;
  dmg = Math.round(dmg);
  const ang = Math.atan2(a.y - fromY, a.x - fromX);
  if (!a.car) {
    a.knock.x += Math.cos(ang) * knock;
    a.knock.y += Math.sin(ang) * knock;
    a.stunUntil = w.now + Math.min(260, knock * 1.2);
  }
  w.fx.blood(a.x, a.cy, ang);
  w.fx.flash(a.sprite, 0xff6a6a, 90);
  w.fx.number(a.x, a.y - 16, `${dmg}`, a.role === 'player' ? '#ff6a6a' : '#ffffff');
  if (by && by !== a) {
    const kind = a.role === 'cop' ? 'copAssault' : 'assault';
    w.crime(kind, by, a.x, a.y, a, 0);
  }
  if (a.role === 'player') {
    sfx('hurt');
    ui.hurt();
    w.fx.shake(90, 0.004);
    const hp = game.damage(dmg);
    if (hp <= 0) w.playerDown(by);
    return;
  }
  a.hp -= dmg;
  w.onActorHurt(a, by);
  if (a.hp <= 0) {
    a.die(w, ang);
    sfx('death', distVol(w, a.x, a.y));
    if (by) w.crime('murder', by, a.x, a.y, a, 0);
    if (by?.role === 'player') game.update((d) => d.stats.kills++);
    if (a.wallet > 0) dropPickup(w, 'cash', a.x + 4, a.y, a.wallet);
    if ((a.role === 'gang' || a.role === 'cop') && a.weapon !== 'fists' && Math.random() < 0.5) dropPickup(w, 'weapon', a.x - 4, a.y, 0, a.weapon);
    w.onActorKilled(a, by);
  }
}

export function hurtCar(w: CityScene, c: Car, dmg: number, by: Actor | null) {
  if (c.wrecked) return;
  c.hp -= dmg;
  if (c.hp <= 0 && !c.burning) {
    c.burning = true;
    c.burnUntil = w.now + 3200;
    if (c.driver && c.driver.role === 'player') ui.toast('Your car is on fire. Get out!', 'warn');
    else if (c.driver) w.ejectDriver(c, true);
    if (by) w.crime('assault', by, c.x, c.y, undefined, 0);
  }
}

export function explode(w: CityScene, x: number, y: number, by: Actor | null) {
  w.fx.explosion(x, y);
  w.flashLight(x, y, 0xffa040, 160, 500);
  const scorch = w.add.image(x, y, ATLAS, 'scorch').setDepth(-59000);
  w.decals.push({ obj: scorch, at: w.now });
  w.crime('explosion', by ?? w.player, x, y, undefined, 450);
  for (const a of [...w.actors]) {
    if (a.dead) continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < 44) w.hurtActor(a, 90 * (1 - d / 50), x, y, by, 260);
  }
  for (const c of [...w.cars]) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < 48 && d > 0.5) {
      w.hurtCar(c, 70 * (1 - d / 56), by);
      c.vx += ((c.x - x) / d) * 120;
      c.vy += ((c.y - y) / d) * 120;
    }
  }
}

export function dropPickup(w: CityScene, kind: Pickup['kind'], x: number, y: number, amount: number, weapon?: WeaponId) {
  const frame = kind === 'cash' ? 'cash' : kind === 'health' ? 'burger' : kind === 'package' ? 'package' : (WEAPONS[weapon!].frame ?? 'ammo');
  const sprite = w.add.image(x, y, ATLAS, frame).setOrigin(0.5, 1).setDepth(y - 1);
  if (kind === 'weapon') sprite.setScale(0.5);
  w.tweens.add({ targets: sprite, y: y - 2, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
  w.pickups.push({ kind, x, y, amount, weapon, sprite, expireAt: w.now + 60000 });
}

export function collectPickups(w: CityScene) {
  const p = w.player;
  if (p.dead || p.car) return;
  for (const pk of [...w.pickups]) {
    if (w.now > pk.expireAt) {
      pk.sprite.destroy();
      w.pickups.splice(w.pickups.indexOf(pk), 1);
      continue;
    }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) > 10) continue;
    if (pk.kind === 'cash') {
      game.addCash(pk.amount);
      sfx('cash');
      w.fx.number(pk.x, pk.y - 10, `+$${pk.amount}`, '#8ad06a');
    } else if (pk.kind === 'weapon' && pk.weapon) {
      const spec = WEAPONS[pk.weapon];
      game.giveWeapon(pk.weapon, Math.max(1, Math.round(spec.ammo * 0.5)));
      sfx('pickup');
      ui.toast(`Picked up: ${spec.name}`, 'info');
      w.refreshPlayerWeapon();
    } else if (pk.kind === 'health') {
      game.heal(pk.amount);
      sfx('eat');
    } else if (pk.kind === 'package') {
      w.onPackage();
      sfx('pickup');
    }
    pk.sprite.destroy();
    w.pickups.splice(w.pickups.indexOf(pk), 1);
  }
}
