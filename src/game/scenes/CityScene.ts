import Phaser from 'phaser';
import { PLAYER_OUTFITS } from '../../data/cast';
import { WEAPONS } from '../../data/weapons';
import { settingsStore } from '../../db/settings';
import { bus } from '../../state/bus';
import { game } from '../../state/gameStore';
import { worldBridge } from '../../state/session';
import { ui, uiStore } from '../../state/uiStore';
import { CAR_SPECS, type CarModel } from '../art/cars';
import { STATIONS, engineSound, playMusic, sfx, sirenSound } from '../audio';
import { ChunkManager } from '../city/chunks';
import { getCity } from '../city/cache';
import { B, T, TILE, blockAt, kindAt, type Building, type CityMap, type Prop } from '../city/tiles';
import { Actor } from '../entities/Actor';
import { Car } from '../entities/Car';
import { Fx } from '../fx';
import { Controls } from '../input';
import { Lighting, type Light } from '../Lighting';
import { gangHatesPlayer, updateNpc } from '../systems/ai';
import { attack, collectPickups, distVol, dropPickup, explode, hurtActor, hurtCar, type Pickup } from '../systems/combat';
import { Jobs } from '../systems/jobs';
import { Police } from '../systems/police';
import { Population, reroute } from '../systems/population';
import { drivePursuit, driveTraffic } from '../systems/traffic';
import { ATLAS } from '../textures';
import type { Crime, CrimeKind, World } from '../world';
import { fitZoom } from './zoom';

interface Interaction {
  label: string;
  act: () => void;
}

const SHOP_LABEL: Partial<Record<Building['kind'], string>> = {
  shop_guns: 'Buy guns',
  shop_food: 'Buy food',
  chippy: 'Buy chips',
  shop_clothes: 'Buy clothes',
  bar: 'Order a pint',
  club: 'Order a drink',
  hospital: 'See a doctor',
};

export class CityScene extends Phaser.Scene implements World {
  city!: CityMap;
  chunks!: ChunkManager;
  fx!: Fx;
  police!: Police;
  population!: Population;
  jobs!: Jobs;
  lighting!: Lighting;
  controls!: Controls;
  player!: Actor;
  actors: Actor[] = [];
  cars: Car[] = [];
  crimes: Crime[] = [];
  crimeId = 0;
  dynamicLights: Light[] = [];
  decals: { obj: Phaser.GameObjects.GameObject; at: number }[] = [];
  pickups: Pickup[] = [];
  darkness = 0;

  private flashes: (Light & { until: number })[] = [];
  private station = 0;
  private clockAcc = 0;
  private hudAt = 0;
  private downAt = 0;
  private interaction: Interaction | null = null;
  private arrow!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private pointTarget: { x: number; y: number } | null = null;
  private robbed = new Set<number>();
  private unsub: (() => void)[] = [];
  private zoom = 3;
  private stopMouse?: () => void;

  constructor() {
    super('city');
  }

  /** Scene time in ms (Phaser's clock lives on `this.now`). */
  get now() {
    return this.game.loop.time;
  }

  get gfx(): Phaser.Scene {
    return this;
  }

  create() {
    this.actors = [];
    this.cars = [];
    this.crimes = [];
    this.pickups = [];
    this.decals = [];
    this.flashes = [];
    this.dynamicLights = [];
    this.robbed = new Set();
    this.downAt = 0;

    const d = game.data;
    this.city = getCity(d.seed);
    this.fx = new Fx(this);
    this.controls = new Controls(this);
    this.stopMouse = this.controls.attachMouse(this.game.canvas);
    this.police = new Police(this);
    this.population = new Population(this);
    this.chunks = new ChunkManager(this, this.city);
    this.chunks.onLoad = (cx, cy) => this.population.onChunkLoad(cx, cy);
    this.chunks.onUnload = (cx, cy) => this.population.onChunkUnload(cx, cy);

    const spawn = d.pos ?? this.city.spawn;
    this.player = new Actor(this, PLAYER_OUTFITS[d.outfit] ?? PLAYER_OUTFITS[0], spawn.x, spawn.y, 'player', 100);
    this.addActor(this.player);
    this.refreshPlayerWeapon();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.city.W * TILE, this.city.H * TILE);
    this.zoom = fitZoom(this, 12);
    cam.setZoom(this.zoom);
    cam.startFollow(this.player.sprite, true, 0.18, 0.18);
    cam.centerOn(spawn.x, spawn.y);
    cam.setRoundPixels(false);
    this.makeLighting();
    this.scale.on('resize', this.makeLighting, this);

