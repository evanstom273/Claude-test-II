import Phaser from 'phaser';
import { GANGS, type GangId } from '../../data/cast';
import { game } from '../../state/gameStore';
import { B, T, TILE, blockAt, kindAt, lineOfSight } from '../city/tiles';
import type { Actor } from '../entities/Actor';
import type { CityScene } from '../scenes/CityScene';
import type { Crime } from '../world';
import { attack } from './combat';
import { WEAPONS } from '../../data/weapons';

/*
 * Everyone reacts to what they see and hear, Streets of Rogue style.
 * Civilians flee violence and sometimes ring the police. Gang members fight
 * rival gangs on sight and decide about you from your respect with them.
 * Cops go after anyone committing a crime in front of them, you included.
 */

/** Gang rivalries: each gang hates the next one round. */
export const RIVAL: Record<GangId, GangId> = { vipers: 'crowns', crowns: 'rats', rats: 'vipers' };

const WALK = 28;
const RUN = 72;

const gangOf = (a: Actor) => (GANGS as string[]).includes(a.faction) ? (a.faction as GangId) : null;

/** Does this gang member want the player dead on sight? */
export function gangHatesPlayer(g: GangId) {
  return game.data.respect[g] <= -25;
}

function canSee(w: CityScene, a: Actor, x: number, y: number, range: number) {
  return Math.hypot(x - a.x, y - a.y) <= range && lineOfSight(w.city, a.x, a.cy, x, y - 7);
}

/** Walkable ground for an aimless wander. */
function wanderable(w: CityScene, tx: number, ty: number) {
  const k = kindAt(w.city, tx, ty);
  return (k === T.PAVE || k === T.PLAZA || k === T.GRASS || k === T.CONCRETE || k === T.SAND || k === T.PIER) && !(blockAt(w.city, tx, ty) & B.PED);
}

function pickWanderGoal(w: CityScene, a: Actor) {
  const tx0 = Math.floor(a.x / TILE);
  const ty0 = Math.floor(a.y / TILE);
  for (let i = 0; i < 12; i++) {
    const tx = tx0 + Phaser.Math.Between(-6, 6);
    const ty = ty0 + Phaser.Math.Between(-6, 6);
    if (wanderable(w, tx, ty) && lineOfSight(w.city, a.x, a.y - 3, tx * TILE + 8, ty * TILE + 8, B.PED)) return { x: tx * TILE + 8, y: ty * TILE + 12 };
  }
  return null;
}

function moveToward(w: CityScene, a: Actor, x: number, y: number, speed: number) {
  let ang = Math.atan2(y - a.y, x - a.x);
  // Stuck on a wall: sidestep for a moment.
  if (w.now < a.sidestepUntil) ang += a.id % 2 ? 1.4 : -1.4;
  a.walk(ang, speed);
  a.running = speed > 50;
}

/** React to a crime this actor saw or heard. */
export function perceive(w: CityScene, a: Actor, c: Crime) {
  if (c.by === a || a.dead) return;
  const d = Math.hypot(c.x - a.x, c.y - a.y);
  const seen = d < 150 && lineOfSight(w.city, a.x, a.cy, c.x, c.y - 7);
  const heard = d < c.heard;
  if (!seen && !heard) return;
  const byPlayer = c.by.role === 'player';
  const violent = c.kind !== 'robbery';

  if (a.role === 'cop') {
    if (byPlayer && (seen || (heard && c.kind === 'gunfire'))) {
      w.police.witness(c);
    }
    if (seen || c.kind === 'gunfire') engage(w, a, c.by);
    return;
  }
  if (a.role === 'gang') {
    const mine = gangOf(a);
    const victimMate = c.victim && gangOf(c.victim) === mine;
    if (c.victim === a || victimMate || (seen && c.kind === 'gunfire' && gangOf(c.by) === RIVAL[mine!])) engage(w, a, c.by);
    if (byPlayer && (c.victim === a || victimMate) && mine) game.respect(mine, -4);
    return;
  }
  if (a.role === 'staff') {
    if (c.victim === a || (seen && violent)) {
      const armed = a.weapon !== 'fists';
      if (armed || a.tough) engage(w, a, c.by);
      else cower(w, a, c);
    }
    return;
  }
  // Civilians and targets.
  if (c.victim === a && a.tough) {
    engage(w, a, c.by);
    return;
  }
  if (violent && (seen || c.kind === 'gunfire' || c.kind === 'explosion')) {
    flee(w, a, c.x, c.y);
    if (byPlayer && seen && a.reportAt === 0 && Math.random() < 0.45) a.reportAt = w.now + 2200 + Math.random() * 1500;
  }
}

