import Phaser from 'phaser';
import { CIVILIANS, GANGS, GANG_LOOKS, type GangId } from '../../data/cast';
import { bus } from '../../state/bus';
import { game } from '../../state/gameStore';
import { autosave } from '../../state/session';
import type { Giver, Job, JobType } from '../../state/types';
import { ui } from '../../state/uiStore';
import { CAR_SPECS, CIVILIAN_MODELS, type CarModel } from '../art/cars';
import { sfx } from '../audio';
import { GANG_NAMES } from '../city/gen';
import { FIRST_NAMES, LAST_NAMES } from '../city/names';
import { B, T, TILE, blockAt, kindAt, type Prop } from '../city/tiles';
import { Actor } from '../entities/Actor';
import type { Car } from '../entities/Car';
import type { CityScene } from '../scenes/CityScene';
import { RIVAL } from './ai';
import { distVol } from './combat';

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const GIVER_NAME: Record<Giver, string> = { ...GANG_NAMES, fixer: 'The Fixer' };

/** Opening lines, by who's on the phone. */
const VOICE: Record<Giver, string[]> = {
  vipers: ["Yeah, it's the Vipers. Listen.", 'Viper business. Keep it quiet.'],
  crowns: ['The Crowns have a proposition, darling.', 'Good evening. The Velvet Crowns require a favour.'],
  rats: ['Oi. Dock Rats here. Got a job.', "It's the Rats. Don't make it weird."],
  fixer: ["Don't say my name. I've got work.", "It's the Fixer. Cash job, no questions."],
};

let jobSeq = 1;

/**
 * Payphones ring when there's work going. Pick up, hear the pitch, take the job.
 * One job at a time; the HUD and minimap point the way.
 */
export class Jobs {
  ringing: Prop[] = [];
  private ringAt = 0;
  private checkAt = 0;
  private offerPhone: Prop | null = null;
  private targetActor: Actor | null = null;
  private targetCar: Car | null = null;
  private icons = new Map<number, Phaser.GameObjects.Text>();
  private unsub: (() => void)[] = [];

  constructor(private w: CityScene) {
    this.unsub.push(bus.on('jobAccepted', ({ job }) => this.start(job)));
    this.unsub.push(bus.on('jobCancelled', () => this.fail('Job cancelled.', true)));
  }

  destroy() {
    for (const u of this.unsub) u();
    for (const t of this.icons.values()) t.destroy();
  }

  get job() {
    return game.data.job;
  }

  /** Pick up a ringing phone near the player. */
  phoneNear(x: number, y: number): Prop | null {
    return this.ringing.find((p) => Math.hypot(p.tx * TILE + 8 - x, p.ty * TILE + 12 - y) < 16) ?? null;
  }

  answer(p: Prop) {
    const job = this.makeJob(p);
    if (!job) return;
    this.offerPhone = p;
    sfx('select');
    ui.set({ jobOffer: job });
    ui.open('job');
  }

  private start(job: Job) {
    if (this.offerPhone) {
      this.ringing = this.ringing.filter((r) => r !== this.offerPhone);
      this.icons.get(this.offerPhone.id)?.destroy();
      this.icons.delete(this.offerPhone.id);
      this.offerPhone = null;
    }
    job.timeLeftMs = job.timeLimitMs;
    job.progress = 0;
    this.spawnTargets(job);
    game.update((d) => (d.job = job));
    ui.toast(job.title, 'job', 3500);
  }

  private spawnTargets(job: Job) {
    const w = this.w;
    if (job.type === 'hit' && job.marker) {
      const look = job.targetLook ? [...CIVILIANS, ...Object.values(GANG_LOOKS).flat()].find((l) => l.id === job.targetLook)! : pick(CIVILIANS);
      const a = new Actor(w, look, job.marker.x, job.marker.y, look.faction === 'civ' ? 'target' : 'gang', 80);
      a.name = job.targetName ?? null;
      a.jobTarget = true;
      a.persistent = true;
      a.tough = true;
      a.wallet = 120;
      if (look.faction !== 'civ') a.setWeapon('pistol');
      w.addActor(a);
      this.targetActor = a;
    }
    if ((job.type === 'steal_car' || job.type === 'torch') && job.marker) {
      const colour = Math.floor(Math.random() * 10);
      const car = w.spawnCar(job.model ?? 'sedan', colour, job.marker.x, job.marker.y, Math.random() < 0.5 ? 0 : Math.PI);
      car.jobTarget = true;
      car.persistent = true;
      this.targetCar = car;
    }
  }

