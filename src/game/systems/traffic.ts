import Phaser from 'phaser';
import { sfx } from '../audio';
import { B, LANE, T, TILE, blockAt, blockedPx, type CityMap } from '../city/tiles';
import type { Car } from '../entities/Car';
import type { CityScene } from '../scenes/CityScene';
import { distVol } from './combat';

/*
 * Traffic drives on the left, as it should. Each road tile knows which way its
 * lane flows; at a junction a car picks straight on, left or right and follows
 * a short route through the junction tiles to the right lane on the other side.
 */

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const E = 0;
const S = 1;
const W = 2;
const N = 3;
const FLAG = [LANE.E, LANE.S, LANE.W, LANE.N];

const laneAt = (c: CityMap, x: number, y: number) => (x >= 0 && y >= 0 && x < c.W && y < c.H && c.kind[y * c.W + x] === T.ROAD ? c.lane[y * c.W + x] : 0);
const isJunction = (c: CityMap, x: number, y: number) => (laneAt(c, x, y) & LANE.JUNCTION) !== 0;
const centre = (tx: number, ty: number) => ({ x: tx * TILE + 8, y: ty * TILE + 8 });

/** Routes through a junction whose top-left tile is (jx, jy), by entry and exit direction. */
function junctionRoute(jx: number, jy: number, din: number, dout: number): [number, number][] | null {
  const key = `${din}${dout}`;
  const routes: Record<string, [number, number][]> = {
    [`${E}${E}`]: [[jx, jy], [jx + 1, jy], [jx + 2, jy]],
    [`${E}${N}`]: [[jx, jy], [jx, jy - 1]],
    [`${E}${S}`]: [[jx, jy], [jx + 1, jy], [jx + 1, jy + 1], [jx + 1, jy + 2]],
    [`${W}${W}`]: [[jx + 1, jy + 1], [jx, jy + 1], [jx - 1, jy + 1]],
    [`${W}${S}`]: [[jx + 1, jy + 1], [jx + 1, jy + 2]],
    [`${W}${N}`]: [[jx + 1, jy + 1], [jx, jy + 1], [jx, jy], [jx, jy - 1]],
    [`${N}${N}`]: [[jx, jy + 1], [jx, jy], [jx, jy - 1]],
    [`${N}${W}`]: [[jx, jy + 1], [jx - 1, jy + 1]],
    [`${N}${E}`]: [[jx, jy + 1], [jx, jy], [jx + 1, jy], [jx + 2, jy]],
    [`${S}${S}`]: [[jx + 1, jy], [jx + 1, jy + 1], [jx + 1, jy + 2]],
    [`${S}${E}`]: [[jx + 1, jy], [jx + 2, jy]],
    [`${S}${W}`]: [[jx + 1, jy], [jx + 1, jy + 1], [jx, jy + 1], [jx - 1, jy + 1]],
  };
  return routes[key] ?? null;
}

/** Which way a lane tile flows (ignores junctions). */
export function laneDir(c: CityMap, tx: number, ty: number): number {
  const l = laneAt(c, tx, ty);
  if (!l || l & LANE.JUNCTION) return -1;
  return l & LANE.E ? E : l & LANE.W ? W : l & LANE.S ? S : l & LANE.N ? N : -1;
}

export const dirAngle = (d: number) => Math.atan2(DY[d], DX[d]);

/** Make sure a traffic car knows its next few waypoints. */
function extendPath(w: CityScene, car: Car) {
  const ai = car.ai!;
  const c = w.city;
  while (ai.path.length < 4) {
    const last = ai.path[ai.path.length - 1] ?? { x: car.x, y: car.y };
    const tx = Math.floor(last.x / TILE);
    const ty = Math.floor(last.y / TILE);
    const nx = tx + DX[ai.dir];
    const ny = ty + DY[ai.dir];
    if (isJunction(c, nx, ny)) {
      const jx = isJunction(c, nx - 1, ny) ? nx - 1 : nx;
      const jy = isJunction(c, nx, ny - 1) ? ny - 1 : ny;
      const back = (ai.dir + 2) % 4;
      const options: { d: number; route: [number, number][]; weight: number }[] = [];
      for (let d = 0; d < 4; d++) {
        if (d === back) continue;
        const route = junctionRoute(jx, jy, ai.dir, d);
        if (!route) continue;
        const [ex, ey] = route[route.length - 1];
        if (!(laneAt(c, ex, ey) & FLAG[d]) || isJunction(c, ex, ey)) continue;
        options.push({ d, route, weight: d === ai.dir ? 2 : 1 });
      }
      if (!options.length) return false;
      let roll = Math.random() * options.reduce((s, o) => s + o.weight, 0);
      const pick = options.find((o) => (roll -= o.weight) <= 0) ?? options[0];
      for (const [x, y] of pick.route) ai.path.push(centre(x, y));
      ai.dir = pick.d;
    } else if (laneAt(c, nx, ny) & FLAG[ai.dir]) {
      ai.path.push(centre(nx, ny));
    } else return false;
  }
  return true;
}

function turnToward(car: Car, desired: number, rate: number, dt: number) {
  const diff = Phaser.Math.Angle.Wrap(desired - car.angle);
  car.angle += Phaser.Math.Clamp(diff, -rate * dt, rate * dt);
  return Math.abs(diff);
}

