import Phaser from 'phaser';
import { COPS } from '../../data/cast';
import { game } from '../../state/gameStore';
import { ui } from '../../state/uiStore';
import { sfx } from '../audio';
import { B, T, TILE, blockAt, kindAt } from '../city/tiles';
import { Actor } from '../entities/Actor';
import type { CityScene } from '../scenes/CityScene';
import type { Crime, CrimeKind } from '../world';
import { dirAngle, trafficSpawnPoint } from './traffic';

/** How many cops come for you at each wanted level: [on foot, cars]. */
const RESPONSE: [number, number][] = [
  [0, 0],
  [2, 0],
  [3, 1],
  [3, 2],
  [4, 3],
  [5, 4],
];

/** Heat needed for each star. */
const STAR_HEAT = [0, 1, 4, 10, 20, 34];

/** How much heat a crime is worth when a cop sees it. */
const CRIME_HEAT: Record<CrimeKind, number> = {
  gunfire: 0.7,
  assault: 1,
  carjack: 1.2,
  roadkill: 2,
  robbery: 2.5,
  murder: 4,
  copAssault: 3,
  explosion: 4,
};

/**
 * Wanted stars. Crimes a cop sees add heat, and heat turns into stars, but
 * never more than one star every couple of seconds: a shootout escalates, a
 * single punch doesn't bring the army. Civilians who ring in add a little.
 * Out of sight for long enough, the stars flash and then drop one at a time.
 */
export class Police {
  wanted = 0;
  lastSeen = 0;
  private heat = 0;
  private starAt = 0;
  private decayAt = 0;
  private dispatchAt = 0;
  /** Crimes already counted, so five cops watching one shot only count it once. */
  private counted = new Set<number>();

  constructor(private w: CityScene) {}

  private set(n: number) {
    const prev = this.wanted;
    this.wanted = Phaser.Math.Clamp(n, 0, 5);
    if (this.wanted > prev) {
      sfx('star');
      game.update((d) => (d.stats.maxWanted = Math.max(d.stats.maxWanted, this.wanted)));
    }
    ui.set({ wanted: this.wanted });
  }

  private addHeat(n: number) {
    this.heat = Math.min(STAR_HEAT[5] + 10, this.heat + n);
    let stars = 0;
    while (stars < 5 && this.heat >= STAR_HEAT[stars + 1]) stars++;
    if (stars > this.wanted && (this.wanted === 0 || this.w.now > this.starAt)) {
      this.set(this.wanted + 1);
      this.starAt = this.w.now + 2500;
    }
  }

  /** A cop saw you do it. */
  witness(c: Crime) {
    this.lastSeen = this.w.now;
    this.decayAt = Math.max(this.decayAt, this.w.now + 14000);
    if (this.counted.has(c.id)) return;
    this.counted.add(c.id);
    if (this.counted.size > 200) this.counted.clear();
    let heat = CRIME_HEAT[c.kind];
    if (c.kind === 'murder' && c.victim?.role === 'cop') heat = 7;
    this.addHeat(heat);
  }

  /** Somebody phoned the police about you. */
  report(by: Actor) {
    if (by.dead) return;
    if (this.wanted === 0) ui.toast('Someone called the police on you.', 'warn');
    this.addHeat(this.wanted === 0 ? 1 : 0.6);
    this.lastSeen = this.w.now - 3000;
    this.decayAt = Math.max(this.decayAt, this.w.now + 12000);
  }

  /** A cop has eyes on you right now. */
  seen() {
    this.lastSeen = this.w.now;
    this.decayAt = Math.max(this.decayAt, this.w.now + 12000);
  }

  clear() {
    this.heat = 0;
    this.set(0);
    for (const a of this.w.actors) if (a.role === 'cop') a.target = a.target?.role === 'player' ? null : a.target;
  }

  update() {
    const w = this.w;
    if (this.wanted > 0) {
      const lost = w.now - this.lastSeen > 5000;
      // Heat that came in while a star was cooling down still counts.
      if (!lost) this.addHeat(0);
      if (ui.get().wantedFlashing !== lost) ui.set({ wantedFlashing: lost });
      if (lost && w.now > this.decayAt) {
        this.set(this.wanted - 1);
        this.heat = STAR_HEAT[this.wanted];
        this.decayAt = w.now + 9000;
        if (this.wanted === 0) {
          ui.toast('You lost the police.', 'info');
          this.standDown();
        }
      }
    } else {
      if (ui.get().wantedFlashing) ui.set({ wantedFlashing: false });
      // Small stuff nobody followed up on is forgotten.
      this.heat = Math.max(0, this.heat - 0.0004 * w.game.loop.delta);
    }

    if (w.now > this.dispatchAt) {
      this.dispatchAt = w.now + 1500;
      this.dispatch();
    }
  }

  /** Top up the response to match the wanted level. */
  private dispatch() {
    const w = this.w;
    if (this.wanted === 0 || w.player.dead) return;
    const [foot, cars] = RESPONSE[this.wanted];
    const p = w.player.car ?? w.player;
    const footNow = w.actors.filter((a) => a.role === 'cop' && a.responder && !a.dead && !a.car).length;
    const carsNow = w.cars.filter((c) => c.isPolice && c.ai?.kind === 'pursuit' && !c.wrecked).length;
    if (footNow < foot) {
      const spot = this.footSpot(p.x, p.y);
      if (spot) this.spawnCop(spot.x, spot.y);
    }
    if (carsNow < cars) {
      const sp = trafficSpawnPoint(w, w.cameras.main.worldView, p);
      if (sp) {
        const car = w.spawnCar('police', 0, sp.x, sp.y, dirAngle(sp.dir));
        car.siren = true;
        car.ai = { kind: 'pursuit', path: [], dir: 1, stuck: 0, reverseUntil: 0, honkAt: 0, cruise: 0 };
        const cop = this.spawnCop(sp.x, sp.y);
        w.putInCar(cop, car);
      }
    }
  }

  spawnCop(x: number, y: number) {
    const look = COPS[Math.floor(Math.random() * COPS.length)];
    const cop = new Actor(this.w, look, x, y, 'cop', 70);
    cop.setWeapon(this.wanted >= 4 ? (Math.random() < 0.5 ? 'smg' : 'shotgun') : 'pistol');
    cop.responder = true;
    cop.wallet = 10;
    this.w.addActor(cop);
    return cop;
  }

  /** Somewhere walkable just off screen. */
  private footSpot(x: number, y: number) {
    const w = this.w;
    const view = w.cameras.main.worldView;
    for (let i = 0; i < 25; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.max(view.width, view.height) * 0.55 + 20 + Math.random() * 80;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      const k = kindAt(w.city, tx, ty);
      if ((k === T.PAVE || k === T.PLAZA || k === T.ROAD || k === T.CONCRETE) && !(blockAt(w.city, tx, ty) & B.PED) && !view.contains(px, py)) return { x: tx * TILE + 8, y: ty * TILE + 12 };
    }
    return null;
  }

  /** Wanted level gone: responders go back to normal life and drift off. */
  private standDown() {
    for (const a of this.w.actors) {
      if (a.role !== 'cop') continue;
      if (a.target?.role === 'player') a.target = null;
      if (a.state === 'fight' && !a.target) a.state = 'wander';
    }
    for (const c of this.w.cars) {
      if (c.isPolice && c.ai?.kind === 'pursuit') {
        c.siren = false;
        c.ai.kind = 'traffic';
        c.ai.path = [];
        c.ai.cruise = 80;
      }
    }
  }
}