  /** Build a job for whoever's calling from this phone. */
  private makeJob(p: Prop): Job | null {
    const w = this.w;
    const turf = w.city.turf[p.ty * w.city.W + p.tx];
    const giver: Giver = turf ? GANGS[turf - 1] : Math.random() < 0.4 ? 'fixer' : pick(GANGS);
    const types: JobType[] = giver === 'fixer' ? ['steal_car', 'deliver', 'hit'] : ['steal_car', 'hit', 'deliver', 'torch', 'cull'];
    const type = pick(types);
    const px = p.tx * TILE + 8;
    const py = p.ty * TILE + 8;
    const voice = pick(VOICE[giver]);
    const id = `job${jobSeq++}`;
    const rival = giver === 'fixer' ? pick(GANGS) : RIVAL[giver];
    switch (type) {
      case 'steal_car': {
        const model = pick(CIVILIAN_MODELS.filter((m) => m !== 'taxi')) as CarModel;
        const spot = this.parkSpot(px, py, 350, 900);
        const drop = this.dropoff(giver);
        if (!spot || !drop) return null;
        const reward = CAR_SPECS[model].value * 3 + 120;
        return {
          id,
          type,
          giver,
          model,
          title: `Steal a ${CAR_SPECS[model].name}`,
          brief: `${voice} I need a ${CAR_SPECS[model].name}. There's one parked up, I've marked it. Bring it to the garage in one piece. $${reward}.`,
          reward,
          marker: { ...spot, label: CAR_SPECS[model].name },
          dropoff: drop,
          stage: 0,
        };
      }
      case 'hit': {
        const spot = this.streetSpot(px, py, 400, 900);
        if (!spot) return null;
        const targetGang = giver !== 'fixer' && Math.random() < 0.6 ? rival : null;
        const look = targetGang ? pick(GANG_LOOKS[targetGang]) : pick(CIVILIANS);
        const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
        const reward = 300 + Math.floor(Math.random() * 4) * 50;
        return {
          id,
          type,
          giver,
          targetName: name,
          targetLook: look.id,
          targetGang: targetGang ?? undefined,
          title: `Take out ${name}`,
          brief: `${voice} ${name}${targetGang ? `, one of the ${GANG_NAMES[targetGang]},` : ''} owes us. They won't be paying. Make it permanent. $${reward}.`,
          reward,
          marker: { ...spot, label: name },
        };
      }
      case 'deliver': {
        const dest = this.doorSpot(px, py, 600, 1200);
        if (!dest) return null;
        const dist = Math.hypot(dest.x - px, dest.y - py);
        const limit = Math.round((dist / 85) * 1.5 + 25) * 1000;
        const reward = 150 + Math.round(dist / 6);
        return {
          id,
          type,
          giver,
          title: `Deliver a package to ${dest.name}`,
          brief: `${voice} Package needs to get to ${dest.name}. You've got ${Math.round(limit / 1000)} seconds. Don't open it. $${reward}.`,
          reward,
          marker: { x: dest.x, y: dest.y, label: dest.name },
          dropoff: { x: dest.x, y: dest.y },
          timeLimitMs: limit,
        };
      }
      case 'torch': {
        const spot = this.parkSpot(px, py, 300, 900);
        if (!spot) return null;
        const reward = 280;
        const model = pick(['sports', 'sedan', 'van'] as CarModel[]);
        return {
          id,
          type,
          giver,
          model,
          targetGang: rival,
          title: `Torch the ${GANG_NAMES[rival]}' ${CAR_SPECS[model].name}`,
          brief: `${voice} The ${GANG_NAMES[rival]} parked their pride and joy on the wrong street. Wreck it. Shoot it, ram it, whatever. $${reward}.`,
          reward,
          marker: { ...spot, label: 'Target car' },
        };
      }
      case 'cull': {
        const count = 3 + Math.floor(Math.random() * 3);
        const turfTile = this.turfCentre(rival);
        const reward = count * 110;
        return {
          id,
          type,
          giver,
          targetGang: rival,
          count,
          title: `Thin out the ${GANG_NAMES[rival]}: ${count}`,
          brief: `${voice} The ${GANG_NAMES[rival]} are getting cocky. Put ${count} of them down. You'll find them on their turf. $${reward}.`,
          reward,
          marker: turfTile ? { ...turfTile, label: `${GANG_NAMES[rival]} turf` } : undefined,
        };
      }
    }
    return null;
  }