/** How far ahead is clear of cars and people, within a narrow corridor. */
function clearAhead(w: CityScene, car: Car, dist: number): { blocked: boolean; byPlayer: boolean; d: number } {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = dist;
  let byPlayer = false;
  const check = (x: number, y: number, half: number, isPlayer: boolean) => {
    const rx = x - car.x;
    const ry = y - car.y;
    const along = rx * fx + ry * fy;
    const lat = Math.abs(-rx * fy + ry * fx);
    if (along > car.len / 2 && along < best + car.len / 2 && lat < half + car.wid / 2) {
      best = along - car.len / 2;
      byPlayer = isPlayer;
    }
  };
  for (const o of w.cars) if (o !== car) check(o.x, o.y, o.wid / 2, o.driver?.role === 'player');
  for (const a of w.actors) if (!a.dead && !a.car) check(a.x, a.y - 3, 4, a.role === 'player');
  return { blocked: best < dist, byPlayer, d: best };
}

export function driveTraffic(w: CityScene, car: Car, dt: number) {
  const ai = car.ai!;
  if (!extendPath(w, car) && ai.path.length === 0) {
    car.input.throttle = -1;
    return;
  }
  let target = ai.path[0];
  while (target && Math.hypot(target.x - car.x, target.y - car.y) < 7) {
    ai.path.shift();
    target = ai.path[0];
  }
  if (!target) return;
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  const speed = car.speed;
  turnToward(car, desired, 1.5 + Math.min(1, Math.abs(speed) / 60) * 4, dt);
  // Slow for corners.
  const next = ai.path[1];
  const turning = next ? Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(next.y - target.y, next.x - target.x) - car.angle)) > 0.6 : false;
  let want = turning ? 42 : ai.cruise;
  const ahead = clearAhead(w, car, 34);
  if (ahead.blocked) {
    want = ahead.d < 10 ? 0 : Math.min(want, ahead.d * 2);
    if (ahead.byPlayer && w.now > ai.honkAt) {
      ai.honkAt = w.now + 2200 + Math.random() * 2000;
      sfx('horn', distVol(w, car.x, car.y));
    }
  }
  car.input.steer = 0;
  car.input.handbrake = false;
  car.input.throttle = speed < want - 4 ? 1 : speed > want + 8 ? -1 : 0;
  if (want === 0 && speed < 5) {
    car.input.throttle = 0;
    car.input.handbrake = true;
  }
}

/** Police: drive at the target, steering round walls with feelers, reversing when stuck. */
export function drivePursuit(w: CityScene, car: Car, tx: number, ty: number, dt: number) {
  const ai = car.ai!;
  const c = w.city;
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const speed = car.speed;
  if (w.now < ai.reverseUntil) {
    car.input.throttle = -1;
    car.input.handbrake = false;
    car.angle += ai.dir * 1.8 * dt;
    return;
  }
  let desired = Math.atan2(ty - car.y, tx - car.x);
  // Feelers: if the way ahead is blocked, try angling off to whichever side is clearer.
  const feel = (a: number, d: number) => {
    for (let s = 8; s <= d; s += 6) if (blockedPx(c, car.x + Math.cos(a) * s, car.y + Math.sin(a) * s, B.CAR)) return s;
    return d;
  };
  const straight = feel(desired, 40);
  if (straight < 40) {
    const l = feel(desired - 0.8, 40);
    const r = feel(desired + 0.8, 40);
    desired += l > r ? -0.8 : 0.8;
  }
  turnToward(car, desired, 1.5 + Math.min(1, Math.abs(speed) / 60) * 4.2, dt);
  const want = dist < 50 ? 0 : dist < 120 ? 90 : car.maxSpeed * 0.92;
  car.input.steer = 0;
  car.input.throttle = speed < want ? 1 : speed > want + 15 ? -1 : 0;
  car.input.handbrake = want === 0 && speed < 20;
  // Stuck against something: back off and try again.
  if (Math.abs(speed) < 10 && want > 0) ai.stuck += dt;
  else ai.stuck = Math.max(0, ai.stuck - dt);
  if (ai.stuck > 1.1) {
    ai.stuck = 0;
    ai.reverseUntil = w.now + 700;
    ai.dir = Math.random() < 0.5 ? -1 : 1;
  }
}

/** A spot on a lane, out of sight, to spawn traffic. */
export function trafficSpawnPoint(w: CityScene, view: Phaser.Geom.Rectangle, near: { x: number; y: number }): { x: number; y: number; dir: number } | null {
  const c = w.city;
  for (let tries = 0; tries < 30; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.max(view.width, view.height) * 0.6 + 40 + Math.random() * 160;
    const x = near.x + Math.cos(ang) * r;
    const y = near.y + Math.sin(ang) * r;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    const d = laneDir(c, tx, ty);
    if (d < 0) continue;
    const p = centre(tx, ty);
    if (Phaser.Geom.Rectangle.Contains(view, p.x, p.y)) continue;
    if (!w.chunks.isLoaded(Math.floor(tx / 32), Math.floor(ty / 32))) continue;
    if (w.cars.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 40)) continue;
    if (blockAt(c, tx, ty) & B.CAR) continue;
    return { ...p, dir: d };
  }
  return null;
}
