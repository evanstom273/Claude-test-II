import Phaser from 'phaser';
import { CIVILIANS, COPS, GANGS, GANG_LOOKS, SHOPKEEPERS, type GangId } from '../../data/cast';
import type { WeaponId } from '../../state/types';
import { CAR_COLOURS, CIVILIAN_MODELS } from '../art/cars';
import { B, CHUNK, T, TILE, blockAt, districtAt, kindAt, type Building } from '../city/tiles';
import { Actor } from '../entities/Actor';
import type { CityScene } from '../scenes/CityScene';
import { dirAngle, laneDir, trafficSpawnPoint } from './traffic';

/*
 * Keeps the streets busy around the player: pedestrians and gang members on
 * foot, traffic on the roads, staff behind every counter. Things that wander
 * far away are quietly removed.
 */

const PED_TARGET: Record<string, number> = { downtown: 20, strip: 22, residential: 13, industrial: 10, docks: 10, park: 12, coast: 8 };
const DESPAWN = 720;

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

function gangWeapon(g: GangId): WeaponId {
  const r = Math.random();
  if (g === 'crowns') return r < 0.6 ? 'pistol' : r < 0.75 ? 'smg' : 'fists';
  if (g === 'rats') return r < 0.5 ? 'bat' : r < 0.75 ? 'pistol' : 'fists';
  return r < 0.4 ? 'pistol' : r < 0.6 ? 'bat' : r < 0.7 ? 'smg' : 'fists';
}

export class Population {
  private tickAt = 0;
  /** Staff killed this session stay dead until you leave and come back much later. */
  readonly deadStaff = new Set<number>();
  private staffByChunk = new Map<number, Actor[]>();

  constructor(private w: CityScene) {}