    this.arrow = this.add.image(0, 0, ATLAS, 'arrow').setDepth(16500).setVisible(false);
    this.ring = this.add.image(0, 0, ATLAS, 'ring').setDepth(-40000).setTint(0xffd84f).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.ring, alpha: { from: 0.9, to: 0.3 }, scale: { from: 0.35, to: 0.55 }, duration: 700, yoyo: true, repeat: -1 });

    this.jobs = new Jobs(this);
    this.unsub.push(bus.on('outfitChanged', ({ outfit }) => this.player.setLook(PLAYER_OUTFITS[outfit] ?? PLAYER_OUTFITS[0])));
    this.unsub.push(bus.on('weaponsChanged', () => this.refreshPlayerWeapon()));
    this.unsub.push(bus.on('clearWanted', () => this.police.clear()));
    worldBridge.playerPos = () => ({ x: this.player.car ? this.player.car.x : this.player.x, y: this.player.car ? this.player.car.y : this.player.y });

    this.events.once('shutdown', () => this.cleanup());
    this.chunks.update(cam.worldView);
    playMusic(null);
    ui.set({ wanted: 0, station: null, inCar: null });
  }

  private makeLighting() {
    this.lighting?.destroy();
    const minZoom = fitZoom(this, 26);
    this.lighting = new Lighting(this, this.scale.width / minZoom + 64, this.scale.height / minZoom + 64);
  }

  private cleanup() {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.stopMouse?.();
    this.scale.off('resize', this.makeLighting, this);
    this.jobs.destroy();
    this.chunks.destroy();
    engineSound(false, 0);
    sirenSound(0);
    playMusic(null);
    worldBridge.playerPos = undefined;
  }

  // ---- World API ------------------------------------------------------------------

  addActor(a: Actor) {
    this.actors.push(a);
  }

  removeActor(a: Actor) {
    if (a === this.player) return;
    const i = this.actors.indexOf(a);
    if (i >= 0) this.actors.splice(i, 1);
    if (a.car && a.car.driver === a) a.car.driver = null;
    a.destroy();
  }

  spawnCar(model: CarModel, colour: number, x: number, y: number, angle: number) {
    const c = new Car(this, model, colour, x, y, angle);
    this.cars.push(c);
    return c;
  }

  removeCar(c: Car) {
    const i = this.cars.indexOf(c);
    if (i >= 0) this.cars.splice(i, 1);
    if (c.driver && c.driver !== this.player) this.removeActor(c.driver);
    c.destroy();
  }

  putInCar(a: Actor, c: Car) {
    a.car = c;
    c.driver = a;
    a.stop();
    a.sprite.setVisible(false);
    a.shadow.setVisible(false);
    a.held?.setVisible(false);
  }

  /** Throw an NPC driver out of their car (carjacked, or bailing out of a burning one). */
  ejectDriver(c: Car, panic: boolean) {
    const d = c.driver;
    if (!d || d === this.player) return;
    c.driver = null;
    const spot = this.besideCar(c, d);
    d.car = null;
    d.x = spot.x;
    d.y = spot.y;
    d.sprite.setVisible(true);
    d.shadow.setVisible(true);
    d.held?.setVisible(true);
    if (c.ai) c.ai = null;
    d.state = panic || !d.tough ? 'flee' : 'fight';
    d.goal = { x: c.x, y: c.y };
    d.stateUntil = this.now + 5000;
    if (d.state === 'fight') d.target = this.player;
  }

  private besideCar(c: Car, a: Actor) {
    for (const side of [-1, 1]) {
      const p = c.local(0, side * (c.wid / 2 + 7));
      if (!a.blocked(p.x, p.y + 3)) return { x: p.x, y: p.y + 3 };
    }
    for (const f of [1, -1]) {
      const p = c.local(f * (c.len / 2 + 7), 0);
      if (!a.blocked(p.x, p.y + 3)) return { x: p.x, y: p.y + 3 };
    }
    return { x: c.x, y: c.y };
  }

  crime(kind: CrimeKind, by: Actor, x: number, y: number, victim?: Actor, heard = 0) {
    this.crimes.push({ id: ++this.crimeId, kind, by, x, y, at: this.now, victim, heard });
    if (kind !== 'gunfire' || victim) by.lastCrimeAt = this.now;
    if (kind === 'gunfire') by.lastCrimeAt = this.now;
  }

  hurtActor(a: Actor, dmg: number, fromX: number, fromY: number, by: Actor | null, knock?: number) {
    hurtActor(this, a, dmg, fromX, fromY, by, knock);
  }

  hurtCar(c: Car, dmg: number, by: Actor | null) {
    hurtCar(this, c, dmg, by);
  }

  explode(x: number, y: number, by: Actor | null) {
    explode(this, x, y, by);
  }

  flashLight(x: number, y: number, color: number, radius: number, ms = 70) {
    this.flashes.push({ x, y, color, radius, intensity: 1.2, until: this.now + ms });
  }

  pointAt(t: { x: number; y: number } | null) {
    this.pointTarget = t;
  }

  onActorHurt(a: Actor, by: Actor | null) {
    if (!by || a.dead) return;
    // Being hurt is the surest way to start a fight.
    if (a.role === 'gang' || a.role === 'cop' || (a.role === 'staff' && a.weapon !== 'fists') || a.tough) {
      a.target = by;
      a.state = 'fight';
      a.stateUntil = this.now + 9000;
      if (by === this.player) a.hostile = true;
    } else {
      a.state = 'flee';
      a.goal = { x: by.x, y: by.y };
      a.stateUntil = this.now + 6000;
    }
  }

  onActorKilled(a: Actor, by: Actor | null) {
    if (a.staffOf !== null) this.population.deadStaff.add(a.staffOf);
    this.jobs.onKill(a, by);
  }

  onPackage() {}

  refreshPlayerWeapon() {
    const w = game.data.current;
    this.player.setWeapon(game.hasWeapon(w) ? w : 'fists');
  }

  // ---- Player -------------------------------------------------------------------------

  /** Pick the thing auto-aim should point at. */
  private autoAim(p: Actor, range: number): number {
    const facingAng = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.facing];
    const moving = p.moving ? Math.atan2(p.vy, p.vx) : facingAng;
    let best: Actor | null = null;
    let bestScore = Infinity;
    for (const o of this.actors) {
      if (o === p || o.dead || o.car) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > range) continue;
      const ang = Math.atan2(o.cy - p.cy, o.x - p.x);
      const off = Math.abs(Phaser.Math.Angle.Wrap(ang - moving));
      if (off > 1.25) continue;
      const threat = o.hostile || o.target === p || o.jobTarget ? 0.4 : o.role === 'gang' && gangHatesPlayer(o.faction as 'vipers') ? 0.6 : 1;
      const score = d * threat * (1 + off);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best ? Math.atan2(best.cy - p.cy, best.x - p.x) : moving;
  }

  private controlOnFoot(dt: number) {
    const p = this.player;
    const c = this.controls;
    const ax = c.axis();
    const sprint = c.down('sprint');
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y);
      const mag = ax.analog ? Math.min(1, len) : 1;
      const fast = sprint || (ax.analog && mag > 0.95);
      p.walk(Math.atan2(ax.y, ax.x), (fast ? 96 : 64) * mag);
      p.running = fast;
    } else p.stop();

    const spec = WEAPONS[p.weapon];
    const mouseAim = settingsStore.getState().mouseAim && !settingsStore.getState().touchControls && performance.now() - c.mouse.movedAt < 4000;
    let aim: number;
    if (mouseAim) {
      const wp = this.cameras.main.getWorldPoint(c.mouse.x, c.mouse.y);
      aim = Math.atan2(wp.y - p.cy, wp.x - p.x);
      if (this.now >= p.swingUntil) p.faceAngle(aim);
    } else aim = this.autoAim(p, spec.melee ? 30 : 150);
    p.aim = aim;

    const auto = p.weapon === 'smg';
    if (auto ? c.down('attack') : c.pressed('attack')) {
      if (!attack(this, p, aim) && !auto) this.refreshPlayerWeapon();
      if (game.data.current !== p.weapon) this.refreshPlayerWeapon();
    }
    if (c.pressed('weapon')) {
      game.cycleWeapon();
      this.refreshPlayerWeapon();
      sfx('move');
      ui.toast(WEAPONS[game.data.current].name, 'info', 1000);
    }
    if (c.pressed('eat')) this.eat();
    p.step(dt);
  }

  private eat() {
    const items = game.data.items;
    const id = (['burger', 'chips', 'pint', 'medkit'] as const).find((i) => (items[i] ?? 0) > 0);
    if (!id) {
      ui.toast('Nothing to eat.', 'warn', 1200);
      return sfx('deny');
    }
    if (game.data.health >= game.data.maxHealth) return ui.toast('You\'re not hungry.', 'info', 1200);
    const heal = { burger: 30, chips: 40, pint: 10, medkit: 70 }[id];
    game.update((d) => (d.items[id] = (d.items[id] ?? 1) - 1));
    game.heal(heal);
    sfx('eat');
    this.fx.number(this.player.x, this.player.y - 18, `+${heal}`, '#8ad06a');
  }

  private controlCar(dt: number) {
    const car = this.player.car!;
    const c = this.controls;
    let throttle = (c.down('up') ? 1 : 0) - (c.down('down') ? 1 : 0);
    let steer = (c.down('right') ? 1 : 0) - (c.down('left') ? 1 : 0);
    const ax = c.axis();
    if (ax.analog) {
      // Point the stick where you want to go; the car turns to follow.
      const mag = Math.min(1, Math.hypot(ax.x, ax.y));
      const diff = Phaser.Math.Angle.Wrap(Math.atan2(ax.y, ax.x) - car.angle);
      if (Math.abs(diff) > 2.2 && car.speed < 35) {
        throttle = -mag;
        steer = 0;
      } else {
        throttle = mag;
        steer = Phaser.Math.Clamp(diff * 2.4, -1, 1);
      }
    }
    car.input.throttle = throttle;
    car.input.steer = steer;
    car.input.handbrake = c.down('handbrake');
    if (c.pressed('horn')) {
      sfx('horn');
      this.crime('assault', this.player, car.x, car.y, undefined, 0);
    }
    if (c.pressed('radio')) this.tuneRadio(1);
    if (c.pressed('interact')) this.exitCar();
    void dt;
  }

  private tuneRadio(dir: number) {
    this.station = (this.station + dir + STATIONS.length + 1) % (STATIONS.length + 1);
    if (this.station === STATIONS.length) {
      playMusic(null);
      ui.set({ station: 'Radio off' });
      ui.toast('Radio off', 'radio', 1500);
      return;
    }
    const s = STATIONS[this.station];
    playMusic(s.track);
    ui.set({ station: s.name });
    ui.toast(`${s.name}: ${s.tag}`, 'radio', 2600);
  }

  private enterCar(car: Car) {
    const p = this.player;
    if (car.driver && car.driver !== p) {
      sfx('carjack');
      const victim = car.driver;
      this.ejectDriver(car, false);
      this.crime('carjack', p, car.x, car.y, victim, 0);
      if (victim.role === 'cop') this.crime('copAssault', p, car.x, car.y, victim, 0);
    }
    this.putInCar(p, car);
    car.ai = null;
    car.siren = false;
    if (!car.stolen) {
      car.stolen = true;
      game.update((d) => d.stats.carsStolen++);
    }
    this.cameras.main.startFollow(car.sprite, true, 0.15, 0.15);
    if (this.station >= STATIONS.length || this.station < 0) this.station = 0;
    this.tuneRadio(0);
    this.controls.suppress(200);
  }

  /** Get out of the player's car. `quiet` skips the music change (used when a job takes the car). */
  exitCar(quiet = false) {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    const spot = this.besideCar(car, p);
    car.driver = null;
    car.input = { throttle: 0, steer: 0, handbrake: true };
    p.car = null;
    p.x = spot.x;
    p.y = spot.y;
    p.sprite.setVisible(true);
    p.shadow.setVisible(true);
    p.held?.setVisible(true);
    this.cameras.main.startFollow(p.sprite, true, 0.18, 0.18);
    if (!quiet) playMusic(null);
    else playMusic(null);
    ui.set({ station: null, inCar: null });
    engineSound(false, 0);
    this.controls.suppress(200);
  }

  /** Work out what pressing interact would do right now. */
  private findInteraction(): Interaction | null {
    const p = this.player;
    if (p.dead) return null;
    if (p.car) {
      const car = p.car;
      const b = this.buildingAt(car.x, car.y);
      if (b?.kind === 'garage' && !car.isPolice && !car.wrecked) {
        const value = Math.round(CAR_SPECS[car.model].value * (0.4 + 0.6 * (car.hp / car.maxHp)));
        return { label: `Sell car $${value}`, act: () => this.sellCar(car, value) };
      }
      if (b?.kind === 'respray' && !car.wrecked) return { label: 'Respray $100', act: () => this.respray(car) };
      return { label: 'Get out', act: () => this.exitCar() };
    }
    const phone = this.jobs.phoneNear(p.x, p.y);
    if (phone) return { label: 'Answer phone', act: () => this.jobs.answer(phone) };

    // Cars first: most of what you'll want to do is nick one.
    let bestCar: Car | null = null;
    let bestD = Infinity;
    for (const c of this.cars) {
      if (c.wrecked || c.burning) continue;
      const d = Math.hypot(c.x - p.x, c.y - (p.y - 4));
      if (d < c.len / 2 + 9 && d < bestD) {
        bestD = d;
        bestCar = c;
      }
    }
    // Staff and furniture.
    for (const a of this.actors) {
      if (a.dead || a.staffOf === null || a.hostile || Math.hypot(a.x - p.x, a.y - p.y) > 26) continue;
      const b = this.city.buildings[a.staffOf];
      const label = SHOP_LABEL[b.kind];
      if (label) return { label, act: () => this.openShop(b) };
    }
    for (const prop of this.propsNear(p.x, p.y - 4, 20)) {
      const b = prop.building !== undefined ? this.city.buildings[prop.building] : undefined;
      if (prop.kind === 'register' && b && !this.robbed.has(prop.id)) {
        const staff = this.actors.find((a) => a.staffOf === b.id && !a.dead);
        if (!staff || p.weapon !== 'fists') return { label: 'Rob the till', act: () => this.rob(prop, b, staff ?? null) };
      }
      if (prop.kind === 'safe' && !this.robbed.has(prop.id)) return { label: 'Crack the safe', act: () => this.crackSafe(prop) };
      if (prop.kind === 'bed' && b?.kind === 'safehouse') return { label: 'Sleep and save', act: () => worldBridge.save?.() };
      if (prop.kind === 'wardrobe' && b?.kind === 'safehouse') return { label: 'Change clothes', act: () => ui.open('wardrobe') };
    }
    if (bestCar) return { label: bestCar.driver ? 'Carjack' : 'Get in', act: () => this.enterCar(bestCar!) };
    return null;
  }

  private propsNear(x: number, y: number, r: number): Prop[] {
    const out: Prop[] = [];
    const cx = Math.floor(x / TILE / 32);
    const cy = Math.floor(y / TILE / 32);
    for (let j = cy - 1; j <= cy + 1; j++)
      for (let i = cx - 1; i <= cx + 1; i++)
        for (const p of this.city.propsByChunk.get(j * 1000 + i) ?? []) {
          const px = (p.tx + p.tw / 2) * TILE;
          const py = (p.ty + p.th / 2) * TILE;
          if (Math.hypot(px - x, py - y) < r) out.push(p);
        }
    return out.sort((a, b) => Math.hypot((a.tx + 0.5) * TILE - x, (a.ty + 0.5) * TILE - y) - Math.hypot((b.tx + 0.5) * TILE - x, (b.ty + 0.5) * TILE - y));
  }

  buildingAt(x: number, y: number): Building | null {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.city.W || ty >= this.city.H) return null;
    const id = this.city.bld[ty * this.city.W + tx];
    return id ? this.city.buildings[id - 1] : null;
  }

  private openShop(b: Building) {
    sfx('select');
    ui.set({ shop: { buildingId: b.id, kind: b.kind, name: b.name } });
    ui.open('shop');
  }

  private rob(prop: Prop, b: Building, staff: Actor | null) {
    this.robbed.add(prop.id);
    const cash = 40 + Math.floor(Math.random() * 110) + (b.kind === 'bank' ? 300 : 0);
    game.addCash(cash);
    sfx('cash');
    this.fx.number(this.player.x, this.player.y - 18, `+$${cash}`, '#8ad06a');
    this.crime('robbery', this.player, this.player.x, this.player.y, staff ?? undefined, 0);
    if (staff) {
      staff.reportAt = this.now + 1500;
      if (b.kind === 'shop_guns' || staff.tough) {
        staff.target = this.player;
        staff.state = 'fight';
        staff.hostile = true;
      } else staff.state = 'cower';
    }
  }

  private crackSafe(prop: Prop) {
    this.robbed.add(prop.id);
    const b = prop.building !== undefined ? this.city.buildings[prop.building] : undefined;
    const cash = (b?.kind === 'bank' ? 400 : b?.kind === 'gang_hq' ? 300 : 80) + Math.floor(Math.random() * 150);
    game.addCash(cash);
    sfx('cash');
    this.fx.number(this.player.x, this.player.y - 18, `+$${cash}`, '#8ad06a');
    this.crime('robbery', this.player, this.player.x, this.player.y, undefined, 0);
    if (b?.gang) game.respect(b.gang, -10);
  }

  private sellCar(car: Car, value: number) {
    this.exitCar();
    car.persistent = false;
    this.removeCar(car);
    game.addCash(value);
    sfx('cash');
    ui.bigText(`+$${value}`, '#8ad06a', 'No questions asked');
  }

  private respray(car: Car) {
    if (!game.spend(100)) {
      sfx('deny');
      return ui.toast('Respray costs $100.', 'warn');
    }
    sfx('spray');
    const colour = (car.colour + 1 + Math.floor(Math.random() * 8)) % 10;
    car.colour = colour;
    car.sprite.setFrame(car.isPolice || car.model === 'taxi' || car.model === 'ambulance' ? car.sprite.frame.name : `car_${car.model}_${colour}`);
    car.hp = car.maxHp;
    car.burning = false;
    this.police.clear();
    ui.bigText('FRESH PAINT', '#4fe8ff', 'Wanted level cleared, car repaired');
  }

  /** Health hit zero: wasted, or busted if the police were after you. */
  playerDown(by: Actor | null) {
    const p = this.player;
    if (this.downAt) return;
    const busted = this.police.wanted > 0 || by?.role === 'cop';
    this.downAt = this.now;
    if (p.car) this.exitCar();
    p.die(this, 0);
    engineSound(false, 0);
    sfx(busted ? 'busted' : 'wasted');
    ui.bigText(busted ? 'BUSTED' : 'WASTED', busted ? '#4a8fe0' : '#d64545', busted ? 'Lost your guns and a bit of cash' : 'Lost a bit of cash', 3000);
    if (game.data.job) this.jobs.fail(busted ? 'You got nicked.' : 'You got wasted.', true);
    this.respawnAt = this.now + 3200;
    this.respawnBusted = busted;
    game.update((d) => (busted ? d.stats.busted++ : d.stats.wasted++));
  }

  private respawnAt = 0;
  private respawnBusted = false;

  private respawn() {
    const busted = this.respawnBusted;
    this.respawnAt = 0;
    this.downAt = 0;
    const kind = busted ? 'police' : 'hospital';
    const b = this.city.buildings.find((x) => x.kind === kind) ?? this.city.buildings[0];
    const v = { n: [0, -2], s: [0, 2], w: [-2, 0], e: [2, 0] }[b.door.side];
    game.update((d) => {
      d.health = d.maxHealth;
      d.cash = Math.max(0, Math.floor(d.cash * 0.9) - (busted ? 0 : 20));
      if (busted) {
        d.weapons = {};
        d.current = 'fists';
      }
    });
    this.police.clear();
    const old = this.player;
    const look = PLAYER_OUTFITS[game.data.outfit] ?? PLAYER_OUTFITS[0];
    const p = new Actor(this, look, (b.door.x + v[0]) * TILE + 8, (b.door.y + v[1]) * TILE + 12, 'player', 100);
    this.actors[this.actors.indexOf(old)] = p;
    old.role = 'civ';
    old.persistent = false;
    this.actors.push(old);
    this.player = p;
    this.refreshPlayerWeapon();
    this.cameras.main.startFollow(p.sprite, true, 0.18, 0.18);
    this.cameras.main.centerOn(p.x, p.y);
    for (const a of this.actors) if (a.target === old) a.target = null;
  }

  // ---- Simulation ---------------------------------------------------------------------

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.controls.tick();
    const paused = uiStore.getState().modal !== null;
    const cam = this.cameras.main;
    this.chunks.update(cam.worldView);
    if (paused) {
      engineSound(false, 0);
      sirenSound(0);
      this.renderLights();
      return;
    }
    const p = this.player;

    if (this.respawnAt && this.now > this.respawnAt) this.respawn();
    if (!p.dead) {
      if (p.car) this.controlCar(dt);
      else this.controlOnFoot(dt);
      this.interaction = this.findInteraction();
      if (!p.car && this.interaction && this.controls.pressed('interact')) this.interaction.act();
      else if (p.car && this.interaction && this.interaction.label !== 'Get out' && this.controls.pressed('interact')) this.interaction.act();
    } else this.interaction = null;

    // People.
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    for (const a of this.actors) {
      if (a === p || a.car) continue;
      if (Math.hypot(a.x - px, a.y - py) > 640) continue;
      updateNpc(this, a, dt);
    }

    // Cars.
    for (const c of [...this.cars]) {
      if (Math.hypot(c.x - px, c.y - py) > 900 && c !== p.car) continue;
      if (c.ai && c.driver && c.driver !== p && !c.wrecked) {
        if (c.ai.kind === 'traffic') {
          if (!c.ai.path.length) c.ai.dir = reroute(this, c.ai.dir, c.x, c.y);
          driveTraffic(this, c, dt);
        } else if (c.ai.kind === 'pursuit') {
          const tx = p.car ? p.car.x : p.x;
          const ty = p.car ? p.car.y : p.y;
          drivePursuit(this, c, tx, ty, dt);
          // Close enough on foot: out they get.
          if (!p.car && Math.hypot(tx - c.x, ty - c.y) < 70 && Math.abs(c.speed) < 30) {
            const cop = c.driver;
            this.ejectDriver(c, false);
            cop.state = 'fight';
            cop.target = p;
            cop.responder = true;
            c.siren = true;
          }
        }
      }
      c.step(dt);
      if (c.burning) {
        if (this.now % 80 < 20) this.fx.fire(c.x, c.y);
        if (this.now > c.burnUntil) {
          if (c.driver === p) this.exitCar();
          c.wreck();
          this.explode(c.x, c.y, null);
        }
      } else if (!c.wrecked && c.hp < c.maxHp * 0.4 && this.now - c.lastSmokeAt > 160) {
        c.lastSmokeAt = this.now;
        const f = c.local(c.len * 0.35, 0);
        this.fx.smoke(f.x, f.y, 1, c.hp < c.maxHp * 0.2);
      }
    }
    this.collide();
    this.doors();
    collectPickups(this);
    this.police.update();
    this.population.update();
    this.jobs.update(dt);

    // Prune old crimes.
    const cutoff = this.now - 1500;
    if (this.crimes.length && this.crimes[0].at < cutoff) this.crimes = this.crimes.filter((c) => c.at >= cutoff);
    // Old decals fade away.
    if (this.decals.length > 220) for (const d of this.decals.splice(0, this.decals.length - 220)) d.obj.destroy();

    for (const a of this.actors) a.sync();
    this.tickClock(dt);
    this.updateCamera(dt);
    this.updateArrow();
    this.updateSounds();
    this.renderLights();
    this.syncHud();
  }

  /** Bumping: cars into cars, cars into people, people into people. */
  private collide() {
    const p = this.player;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const cc = c.circles();
      const cs = c.absSpeed;
      for (const a of this.actors) {
        if (a.dead || a.car) continue;
        for (const [x, y, r] of cc) {
          const dx = a.x - x;
          const dy = a.y - 3 - y;
          const d = Math.hypot(dx, dy);
          if (d >= r + 4 || d === 0) continue;
          const nx = dx / d;
          const ny = dy / d;
          if (cs > 55 && a !== p && c.driver !== a) {
            this.hurtActor(a, cs * 0.45, x - c.vx, y - c.vy, c.driver, cs * 1.2);
            if (c.driver) this.crime('roadkill', c.driver, a.x, a.y, a, 0);
            c.vx *= 0.85;
            c.vy *= 0.85;
          } else if (cs > 80 && a === p && c.driver !== p) {
            this.hurtActor(a, cs * 0.25, x - c.vx, y - c.vy, c.driver, cs);
          }
          a.move(nx * (r + 4 - d), ny * (r + 4 - d));
        }
      }
      for (let j = i + 1; j < this.cars.length; j++) {
        const o = this.cars[j];
        if (Math.abs(o.x - c.x) > 40 || Math.abs(o.y - c.y) > 40) continue;
        for (const [x1, y1, r1] of cc)
          for (const [x2, y2, r2] of o.circles()) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const d = Math.hypot(dx, dy);
            if (d >= r1 + r2 || d === 0) continue;
            const nx = dx / d;
            const ny = dy / d;
            const push = (r1 + r2 - d) / 2;
            c.x -= nx * push;
            c.y -= ny * push;
            o.x += nx * push;
            o.y += ny * push;
            const vn = (o.vx - c.vx) * nx + (o.vy - c.vy) * ny;
            if (vn < 0) {
              const j2 = -vn * 0.65;
              c.vx -= nx * j2;
              c.vy -= ny * j2;
              o.vx += nx * j2;
              o.vy += ny * j2;
              c.impact(-vn, o);
              o.impact(-vn, c);
              if (c.driver === p || o.driver === p) {
                const other = c.driver === p ? o : c;
                if (other.driver && -vn > 50) this.crime(other.isPolice ? 'copAssault' : 'assault', p, other.x, other.y, other.driver, 0);
              }
            }
          }
      }
    }
    // People don't walk through each other.
    const live = this.actors.filter((a) => !a.dead && !a.car);
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) > 7 || Math.abs(dy) > 7) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= 7) continue;
        const push = (7 - d) / 2;
        a.move((-dx / d) * push, (-dy / d) * push);
        b.move((dx / d) * push, (dy / d) * push);
      }
  }

  private doors() {
    for (const d of this.chunks.doors.values()) {
      const x = d.prop.tx * TILE + 8;
      const y = d.prop.ty * TILE + 8;
      let near = false;
      for (const a of this.actors) {
        if (a.dead || a.car) continue;
        if (Math.abs(a.x - x) < 13 && Math.abs(a.y - 4 - y) < 13) {
          near = true;
          break;
        }
      }
      if (near) {
        d.closeAt = this.now + 400;
        if (!d.open) {
          d.open = true;
          d.sprite.setFrame(d.prop.variant === 0 ? 'door_h_open' : 'door_v_open');
          const v = distVol(this, x, y, 140);
          if (v > 0) sfx('door', v);
        }
      } else if (d.open && this.now > d.closeAt) {
        d.open = false;
        d.sprite.setFrame(d.prop.variant === 0 ? 'door_h' : 'door_v');
      }
    }
  }

  private tickClock(dt: number) {
    this.clockAcc += dt;
    if (this.clockAcc >= 1) {
      const n = Math.floor(this.clockAcc);
      this.clockAcc -= n;
      game.update((d) => {
        d.clock += n;
        d.stats.playtimeMs += n * 1000;
        if (d.clock >= 1440) {
          d.clock -= 1440;
          d.day++;
        }
      });
    }
    const h = game.data.clock / 60;
    let dark: number;
    if (h >= 21 || h < 5) dark = 0.8;
    else if (h >= 18.5) dark = Phaser.Math.Linear(0.05, 0.8, (h - 18.5) / 2.5);
    else if (h < 7) dark = Phaser.Math.Linear(0.8, 0.05, (h - 5) / 2);
    else dark = 0.05;
    this.darkness = dark;
    this.lighting.setDarkness(dark);
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const car = p.car;
    const ratio = car ? Math.min(1, car.absSpeed / car.maxSpeed) : 0;
    const want = fitZoom(this, car ? 15 + ratio * 8 : 12);
    this.zoom += (want - this.zoom) * Math.min(1, dt * 1.6);
    this.cameras.main.setZoom(this.zoom);
  }

  private updateArrow() {
    const t = this.pointTarget;
    const p = this.player;
    const view = this.cameras.main.worldView;
    if (!t || p.dead) {
      this.arrow.setVisible(false);
      this.ring.setVisible(false);
      return;
    }
    const sx = p.car ? p.car.x : p.x;
    const sy = p.car ? p.car.y : p.y - 8;
    const onScreen = view.contains(t.x, t.y);
    this.ring.setVisible(onScreen).setPosition(t.x, t.y);
    const ang = Math.atan2(t.y - sy, t.x - sx);
    const r = p.car ? 26 : 18;
    this.arrow.setVisible(!onScreen || Math.hypot(t.x - sx, t.y - sy) > 60).setPosition(sx + Math.cos(ang) * r, sy + Math.sin(ang) * r).setRotation(ang);
  }

  private updateSounds() {
    const p = this.player;
    if (p.car && !p.car.wrecked) engineSound(true, p.car.speed / p.car.maxSpeed);
    else engineSound(false, 0);
    let siren = 0;
    const sx = p.car ? p.car.x : p.x;
    const sy = p.car ? p.car.y : p.y;
    for (const c of this.cars) if (c.siren && !c.wrecked) siren = Math.max(siren, 1 - Math.hypot(c.x - sx, c.y - sy) / 420);
    sirenSound(siren);
  }

  private renderLights() {
    const lights: Light[] = [];
    const night = this.darkness > 0.25;
    const t = this.now;
    if (this.darkness > 0.02) {
      for (const l of this.chunks.lights) {
        if (l.night && !night) continue;
        lights.push({ x: l.x, y: l.y, radius: l.radius, color: l.color, intensity: l.flicker ? l.intensity * (0.82 + 0.18 * Math.sin(t / 90 + l.x)) : l.intensity });
      }
      for (const c of this.cars) {
        if (c.wrecked) continue;
        if (c.driver && night) {
          const f = c.local(c.len / 2, 0);
          lights.push({ x: f.x, y: f.y, radius: 78, color: 0xfff0c8, intensity: 0.85, shape: 'cone', angle: c.angle });
          const r1 = c.local(-c.len / 2, -c.wid * 0.3);
          const r2 = c.local(-c.len / 2, c.wid * 0.3);
          lights.push({ x: r1.x, y: r1.y, radius: 7, color: 0xff3030, intensity: 0.8 });
          lights.push({ x: r2.x, y: r2.y, radius: 7, color: 0xff3030, intensity: 0.8 });
        }
        if (c.siren) {
          const red = Math.floor(t / 170) % 2 === 0;
          lights.push({ x: c.x, y: c.y, radius: 46, color: red ? 0xff3040 : 0x3070ff, intensity: 1.1 });
        }
        if (c.burning) lights.push({ x: c.x, y: c.y, radius: 44, color: 0xff8a3a, intensity: 0.9 + Math.random() * 0.2 });
      }
      const p = this.player;
      if (!p.car && !p.dead) lights.push({ x: p.x, y: p.y - 6, radius: 34, color: 0xffe6c0, intensity: 0.4 });
    }
    this.flashes = this.flashes.filter((f) => f.until > t);
    lights.push(...this.flashes);
    this.lighting.render(lights, this.cameras.main.worldView);
  }

  private syncHud() {
    if (this.now < this.hudAt) return;
    this.hudAt = this.now + 100;
    const p = this.player;
    const car = p.car;
    const prompt = this.interaction?.label ?? null;
    const s = uiStore.getState();
    const inCar = car ? { name: CAR_SPECS[car.model].name, hp: Math.max(0, car.hp / car.maxHp) } : null;
    const patch: Partial<typeof s> = {
      player: { x: car ? car.x : p.x, y: car ? car.y : p.y },
    };
    if (s.prompt !== prompt) patch.prompt = prompt;
    if (JSON.stringify(s.inCar) !== JSON.stringify(inCar)) patch.inCar = inCar;
    ui.set(patch);
  }

  /** Is this tile somewhere you can stand? (for job and spawn helpers) */
  walkable(tx: number, ty: number) {
    const k = kindAt(this.city, tx, ty);
    return k !== T.WATER && !(blockAt(this.city, tx, ty) & B.PED);
  }

  dropCash(x: number, y: number, amount: number) {
    dropPickup(this, 'cash', x, y, amount);
  }
}