function engage(w: CityScene, a: Actor, t: Actor) {
  if (t === a || t.dead) return;
  if (a.role === 'cop' && t.role === 'cop') return;
  if (a.role === 'gang' && gangOf(a) && gangOf(a) === gangOf(t)) return;
  a.target = t;
  a.state = 'fight';
  a.stateUntil = w.now + 9000;
  if (t.role === 'player') a.hostile = true;
}

function flee(w: CityScene, a: Actor, x: number, y: number) {
  a.state = 'flee';
  a.goal = { x, y };
  a.stateUntil = w.now + 4000 + Math.random() * 3000;
}

function cower(w: CityScene, a: Actor, c: Crime) {
  a.state = 'cower';
  a.stateUntil = w.now + 5000;
  if (c.by.role === 'player' && a.reportAt === 0) a.reportAt = w.now + 2500;
}

/** Look around for fights worth starting. */
function scan(w: CityScene, a: Actor) {
  const p = w.player;
  if (a.role === 'cop') {
    if (w.police.wanted > 0 && !p.dead) {
      const tx = p.car ? p.car.x : p.x;
      const ty = p.car ? p.car.y : p.y;
      if (canSee(w, a, tx, ty, 190)) {
        w.police.seen();
        if (a.target !== p) engage(w, a, p);
        return;
      }
    }
    if (a.state !== 'fight') {
      for (const o of w.actors) {
        if (o === a || o.dead || o.role === 'cop' || w.now - o.lastCrimeAt > 6000) continue;
        if (canSee(w, a, o.x, o.y, 140)) {
          engage(w, a, o);
          break;
        }
      }
    }
    return;
  }
  if (a.role === 'gang' && a.state !== 'fight') {
    const mine = gangOf(a)!;
    if (!p.dead && !p.car && gangHatesPlayer(mine) && canSee(w, a, p.x, p.y, 120)) {
      engage(w, a, p);
      return;
    }
    for (const o of w.actors) {
      if (o.dead || o.car || gangOf(o) !== RIVAL[mine]) continue;
      if (canSee(w, a, o.x, o.y, 110)) {
        engage(w, a, o);
        return;
      }
    }
  }
}