  /** Pedestrian spawn spot: walkable street just off screen. */
  private pedSpot(view: Phaser.Geom.Rectangle, x: number, y: number) {
    const c = this.w.city;
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.max(view.width, view.height) * 0.55 + 16 + Math.random() * 140;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      const k = kindAt(c, tx, ty);
      if (!(k === T.PAVE || k === T.PLAZA || k === T.CONCRETE || (k === T.GRASS && districtAt(c, tx, ty) === 'park') || k === T.SAND)) continue;
      if (blockAt(c, tx, ty) & B.PED) continue;
      if (view.contains(tx * TILE + 8, ty * TILE + 8)) continue;
      if (!this.w.chunks.isLoaded(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK))) continue;
      return { x: tx * TILE + 8, y: ty * TILE + 12, tx, ty };
    }
    return null;
  }

  spawnPed(x: number, y: number, tx: number, ty: number) {
    const w = this.w;
    const turf = w.city.turf[ty * w.city.W + tx];
    const gang = turf ? GANGS[turf - 1] : null;
    const night = w.darkness > 0.5;
    if (gang && Math.random() < (night ? 0.55 : 0.35)) {
      const a = new Actor(w, pick(GANG_LOOKS[gang]), x, y, 'gang', 55);
      a.setWeapon(gangWeapon(gang));
      a.wallet = 10 + Math.floor(Math.random() * 40);
      w.addActor(a);
      return a;
    }
    if (Math.random() < 0.05 && w.police.wanted === 0) {
      const a = new Actor(w, pick(COPS), x, y, 'cop', 70);
      a.setWeapon('pistol');
      w.addActor(a);
      return a;
    }
    const a = new Actor(w, pick(CIVILIANS), x, y, 'civ', 35);
    a.tough = Math.random() < 0.2;
    a.wallet = 3 + Math.floor(Math.random() * 30);
    w.addActor(a);
    return a;
  }

  update() {
    const w = this.w;
    if (w.now < this.tickAt) return;
    this.tickAt = w.now + 450;
    const view = w.cameras.main.worldView;
    const p = w.player.car ?? w.player;

    // Clear out the far away and the long dead.
    for (const a of [...w.actors]) {
      if (a === w.player || a.persistent || a.jobTarget || a.car) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      const deadLong = a.dead && w.now - a.deadAt > 25000 && !view.contains(a.x, a.y);
      if (d > DESPAWN || deadLong) w.removeActor(a);
    }
    for (const c of [...w.cars]) {
      if (c === w.player.car || c.persistent || c.jobTarget) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > DESPAWN + 60 && !view.contains(c.x, c.y)) w.removeCar(c);
    }

    // People.
    const district = districtAt(w.city, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    const night = w.darkness > 0.5;
    let target = PED_TARGET[district] ?? 12;
    if (night && district !== 'strip') target = Math.round(target * 0.7);
    const peds = w.actors.filter((a) => !a.dead && !a.persistent && a.role !== 'player' && !a.car && Math.hypot(a.x - p.x, a.y - p.y) < 520).length;
    for (let n = 0; n < Math.min(3, target - peds); n++) {
      const s = this.pedSpot(view, p.x, p.y);
      if (s) this.spawnPed(s.x, s.y, s.tx, s.ty);
    }

    // Traffic.
    const cars = w.cars.filter((c) => c.ai?.kind === 'traffic' && Math.hypot(c.x - p.x, c.y - p.y) < 560).length;
    if (cars < 10) {
      const sp = trafficSpawnPoint(w, view, p);
      if (sp) {
        const police = Math.random() < 0.06;
        const model = police ? 'police' : pick(CIVILIAN_MODELS);
        const car = w.spawnCar(model, Math.floor(Math.random() * CAR_COLOURS.length), sp.x, sp.y, dirAngle(sp.dir));
        car.ai = { kind: 'traffic', path: [], dir: sp.dir, stuck: 0, reverseUntil: 0, honkAt: 0, cruise: 70 + Math.random() * 30 };
        const driverLook = police ? pick(COPS) : pick(CIVILIANS);
        const driver = new Actor(w, driverLook, sp.x, sp.y, police ? 'cop' : 'civ', police ? 70 : 35);
        if (police) driver.setWeapon('pistol');
        driver.tough = Math.random() < 0.25;
        driver.wallet = 5 + Math.floor(Math.random() * 40);
        w.addActor(driver);
        w.putInCar(driver, car);
      }
    }
  }

  /** Staff for the buildings in a newly loaded chunk, and parked cars. */
  onChunkLoad(cx: number, cy: number) {
    const w = this.w;
    const list: Actor[] = [];
    for (const b of w.city.buildings) {
      if (!b.post || this.deadStaff.has(b.id)) continue;
      if (Math.floor(b.post.x / CHUNK) !== cx || Math.floor(b.post.y / CHUNK) !== cy) continue;
      const a = this.spawnStaff(b);
      if (a) list.push(a);
    }
    this.staffByChunk.set(cy * 1000 + cx, list);
    for (const spot of w.city.parking) {
      if (Math.floor(spot.x / TILE / CHUNK) !== cx || Math.floor(spot.y / TILE / CHUNK) !== cy) continue;
      if (Math.random() > 0.55) continue;
      if (w.cars.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 20)) continue;
      const model = pick(CIVILIAN_MODELS.filter((m) => m !== 'taxi'));
      w.spawnCar(model, Math.floor(Math.random() * CAR_COLOURS.length), spot.x, spot.y, spot.angle + (Math.random() < 0.5 ? Math.PI : 0));
    }
  }

  onChunkUnload(cx: number, cy: number) {
    const key = cy * 1000 + cx;
    for (const a of this.staffByChunk.get(key) ?? []) if (this.w.actors.includes(a) && !a.jobTarget) this.w.removeActor(a);
    this.staffByChunk.delete(key);
  }

  private spawnStaff(b: Building): Actor | null {
    const w = this.w;
    const x = b.post!.x * TILE + 8;
    const y = b.post!.y * TILE + 12;
    let a: Actor;
    if (b.kind === 'gang_hq' && b.gang) {
      a = new Actor(w, pick(GANG_LOOKS[b.gang]), x, y, 'gang', 70);
      a.setWeapon(b.gang === 'crowns' ? 'smg' : 'pistol');
      // A couple more hanging about inside.
      for (let i = 0; i < 2; i++) {
        const tx = b.x + 1 + Math.floor(Math.random() * (b.w - 2));
        const ty = b.y + 1 + Math.floor(Math.random() * (b.h - 2));
        if (blockAt(w.city, tx, ty) & B.PED) continue;
        const m = new Actor(w, pick(GANG_LOOKS[b.gang]), tx * TILE + 8, ty * TILE + 12, 'gang', 55);
        m.setWeapon(gangWeapon(b.gang));
        m.persistent = true;
        m.post = { x: m.x, y: m.y };
        m.wallet = 20;
        w.addActor(m);
      }
    } else if (b.kind === 'police') {
      a = new Actor(w, pick(COPS), x, y, 'cop', 70);
      a.setWeapon('pistol');
    } else {
      a = new Actor(w, pick(SHOPKEEPERS), x, y, 'staff', 45);
      if (b.kind === 'shop_guns') a.setWeapon('shotgun');
      else if (b.kind === 'bank') a.setWeapon('pistol');
      a.tough = b.kind === 'bar' || b.kind === 'club';
    }
    a.persistent = true;
    a.staffOf = b.id;
    a.post = { x, y };
    a.state = 'post';
    a.wallet = 15;
    w.addActor(a);
    return a;
  }
}

/** Keep traffic that has lost its route pointed at a lane, or let it roll to a stop. */
export function reroute(w: CityScene, dirFallback: number, x: number, y: number) {
  const d = laneDir(w.city, Math.floor(x / TILE), Math.floor(y / TILE));
  return d >= 0 ? d : dirFallback;
}