  private ring(r: number, x: number, y: number, min: number, max: number) {
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r };
  }

  private parkSpot(x: number, y: number, min: number, max: number) {
    const spots = this.w.city.parking.filter((s) => {
      const d = Math.hypot(s.x - x, s.y - y);
      return d > min && d < max;
    });
    if (spots.length) {
      const s = pick(spots);
      return { x: s.x, y: s.y };
    }
    return this.streetSpot(x, y, min, max, true);
  }

  private streetSpot(x: number, y: number, min: number, max: number, road = false) {
    const c = this.w.city;
    for (let i = 0; i < 60; i++) {
      const p = this.ring(0, x, y, min, max);
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      const k = kindAt(c, tx, ty);
      if (road ? k !== T.PAVE : !(k === T.PAVE || k === T.PLAZA || k === T.FLOOR)) continue;
      if (blockAt(c, tx, ty) & B.PED) continue;
      return { x: tx * TILE + 8, y: ty * TILE + 12 };
    }
    return null;
  }

  private doorSpot(x: number, y: number, min: number, max: number) {
    const c = this.w.city;
    const options = c.buildings.filter((b) => {
      const d = Math.hypot(b.door.x * TILE - x, b.door.y * TILE - y);
      return d > min && d < max && b.kind !== 'police';
    });
    if (!options.length) return null;
    const b = pick(options);
    const v = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.door.side];
    return { x: (b.door.x + v[0]) * TILE + 8, y: (b.door.y + v[1]) * TILE + 12, name: b.kind === 'house' ? `a house on ${b.district === 'residential' ? 'the estate' : 'the block'}` : b.kind === 'safehouse' ? 'your own front door' : b.name };
  }

  private dropoff(giver: Giver) {
    const c = this.w.city;
    const garages = c.buildings.filter((b) => b.kind === 'garage');
    const hq = giver !== 'fixer' ? c.buildings.find((b) => b.kind === 'gang_hq' && b.gang === giver) : undefined;
    const b = hq && Math.random() < 0.5 ? hq : pick(garages.length ? garages : c.buildings);
    const v = { n: [0, -2], s: [0, 2], w: [-2, 0], e: [2, 0] }[b.door.side];
    return { x: (b.door.x + v[0]) * TILE + 8, y: (b.door.y + v[1]) * TILE + 8 };
  }

  private turfCentre(g: GangId) {
    const blocks = this.w.city.blocks.filter((b) => b.gang === g);
    if (!blocks.length) return null;
    const b = pick(blocks);
    return { x: ((b.x0 + b.x1) / 2) * TILE, y: ((b.y0 + b.y1) / 2) * TILE };
  }

  // ---- Progress ----------------------------------------------------------------------------

  onKill(a: Actor, by: Actor | null) {
    const job = this.job;
    if (!job || by?.role !== 'player') return;
    if (job.type === 'hit' && a === this.targetActor) this.complete();
    if (job.type === 'cull' && a.faction === job.targetGang) {
      const n = (job.progress ?? 0) + 1;
      game.update((d) => d.job && (d.job.progress = n));
      ui.toast(`${n} / ${job.count}`, 'job', 1500);
      if (n >= (job.count ?? 3)) this.complete();
    }
  }

  private complete() {
    const job = this.job;
    if (!job) return;
    game.addCash(job.reward);
    if (job.giver !== 'fixer') {
      game.respect(job.giver, 14);
      game.respect(RIVAL[job.giver], -8);
    }
    game.update((d) => {
      d.job = null;
      d.stats.jobsDone++;
    });
    this.cleanupTargets();
    sfx('job');
    ui.bigText('JOB DONE', '#8ad06a', `+$${job.reward}   ${GIVER_NAME[job.giver]} respect up`);
    void autosave();
  }

  fail(reason: string, quiet = false) {
    if (!this.job) return;
    game.update((d) => (d.job = null));
    this.cleanupTargets();
    if (!quiet) {
      sfx('fail');
      ui.bigText('JOB FAILED', '#d64545', reason);
    } else ui.toast(reason, 'warn');
  }

  private cleanupTargets() {
    if (this.targetActor) {
      this.targetActor.jobTarget = false;
      this.targetActor.persistent = false;
    }
    if (this.targetCar) {
      this.targetCar.jobTarget = false;
      this.targetCar.persistent = false;
    }
    this.targetActor = null;
    this.targetCar = null;
  }

  update(dt: number) {
    const w = this.w;
    const job = this.job;
    const p = w.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const markers: { x: number; y: number; kind: 'job' | 'phone' | 'home' | 'shop' }[] = [];

    if (job) {
      let target: { x: number; y: number } | null = job.marker ?? null;
      if (job.type === 'hit') {
        const t = this.targetActor;
        if (!t || !w.actors.includes(t)) {
          // Wandered off and got cleaned up, or never spawned: put them back.
          if (!t) this.spawnTargets(job);
        } else target = { x: t.x, y: t.y };
      }
      if (job.type === 'steal_car') {
        const inRight = p.car && p.car.model === job.model && !p.car.wrecked;
        target = inRight ? job.dropoff! : this.targetCar && !this.targetCar.wrecked ? { x: this.targetCar.x, y: this.targetCar.y } : job.marker ?? null;
        if (inRight && job.dropoff && Math.hypot(px - job.dropoff.x, py - job.dropoff.y) < 30) {
          const car = p.car!;
          w.exitCar(true);
          car.persistent = false;
          car.jobTarget = false;
          w.removeCar(car);
          this.complete();
        } else if (this.targetCar?.wrecked && !inRight) this.fail('The car got wrecked.');
      }
      if (job.type === 'torch') {
        if (this.targetCar) {
          target = { x: this.targetCar.x, y: this.targetCar.y };
          if (this.targetCar.wrecked) this.complete();
        }
      }
      if (job.type === 'deliver' && job.dropoff) {
        target = job.dropoff;
        const left = (job.timeLeftMs ?? 0) - dt * 1000;
        if (Math.floor(left / 1000) !== Math.floor((job.timeLeftMs ?? 0) / 1000)) game.update((d) => d.job && (d.job.timeLeftMs = left));
        else job.timeLeftMs = left;
        if (Math.hypot(px - job.dropoff.x, py - job.dropoff.y) < 22) this.complete();
        else if (left <= 0) this.fail('Too slow. The package went off.');
      }
      if (target) markers.push({ ...target, kind: 'job' });
      w.pointAt(target);
    } else w.pointAt(null);

    // Phones ring when there's no job on.
    if (!job && w.now > this.checkAt) {
      this.checkAt = w.now + 4000;
      this.ringing = this.ringing.filter((r) => Math.hypot(r.tx * TILE - px, r.ty * TILE - py) < 900);
      if (this.ringing.length < 2) {
        const near = w.city.payphones.filter((r) => {
          const d = Math.hypot(r.tx * TILE - px, r.ty * TILE - py);
          return d > 80 && d < 650 && !this.ringing.includes(r);
        });
        if (near.length) this.ringing.push(pick(near));
      }
    }
    if (job && this.ringing.length) this.ringing = [];
    for (const [id, t] of this.icons) {
      if (!this.ringing.some((r) => r.id === id)) {
        t.destroy();
        this.icons.delete(id);
      }
    }
    for (const r of this.ringing) {
      markers.push({ x: r.tx * TILE + 8, y: r.ty * TILE + 8, kind: 'phone' });
      if (!this.icons.has(r.id)) {
        const t = w.add
          .text(r.tx * TILE + 8, r.ty * TILE - 14, '☎', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffd84f', stroke: '#1a1423', strokeThickness: 3, resolution: 4 })
          .setOrigin(0.5)
          .setScale(0.7)
          .setDepth(16000);
        w.tweens.add({ targets: t, y: t.y - 3, yoyo: true, repeat: -1, duration: 300 });
        this.icons.set(r.id, t);
      }
    }
    if (this.ringing.length && w.now > this.ringAt) {
      this.ringAt = w.now + 2800;
      const r = this.ringing[0];
      const v = distVol(w, r.tx * TILE, r.ty * TILE, 260);
      if (v > 0) sfx('ring', v);
    }
    const home = w.city.buildings.find((b) => b.kind === 'safehouse');
    if (home) markers.push({ x: home.door.x * TILE + 8, y: home.door.y * TILE + 8, kind: 'home' });
    ui.set({ markers });
  }
}