export function updateNpc(w: CityScene, a: Actor, dt: number) {
  if (a.dead || a.car) return;
  const px = a.x;
  const py = a.y;
  if (w.now >= a.thinkAt) {
    a.thinkAt = w.now + 220 + Math.random() * 80;
    for (const c of w.crimes) {
      if (c.id <= a.seenCrime) continue;
      perceive(w, a, c);
    }
    a.seenCrime = w.crimeId;
    scan(w, a);
  }
  // Somebody phones it in.
  if (a.reportAt > 0 && w.now >= a.reportAt) {
    a.reportAt = -1;
    w.police.report(a);
  }

  switch (a.state) {
    case 'fight':
      fight(w, a);
      break;
    case 'flee': {
      if (w.now > a.stateUntil) {
        a.state = 'wander';
        a.goal = null;
        break;
      }
      const g = a.goal ?? { x: a.x, y: a.y };
      const ang = Math.atan2(a.y - g.y, a.x - g.x);
      moveToward(w, a, a.x + Math.cos(ang) * 40, a.y + Math.sin(ang) * 40, RUN);
      break;
    }
    case 'cower':
      a.stop();
      if (w.now > a.stateUntil) a.state = a.post ? 'post' : 'wander';
      break;
    case 'post': {
      if (!a.post) {
        a.state = 'wander';
        break;
      }
      if (Math.hypot(a.post.x - a.x, a.post.y - a.y) > 4) moveToward(w, a, a.post.x, a.post.y, WALK);
      else {
        a.stop();
        a.facing = 'down';
      }
      break;
    }
    case 'goto': {
      if (!a.goal || Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 6) {
        a.state = 'wander';
        a.goal = null;
      } else moveToward(w, a, a.goal.x, a.goal.y, RUN * 0.8);
      break;
    }
    default: {
      if (a.post) {
        a.state = 'post';
        break;
      }
      if (!a.goal || Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 5) {
        if (Math.random() < 0.02 || !a.goal) a.goal = pickWanderGoal(w, a);
        else a.goal = null;
        if (!a.goal) {
          a.stop();
          break;
        }
      }
      moveToward(w, a, a.goal.x, a.goal.y, WALK + (a.id % 7));
    }
  }
  a.step(dt);
  // Not getting anywhere: sidestep (chasing, fleeing) or pick somewhere else (wandering).
  const expected = Math.hypot(a.vx, a.vy) * dt;
  if (a.moving && expected > 0.2 && Math.hypot(a.x - px, a.y - py) < expected * 0.3) {
    a.stuck += dt;
    if (a.stuck > 0.25) {
      a.stuck = 0;
      if (a.state === 'wander') a.goal = null;
      else a.sidestepUntil = w.now + 450;
    }
  } else a.stuck = 0;
}

function fight(w: CityScene, a: Actor) {
  const t = a.target;
  const gaveUp = !t || t.dead || w.now > a.stateUntil + 6000;
  if (gaveUp || (t.car && a.role !== 'cop')) {
    a.target = null;
    a.state = a.post ? 'post' : 'wander';
    a.goal = null;
    return;
  }
  const tx = t.car ? t.car.x : t.x;
  const ty = t.car ? t.car.y : t.y;
  const tcy = t.car ? t.car.y : t.cy;
  const d = Math.hypot(tx - a.x, ty - a.y);
  const spec = WEAPONS[a.weapon];
  const see = lineOfSight(w.city, a.x, a.cy, tx, tcy);
  if (see) a.stateUntil = w.now + 9000;
  if (d > 420) {
    a.target = null;
    a.state = 'wander';
    return;
  }
  const ang = Math.atan2(tcy - a.cy, tx - a.x);
  // Cops at low wanted levels use the baton; above that, they draw.
  const shooting = !spec.melee && (a.role !== 'cop' || t.role !== 'player' || w.police.wanted >= 2);
  const range = shooting ? Math.min(spec.range * 0.75, 110) : spec.range + 4;
  if (d > range * 0.9 || !see) moveToward(w, a, tx, ty, RUN * (a.role === 'cop' ? 1.02 : 0.95));
  else {
    // In range: hold ground, shuffle a little sideways when shooting.
    if (shooting && Math.sin(w.now / 400 + a.id) > 0.3) a.walk(ang + Math.PI / 2, WALK);
    else a.stop();
    a.faceAngle(ang);
  }
  if (see && d <= range && w.now >= a.attackReadyAt) {
    const prev = a.weapon;
    if (!shooting && !spec.melee) a.weapon = 'bat';
    // NPC aim isn't perfect.
    attack(w, a, ang + (Math.random() * 2 - 1) * (shooting ? 0.12 : 0.05));
    a.weapon = prev;
    a.attackReadyAt += shooting ? 250 + Math.random() * 350 : 150;
  }
  a.lastCrimeAt = t.role === 'player' && a.role !== 'cop' ? w.now : a.lastCrimeAt;
}
