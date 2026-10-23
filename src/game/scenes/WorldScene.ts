import Phaser from 'phaser';
import { BOSSES, ENEMIES } from '../../data/enemies';
import { ITEMS } from '../../data/items';
import type { Dialogue } from '../../data/dialogue';
import type { BossId, MarkerDef } from '../../data/maps/types';
import { catDialogue, hearthDialogue, NPCS } from '../../data/npcs';
import { embersPlaced } from '../../data/quests';
import { bus } from '../../state/bus';
import { game } from '../../state/gameStore';
import { autosave, saveNow, talk, worldBridge } from '../../state/session';
import type { Facing, ZoneId } from '../../state/types';
import { ui, uiStore } from '../../state/uiStore';
import { playMusic, sfx } from '../audio';
import { Boss, createBoss } from '../entities/bosses';
import { Enemy } from '../entities/Enemy';
import { Npc } from '../entities/Npc';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Fx } from '../fx';
import { Controls } from '../input';
import { ATLAS } from '../textures';
import { Hearth } from '../world/hearth';
import { Level } from '../world/Level';
import type { Light } from '../world/Lighting';
import { TERRAIN } from '../world/legend';
import { tileAt, type TilePos } from '../world/parse';
import { TILE } from '../world/render';
import type { ShotOptions, World } from '../world/types';
import { fitZoom } from './zoom';

interface Interactable {
  x: number;
  y: number;
  label: () => string;
  act: () => void;
  enabled?: () => boolean;
}

interface Exit {
  rect: Phaser.Geom.Rectangle;
  to: ZoneId;
  spawn: string;
  enabled: () => boolean;
}

interface Seal {
  boss: BossId;
  tiles: TilePos[];
  sprites: Phaser.GameObjects.Image[];
}

const EMBER_ABILITY = { verdant_ember: 'bolt', stone_ember: 'dash', tide_ember: 'radiance' } as const;

const BOSS_INTROS: Record<BossId, Dialogue> = {
  thornmother: {
    lines: [
      { who: '', text: 'The flowers in the clearing turn, all at once, to face you.' },
      { who: 'The Thornmother', portrait: 'thornmother_0', text: 'Little spark. Little warm thing. Come closer.' },
      { who: 'The Thornmother', portrait: 'thornmother_0', text: "You'll make such lovely mulch." },
    ],
  },
  colossus: {
    lines: [
      { who: '', text: 'Something vast unfolds from the rock wall. Rust flakes from it like snow.' },
      { who: '', text: 'In its chest, wedged among the gears, the Stone Ember glows like a forge.' },
    ],
  },
  abbess: {
    lines: [
      { who: '', text: 'The water in the apse rises without a ripple. Somebody is singing.' },
      { who: 'The Drowned Abbess', portrait: 'abbess_0', text: 'Hush now, child. The tide is singing.' },
      { who: 'The Drowned Abbess', portrait: 'abbess_0', text: "Won't you sing with us? Forever and ever, beneath the sea?" },
    ],
  },
  hollow_king: {
    lines: [
      { who: 'The Hollow King', portrait: 'hollow_king_0', text: 'So. The last Keeper sends a child with a candle.' },
      { who: 'The Hollow King', portrait: 'hollow_king_0', text: 'I was a Keeper once. I held that light for a hundred years, and do you know what it gave me?' },
      { who: 'The Hollow King', portrait: 'hollow_king_0', text: 'Nothing. Not a single thing. Put it out, child. Rest.' },
    ],
  },
};

export class WorldScene extends Phaser.Scene implements World {
  level!: Level;
  player!: Player;
  fx!: Fx;
  enemies!: Phaser.GameObjects.Group;
  dynamicLights: Light[] = [];
  arenaBounds: Phaser.Geom.Rectangle | null = null;

  private zone!: ZoneId;
  private controls!: Controls;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: Npc[] = [];
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private bolts!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private brambles!: Phaser.Physics.Arcade.StaticGroup;
  private interactables: Interactable[] = [];
  private exits: Exit[] = [];
  private exitsArmed = false;
  private transitioning = false;
  private hearth?: Hearth;
  private portal?: Phaser.GameObjects.Image;
  private seals: Seal[] = [];
  private boss?: Boss;
  private bossArena?: Phaser.Geom.Rectangle;
  private explored!: Uint8Array;
  private lastTile = -1;
  private playtimeAcc = 0;
  private syncTimer = 0;
  private uiTimer = 0;
  private unsub: (() => void)[] = [];
  private talkingTo?: Npc;
  private paused = false;

  constructor() {
    super('world');
  }

  init() {
    this.npcs = [];
    this.interactables = [];
    this.exits = [];
    this.seals = [];
    this.dynamicLights = [];
    this.boss = undefined;
    this.bossArena = undefined;
    this.arenaBounds = null;
    this.hearth = undefined;
    this.portal = undefined;
    this.exitsArmed = false;
    this.transitioning = false;
    this.talkingTo = undefined;
    this.paused = false;
    this.lastTile = -1;
  }

  create(data: { spawn?: string }) {
    const d = game.data;
    this.zone = d.zone;
    this.level = new Level(this, this.zone);
    this.fx = new Fx(this);
    this.controls = new Controls(this);
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height);

    this.solids = this.physics.add.staticGroup();
    this.brambles = this.physics.add.staticGroup();
    this.enemies = this.add.group();
    this.enemyShots = this.physics.add.group();
    this.bolts = this.physics.add.group();
    this.pickups = this.physics.add.group();

    // Player placement: explicit spawn, saved position, or the zone's entry.
    const map = this.level.map;
    let px: number;
    let py: number;
    let facing: Facing = 'down';
    const spawn = data.spawn ? map.spawns[data.spawn] : undefined;
    if (spawn) {
      px = spawn.x * TILE + 8;
      py = spawn.y * TILE + 6;
    } else if (d.pos) {
      px = d.pos.x;
      py = d.pos.y;
      facing = d.pos.facing;
    } else {
      const s = map.spawns[d.entry.zone === this.zone ? d.entry.spawn : ''] ?? Object.values(map.spawns)[0];
      px = s.x * TILE + 8;
      py = s.y * TILE + 6;
    }
    if (data.spawn) facing = this.facingForSpawn(px, py);
    this.player = new Player(this, px, py, facing, this.controls);

    this.buildObjects();
    this.buildExits();
    this.buildArena();

    this.physics.add.collider(this.player, this.level.walls);
    this.physics.add.collider(this.player, this.level.liquids);
    this.physics.add.collider(this.player, this.level.gaps, undefined, () => !this.player.isDashing);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.brambles);
    for (const n of this.npcs) this.physics.add.collider(this.player, n);

    const groundEnemy = (e: object) => !(e as Enemy).def.flying;
    const solidEnemy = (e: object) => !(e as Enemy).def.ghost;
    this.physics.add.collider(this.enemies, this.level.walls, undefined, (e) => solidEnemy(e));
    this.physics.add.collider(this.enemies, this.level.liquids, undefined, (e) => groundEnemy(e));
    this.physics.add.collider(this.enemies, this.level.gaps, undefined, (e) => groundEnemy(e));
    this.physics.add.collider(this.enemies, this.solids, undefined, (e) => solidEnemy(e));
    this.physics.add.collider(this.enemies, this.brambles, undefined, (e) => solidEnemy(e));
    // Phaser may hand overlap pairs back in either order, so pick objects out by type.
    const pick = <T>(a: unknown, b: unknown, cls: abstract new (...args: never[]) => T): T | undefined => (a instanceof cls ? a : b instanceof cls ? b : undefined);

    this.physics.add.overlap(this.player, this.enemies, (a, b) => {
      const e = pick(a, b, Enemy);
      if (e) this.onEnemyContact(e);
    });
    this.physics.add.collider(this.enemyShots, this.level.walls, (a, b) => {
      const shot = pick(a, b, Projectile);
      if (shot && !shot.ghost) shot.pop();
    });
    this.physics.add.overlap(this.player, this.enemyShots, (a, b) => {
      const shot = pick(a, b, Projectile);
      if (!shot?.active || this.player.isInvulnerable) return;
      this.hurtPlayer(shot.damage, shot.x, shot.y);
      shot.pop();
    });
    this.physics.add.collider(this.bolts, this.level.walls, (a, b) => pick(a, b, Projectile)?.pop());
    this.physics.add.collider(this.bolts, this.solids, (a, b) => pick(a, b, Projectile)?.pop());
    this.physics.add.overlap(this.bolts, this.enemies, (a, b) => {
      const bolt = pick(a, b, Projectile);
      const enemy = pick(a, b, Enemy);
      if (!bolt?.active || !enemy || enemy.dead) return;
      this.hitEnemy(enemy, bolt.damage, bolt.x, bolt.y, 0.6);
      this.fx.burst(bolt.x, bolt.y, [0xffd56b, 0xf2a33a, 0xd64545], 10, 50);
      bolt.pop();
    });
    this.physics.add.overlap(this.bolts, this.brambles, (a, b) => {
      const bolt = pick(a, b, Projectile);
      if (!bolt?.active) return;
      const bramble = (a === bolt ? b : a) as Phaser.Physics.Arcade.Image;
      bolt.pop();
      this.burnBramble(bramble);
    });
    this.physics.add.overlap(this.player, this.pickups, (a, b) => {
      const it = pick(a, b, Pickup);
      if (it) this.collect(it);
    });

    this.spawnEnemies();

    // Camera.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.level.width, this.level.height);
    cam.startFollow(this.player, false, 0.14, 0.14);
    cam.setZoom(fitZoom(this));
    cam.setBackgroundColor('#0b0a12');
    cam.fadeIn(350, 11, 10, 18);
    this.scale.on('resize', this.onResize, this);

    this.updateDarkness();
    this.loadExplored();

    // Hooks for the UI.
    worldBridge.getPlayerPos = () => ({ x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.player.facing });
    worldBridge.flush = () => this.flushProgress();
    this.unsub.push(
      uiStore.subscribe((s, prev) => {
        if (s.modal !== prev.modal) this.onModalChange(s.modal !== null);
      }),
      bus.on('levelUp', () => {
        sfx('levelup');
        this.fx.glow(this.player.x, this.player.y, [0xffd56b, 0xfff3b0], 30, 50);
        this.fx.ring(this.player.x, this.player.y, 36, 0xffd56b);
      }),
      bus.on('equipmentChanged', () => this.updateDarkness()),
      bus.on('dialogueEnded', () => {
        this.talkingTo?.setTalking(false);
        this.talkingTo = undefined;
      }),
    );
    this.events.once('shutdown', () => this.cleanup());

    playMusic(this.level.map.def.music);
    if (data.spawn || !game.flag(`visited:${this.zone}`)) ui.banner(this.level.map.def.name, this.level.map.def.subtitle);
    game.setFlag(`visited:${this.zone}`);

    if (this.zone === 'village' && !game.flag('intro_done')) this.time.delayedCall(700, () => this.playIntro());
  }

  private facingForSpawn(px: number, py: number): Facing {
    const cx = this.level.width / 2;
    const cy = this.level.height / 2;
    const dx = cx - px;
    const dy = cy - py;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  private onResize() {
    this.cameras.main.setZoom(fitZoom(this));
  }

  private cleanup() {
    this.flushProgress();
    this.scale.off('resize', this.onResize, this);
    for (const u of this.unsub) u();
    this.unsub = [];
    worldBridge.getPlayerPos = null;
    worldBridge.flush = null;
    ui.setPrompt(null);
    this.level.destroy();
  }

  isPaused() {
    return this.paused;
  }

  private onModalChange(open: boolean) {
    if (open && !this.paused) {
      this.paused = true;
      this.player.setVelocity(0, 0);
      ui.setPrompt(null);
      this.scene.pause();
    } else if (!open && this.paused) {
      this.paused = false;
      this.controls.suppress(180);
      this.scene.resume();
    }
  }

  // ---- Building the zone ---------------------------------------------------------

  private worldPos(t: TilePos) {
    return { x: t.x * TILE + 8, y: t.y * TILE + 8 };
  }

  private buildObjects() {
    const d = game.data;
    for (const o of this.level.map.objects) {
      const { x, y } = this.worldPos(o);
      const m = o.def;
      switch (m.type) {
        case 'npc': {
          const def = NPCS[m.id];
          if (!def || (def.visible && !def.visible())) break;
          const npc = new Npc(this, x, y - 2, def);
          this.npcs.push(npc);
          this.interactables.push({
            x: npc.x,
            y: npc.y + 4,
            label: () => (def.sprite === 'cat' ? 'Pet' : 'Talk'),
            act: () => {
              npc.faceToward(this.player.x, this.player.y);
              npc.setTalking(true);
              this.talkingTo = npc;
              talk(def.talk(), def.name, def.sprite === 'cat' ? 'cat_0' : `${def.sprite}_down_idle`);
            },
          });
          break;
        }
        case 'chest':
          this.makeChest(o.ch, m, x, y);
          break;
        case 'sign': {
          const img = this.solids.create(x, y - 2, ATLAS, 'sign') as Phaser.Physics.Arcade.Image;
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(12, 8).setOffset(2, 9);
          img.setDepth(y + 6);
          this.interactables.push({ x, y, label: () => 'Read', act: () => talk({ lines: m.text.map((t) => ({ who: '', text: t })) }) });
          break;
        }
        case 'glowcap':
          if (!d.flags[`glowcap:${m.id}`]) {
            const p = new Pickup(this, x, y, 'glowcap', 1, m.id);
            this.pickups.add(p);
            this.dynamicLights.push({ x, y, radius: 22, color: 0x80ffe0, intensity: 0.8 });
          }
          break;
        case 'gate':
          if (!d.flags[`gate:${m.id}`]) this.makeGate(m.id, m.key, x, y);
          break;
        case 'hearth':
          this.hearth = new Hearth(this, x, y, embersPlaced(d));
          this.solids.add(this.hearth.base);
          this.interactables.push({ x, y: y - 2, label: () => 'Hearthlight', act: () => this.useHearth() });
          break;
        case 'cat':
          if (!d.flags['cat_found']) {
            const cat = this.physics.add.staticSprite(x, y, ATLAS, 'cat_0').play('cat_idle').setDepth(y + 6);
            (cat.body as Phaser.Physics.Arcade.StaticBody).setSize(10, 7).setOffset(3, 9);
            this.solids.add(cat);
            this.interactables.push({
              x,
              y,
              label: () => 'Whiskers?',
              enabled: () => cat.active,
              act: () => {
                talk(catDialogue(), 'Whiskers', 'cat_0');
                const off = bus.on('dialogueEnded', () => {
                  off();
                  this.tweens.add({ targets: cat, x: cat.x - 60, alpha: 0, duration: 900, onComplete: () => cat.destroy() });
                  (cat.body as Phaser.Physics.Arcade.StaticBody).enable = false;
                });
              },
            });
          }
          break;
        case 'boss':
          if (!d.flags[`boss:${m.boss}`]) {
            this.boss = createBoss(this, m.boss, x, y);
            this.enemies.add(this.boss);
          } else {
            const ember = BOSSES[m.boss].ember;
            if (ember && !d.flags[`ember:${ember}`]) this.spawnEmber(ember, x, y);
          }
          break;
      }
    }

    // Brambles, unless they've been burned before.
    for (const b of this.level.map.brambles) {
      if (d.flags[`bramble:${this.zone}:${b.x},${b.y}`]) continue;
      const { x, y } = this.worldPos(b);
      const img = this.brambles.create(x, y, ATLAS, 'bramble') as Phaser.Physics.Arcade.Image;
      img.setDepth(y + 6).setData('tile', b);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 14).setOffset(0, 2);
      this.interactables.push({
        x,
        y,
        label: () => (game.data.abilities.bolt ? 'Burn it! (K)' : 'Gloam-thorn'),
        enabled: () => img.active,
        act: () => {
          if (!game.data.abilities.bolt) talk({ lines: [{ who: '', text: 'A knot of black, glistening Gloam-thorn. The barbs are as long as your fingers.' }, { who: '', text: "No blade will clear this. You'd need fire." }] });
          else ui.toast('Face it and press K to cast Ember Bolt.', 'info');
        },
      });
    }

    // The shrine's seal in the village.
    if (this.zone === 'village') {
      const shrine = Object.values(this.level.map.regions).find((r) => r.def.type === 'shrine');
      if (shrine && d.flags['rift_open']) this.openShrine();
      else if (shrine) {
        const sealTile = this.findSealTile();
        if (sealTile) {
          const { x, y } = this.worldPos(sealTile);
          this.interactables.push({
            x,
            y: y + 6,
            label: () => 'Examine',
            enabled: () => !game.flag('rift_open'),
            act: () => talk({ lines: [{ who: '', text: 'An old stone door, sealed with Keeper runes. It is cold to the touch, colder than stone should be.' }, { who: '', text: 'Something on the other side is very, very patient.' }] }),
          });
        }
      }
    }
  }

  private findSealTile(): TilePos | undefined {
    const m = this.level.map;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (tileAt(m, x, y) === 'N') return { x, y };
    return undefined;
  }

  private openShrine() {
    const t = this.findSealTile();
    if (!t) return;
    this.level.setWall(t.x, t.y, false);
    const { x, y } = this.worldPos(t);
    this.portal = this.add.image(x, y - 16, ATLAS, 'portal').setDepth(y - 8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.portal, angle: 360, duration: 6000, repeat: -1 });
    this.tweens.add({ targets: this.portal, scale: { from: 0.9, to: 1.1 }, duration: 1200, yoyo: true, repeat: -1 });
    this.dynamicLights.push({ x, y: y - 16, radius: 70, color: 0xa070e0, intensity: 1.2 });
    this.add.particles(x, y - 16, ATLAS, {
      frame: 'px',
      lifespan: 1200,
      speed: { min: 10, max: 30 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      tint: [0xa070e0, 0xf0d8ff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
    }).setDepth(y);
  }

  private makeChest(ch: string, m: Extract<MarkerDef, { type: 'chest' }>, x: number, y: number) {
    const opened = !!game.flag(`chest:${m.id}`);
    const img = this.solids.create(x, y - 2, ATLAS, opened ? 'chest_open' : 'chest_closed') as Phaser.Physics.Arcade.Image;
    (img.body as Phaser.Physics.Arcade.StaticBody).setSize(14, 9).setOffset(1, 6);
    img.setDepth(y + 6);
    this.interactables.push({
      x,
      y,
      label: () => 'Open',
      enabled: () => !game.flag(`chest:${m.id}`),
      act: () => {
        game.setFlag(`chest:${m.id}`);
        game.update((d) => d.stats.chestsOpened++);
        img.setFrame('chest_open');
        sfx('chest');
        this.fx.glow(x, y - 6, [0xffd56b, 0xfff3b0], 16, 40);
        const parts: string[] = [];
        if (m.item) {
          game.giveItem(m.item, m.count ?? 1);
          parts.push(`${ITEMS[m.item].name}${(m.count ?? 1) > 1 ? ` ×${m.count}` : ''}`);
        }
        if (m.gold) {
          game.addGold(m.gold);
          ui.toast(`+${m.gold} gold`, 'item', 'icon_charm_coin');
          parts.push(`${m.gold} gold`);
        }
        if (m.item?.startsWith('key_')) {
          talk({ lines: [{ who: '', text: `You found the ${ITEMS[m.item].name}! ${ITEMS[m.item].desc}` }] });
        } else if (m.item === 'foremans_ring') {
          talk({ lines: [{ who: '', text: 'Inside, wrapped in a scrap of oilcloth: a plain gold ring, engraved "B & E".' }] });
        } else if (m.item === 'starsilver') {
          talk({ lines: [{ who: '', text: 'A lump of ore that glitters even in total darkness. Starsilver.' }, { who: '', text: 'Bram would know what to do with this.' }] });
        }
        void ch;
        void parts;
      },
    });
  }

  private makeGate(id: string, key: string, x: number, y: number) {
    const img = this.solids.create(x, y, ATLAS, 'gate') as Phaser.Physics.Arcade.Image;
    img.setDepth(y + 8);
    this.interactables.push({
      x,
      y: y + 8,
      label: () => (game.has(key) ? 'Unlock' : 'Locked'),
      enabled: () => img.active,
      act: () => {
        if (!game.has(key)) {
          sfx('deny');
          talk({ lines: [{ who: '', text: `Locked tight. You need the ${ITEMS[key].name}.` }] });
          return;
        }
        game.takeItem(key);
        game.setFlag(`gate:${id}`);
        sfx('gate');
        this.fx.smoke(x, y, 8);
        (img.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.tweens.add({ targets: img, y: y + 8, alpha: 0, duration: 500, onComplete: () => img.destroy() });
        ui.toast(`Used the ${ITEMS[key].name}.`, 'info', ITEMS[key].icon);
      },
    });
  }

  private buildExits() {
    for (const region of Object.values(this.level.map.regions)) {
      const def = region.def;
      if (def.type !== 'exit' && def.type !== 'shrine') continue;
      const xs = region.tiles.map((t) => t.x);
      const ys = region.tiles.map((t) => t.y);
      const rect = new Phaser.Geom.Rectangle(Math.min(...xs) * TILE, Math.min(...ys) * TILE, (Math.max(...xs) - Math.min(...xs) + 1) * TILE, (Math.max(...ys) - Math.min(...ys) + 1) * TILE);
      if (def.type === 'exit') this.exits.push({ rect, to: def.to, spawn: def.spawn, enabled: () => true });
      else this.exits.push({ rect, to: 'rift', spawn: 'entry', enabled: () => !!game.flag('rift_open') });
    }
  }

  private buildArena() {
    const map = this.level.map;
    for (const region of Object.values(map.regions)) {
      if (region.def.type === 'seal') this.seals.push({ boss: region.def.boss, tiles: region.tiles, sprites: [] });
      if (region.def.type === 'arena' && this.boss) {
        const xs = region.tiles.map((t) => t.x);
        const ys = region.tiles.map((t) => t.y);
        this.bossArena = new Phaser.Geom.Rectangle(Math.min(...xs) * TILE, Math.min(...ys) * TILE, (Math.max(...xs) - Math.min(...xs) + 1) * TILE, (Math.max(...ys) - Math.min(...ys) + 1) * TILE);
        this.arenaBounds = this.floodBounds(region.tiles[0]);
      }
    }
  }

  /** Bounds of the open area around a tile, not crossing seal tiles. */
  private floodBounds(start: TilePos): Phaser.Geom.Rectangle {
    const map = this.level.map;
    const sealSet = new Set(this.seals.flatMap((s) => s.tiles.map((t) => `${t.x},${t.y}`)));
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const q = [start];
    let minX = start.x;
    let maxX = start.x;
    let minY = start.y;
    let maxY = start.y;
    while (q.length && seen.size < 900) {
      const t = q.shift()!;
      minX = Math.min(minX, t.x);
      maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y);
      maxY = Math.max(maxY, t.y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = t.x + dx;
        const ny = t.y + dy;
        const k = `${nx},${ny}`;
        if (seen.has(k) || sealSet.has(k)) continue;
        if (TERRAIN[tileAt(map, nx, ny)]?.solid !== null) continue;
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    return new Phaser.Geom.Rectangle(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
  }

  private spawnEnemies() {
    for (const e of this.level.map.enemies) {
      if (!ENEMIES[e.kind]) continue;
      const { x, y } = this.worldPos(e);
      this.spawnEnemy(e.kind, x, y);
    }
  }

  spawnEnemy(kind: string, x: number, y: number): Enemy {
    const enemy = new Enemy(this, x, y, kind);
    this.enemies.add(enemy);
    return enemy;
  }

  private spawnEmber(item: string, x: number, y: number) {
    const p = new Pickup(this, x, y, 'ember', 1, item);
    this.pickups.add(p);
    const color = item === 'verdant_ember' ? 0x9fe070 : item === 'stone_ember' ? 0xf0a060 : 0x6fd0f0;
    this.dynamicLights.push({ x, y, radius: 60, color, intensity: 1.3 });
    p.setData('light', this.dynamicLights[this.dynamicLights.length - 1]);
  }

  private updateDarkness() {
    const def = this.level.map.def;
    let dark = def.darkness;
    if (this.zone === 'village') {
      const d = game.data;
      if (d.flags['dawn']) dark = 0;
      else dark = [0.74, 0.6, 0.46, 0.3][embersPlaced(d)] ?? 0.3;
    }
    this.level.lighting.setDarkness(dark);
  }

  // ---- Intro ------------------------------------------------------------------------

  private playIntro() {
    const name = game.data.playerName;
    game.setFlag('intro_done');
    game.startQuest('main', 1);
    talk(
      {
        lines: [
          { who: '', text: 'Emberhold. The last lit village in the valley. Tonight, the light is going out.' },
          { who: 'Keeper Maren', portrait: 'maren_down_idle', text: `${name}. Good, you're awake. Come and look at this.` },
          { who: 'Keeper Maren', portrait: 'maren_down_idle', text: 'Last night something came up out of the dark and tore the three Embers out of the Hearthlight. I saw a crown in the smoke.' },
          { who: 'Keeper Maren', portrait: 'maren_down_idle', text: "Without them the fire will gutter out in days, and when it does, the Gloam will walk in and make itself at home." },
          { who: 'Keeper Maren', portrait: 'maren_down_idle', text: "I'm too old to go after them. You're not. Which makes you the Keeper's apprentice in more than name, as of about now." },
          { who: 'Keeper Maren', portrait: 'maren_down_idle', text: 'The Verdant Ember fell north, into Whisperwood. Start there. Talk to folk, see Bram for a better blade, and come back alive.' },
          { who: '', text: 'Move with WASD or the arrow keys. Attack with J or Space. Talk and interact with E.' },
          { who: '', text: 'Open your bag with I, your journal with Q, the map with M, and pause with Esc.' },
        ],
      },
      'Keeper Maren',
      'maren_down_idle',
    );
  }

  // ---- Interactions --------------------------------------------------------------

  private useHearth() {
    const before = embersPlaced(game.data);
    const dialogue = hearthDialogue();
    talk(dialogue, 'The Hearthlight', 'brazier');
    if (dialogue.id === 'hearth_place') {
      const off = bus.on('dialogueEnded', () => {
        off();
        const after = embersPlaced(game.data);
        if (after > before) {
          sfx('ember');
          this.hearth?.setEmbers(after);
          this.fx.shake(300, 0.005);
          this.fx.glow(this.hearth!.light.x, this.hearth!.light.y, [0xffd56b, 0xfff3b0, 0x9fe070, 0x6fd0f0], 40, 60);
          this.updateDarkness();
          if (game.flag('rift_open') && !this.portal) {
            this.time.delayedCall(800, () => {
              sfx('roar');
              this.fx.shake(800, 0.008);
              this.openShrine();
            });
          }
          autosave();
        }
      });
    }
  }

  private nearestInteractable(): Interactable | undefined {
    const reach = this.player.reachPoint(10);
    let best: Interactable | undefined;
    let bestD = 20;
    for (const it of this.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Phaser.Math.Distance.Between(reach.x, reach.y, it.x, it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private burnBramble(br: Phaser.Physics.Arcade.Image) {
    if (!br.active) return;
    const t = br.getData('tile') as TilePos;
    game.setFlag(`bramble:${this.zone}:${t.x},${t.y}`);
    sfx('burn');
    this.fx.burst(br.x, br.y, [0xffd56b, 0xf2a33a, 0xd64545], 18, 50);
    this.fx.smoke(br.x, br.y, 8);
    (br.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.tweens.add({ targets: br, alpha: 0, scaleY: 0.3, y: br.y + 6, duration: 400, onComplete: () => br.destroy() });
    const light = { x: br.x, y: br.y, radius: 50, color: 0xff9040, intensity: 1.2 };
    this.dynamicLights.push(light);
    this.time.delayedCall(500, () => Phaser.Utils.Array.Remove(this.dynamicLights, light));
  }

  private collect(p: Pickup) {
    if (!p.active || !p.collectable) return;
    switch (p.kind) {
      case 'coin':
        game.addGold(p.value);
        sfx('coin');
        break;
      case 'heart':
        game.heal(Math.max(6, Math.round(game.stats().maxHp * 0.12)));
        sfx('heal');
        this.fx.glow(this.player.x, this.player.y, 0x8aff8a, 6);
        break;
      case 'mana':
        game.restoreMp(6);
        sfx('heal');
        this.fx.glow(this.player.x, this.player.y, 0x6fb0ff, 6);
        break;
      case 'glowcap':
        game.setFlag(`glowcap:${p.ref}`);
        game.giveItem('glowcap');
        sfx('pickup');
        this.fx.glow(p.x, p.y, [0x80ffe0, 0xffffff], 10);
        Phaser.Utils.Array.Remove(this.dynamicLights, this.dynamicLights.find((l) => l.x === p.x && l.radius === 22)!);
        if (!game.quest('glowcaps')) ui.toast('Ivo the herbalist might want these.', 'info');
        break;
      case 'ember':
        this.collectEmber(p);
        break;
    }
    p.destroy();
  }

  private collectEmber(p: Pickup) {
    const item = p.ref as keyof typeof EMBER_ABILITY;
    const light = p.getData('light') as Light | undefined;
    if (light) Phaser.Utils.Array.Remove(this.dynamicLights, light);
    game.setFlag(`ember:${item}`);
    game.giveItem(item);
    sfx('ember');
    this.fx.glow(p.x, p.y, [0xffd56b, 0xfff3b0], 40, 70);
    this.fx.ring(p.x, p.y, 50, 0xfff3b0, 600);
    const ability = EMBER_ABILITY[item];
    game.grantAbility(ability);
    const lines: Record<string, string[]> = {
      bolt: [
        'The Verdant Ember flares as your fingers close on it. Warmth floods up your arm and settles in your palm like a held breath.',
        'You have learned EMBER BOLT. Press K to hurl fire (4 MP). Fire burns Gloam-thorn.',
        'The Ember wants to go home. Carry it back to the Hearthlight in Emberhold.',
      ],
      dash: [
        'The Stone Ember is heavier than it looks, and steadier than anything you have ever held. Your feet feel sure of every step.',
        'You have learned EMBER DASH. Press Shift or L to dash. You cannot be hurt mid-dash, and you can leap short gaps.',
        'Take it back to the Hearthlight.',
      ],
      radiance: [
        'The Tide Ember is cold, then warm, then cold again, like a wave pulling at your ankles. Light gathers behind your ribs.',
        'You have learned RADIANCE. Press R to release a burst of light (12 MP) that scorches everything around you and shatters enemy shots.',
        'One Ember left to bring home. The last one.',
      ],
    };
    talk({ lines: lines[ability].map((t) => ({ who: '', text: t })) });
    autosave();
  }

  // ---- Exits ------------------------------------------------------------------------

  private checkExits() {
    if (this.transitioning) return;
    const px = this.player.body.center.x;
    const py = this.player.body.center.y;
    let inside: Exit | undefined;
    for (const e of this.exits) if (e.rect.contains(px, py) && e.enabled()) inside = e;
    if (!inside) {
      this.exitsArmed = true;
      return;
    }
    if (!this.exitsArmed) return;
    if (this.boss?.fighting) return;
    this.transitioning = true;
    this.player.freeze(true);
    const target = inside;
    this.cameras.main.fadeOut(260, 11, 10, 18);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.flushProgress();
      game.setZone(target.to, target.spawn);
      autosave();
      this.scene.restart({ spawn: target.spawn });
    });
  }

  // ---- Boss fights ------------------------------------------------------------------

  private checkArena() {
    if (!this.boss || this.boss.fighting || this.boss.dead || !this.bossArena) return;
    if (!this.bossArena.contains(this.player.body.center.x, this.player.body.center.y)) return;
    this.startBossFight();
  }

  private startBossFight() {
    const boss = this.boss!;
    const id = boss.boss.id as BossId;
    for (const s of this.seals) {
      if (s.boss !== id) continue;
      for (const t of s.tiles) {
        this.level.setWall(t.x, t.y, true);
        const { x, y } = this.worldPos(t);
        const frame = id === 'thornmother' ? 'bramble' : 'gate';
        const img = this.add.image(x, y, ATLAS, frame).setDepth(y + 8);
        if (id === 'hollow_king') img.setTint(0xa070e0);
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 300 });
        s.sprites.push(img);
        this.fx.smoke(x, y, 6);
      }
    }
    sfx('gate');
    playMusic(BOSSES[id].music);
    ui.banner(boss.boss.name, boss.boss.title);
    talk(BOSS_INTROS[id], boss.boss.name);
    const off = bus.on('dialogueEnded', () => {
      off();
      boss.start();
    });
  }

  bossDefeated(boss: Boss) {
    const id = boss.boss.id as BossId;
    game.setFlag(`boss:${id}`);
    for (const s of this.seals) {
      if (s.boss !== id) continue;
      for (const t of s.tiles) this.level.setWall(t.x, t.y, false);
      for (const img of s.sprites) this.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.destroy() });
      s.sprites = [];
    }
    ui.setBoss(null);
    if (boss.boss.xp) {
      game.gainXp(boss.boss.xp);
      this.fx.number(boss.x, boss.y - 20, `+${boss.boss.xp} XP`, '#ffd56b', true);
    }
    if (boss.boss.gold) {
      for (let i = 0; i < 8; i++) this.pickups.add(new Pickup(this, boss.x, boss.y, 'coin', Math.ceil(boss.boss.gold / 8)));
    }
    // Kill any minions left behind.
    for (const e of this.enemies.getChildren() as Enemy[]) if (!e.dead && e !== boss) e.die();
    if (id === 'hollow_king') return this.victory();
    playMusic(this.level.map.def.music);
    if (boss.boss.ember) this.spawnEmber(boss.boss.ember, boss.home.x, boss.home.y);
    autosave();
  }

  private victory() {
    playMusic('victory');
    game.completeQuest('main');
    game.setFlag('dawn');
    this.level.lighting.setDarkness(0.2);
    talk({
      lines: [
        { who: 'The Hollow King', portrait: 'hollow_king_0', text: "...Ah. It's warm. I'd forgotten it was warm." },
        { who: 'The Hollow King', portrait: 'hollow_king_0', text: 'Tell Maren... tell her I am sorry I let it go out.' },
        { who: '', text: 'The crown hits the stone and rings once, like a bell. Then the dark comes apart like wet paper, and through the rents in it you see the sky.' },
        { who: '', text: 'It is the colour of a peach. It is morning.' },
      ],
    });
    const off = bus.on('dialogueEnded', () => {
      off();
      void saveNow({ silent: true });
      this.cameras.main.fadeOut(1500, 255, 240, 210);
      this.cameras.main.once('camerafadeoutcomplete', () => ui.open('ending'));
    });
  }

  // ---- Combat hooks (World interface) ------------------------------------------------

  fireEnemyShot(x: number, y: number, angle: number, speed: number, frame: string, damage: number, opts: ShotOptions = {}) {
    const shot = new Projectile(this, x, y, angle, speed, frame, damage, opts);
    this.enemyShots.add(shot);
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  fireBolt(x: number, y: number, angle: number, damage: number) {
    const bolt = new Projectile(this, x, y, angle, 230, 'orb_fire', damage, { life: 700, light: 0xff9a40, lightRadius: 40 });
    this.bolts.add(bolt);
    bolt.setVelocity(Math.cos(angle) * 230, Math.sin(angle) * 230);
    bolt.body.setCircle(4, 0, 0);
  }

  clearEnemyShots(x: number, y: number, radius: number) {
    for (const s of this.enemyShots.getChildren() as Projectile[]) {
      if (s.active && Phaser.Math.Distance.Between(x, y, s.x, s.y) <= radius) {
        this.fx.burst(s.x, s.y, 0xffffff, 4, 30, 'spark');
        s.pop();
      }
    }
  }

  hurtPlayer(amount: number, fromX: number, fromY: number) {
    this.player.hurt(amount, fromX, fromY);
  }

  hazard(x: number, y: number, radius: number, damage: number): boolean {
    const p = this.player;
    if (Phaser.Math.Distance.Between(x, y, p.body.center.x, p.body.bottom - 3) > radius + 4) return false;
    if (p.isInvulnerable) return false;
    this.hurtPlayer(damage, x, y);
    return true;
  }

  hitEnemy(enemy: Enemy, amount: number, fromX: number, fromY: number, knock = 1) {
    if (enemy.dead) return;
    const dmg = Math.max(1, Math.round(amount * (0.9 + Math.random() * 0.2) * (1 - enemy.def.def / (enemy.def.def + 18))));
    game.update((d) => (d.stats.damageDealt += dmg));
    sfx('hit');
    this.fx.number(enemy.x, enemy.y - 10, `${dmg}`, enemy.isBoss ? '#ffd56b' : '#ffffff');
    this.fx.burst(enemy.x, enemy.y, 0xffffff, 4, 40, 'spark');
    enemy.takeHit(dmg, fromX, fromY, knock);
  }

  private onEnemyContact(e: Enemy) {
    if (e.dead || this.player.isInvulnerable || !e.body.enable) return;
    if (e.isBoss && !(e as Boss).fighting) return;
    this.hurtPlayer(e.def.atk, e.body.center.x, e.body.center.y);
  }

  enemyDied(enemy: Enemy) {
    if (enemy.isBoss) return;
    const def = enemy.def;
    game.recordKill(def.kind);
    game.gainXp(def.xp);
    const s = game.stats();
    const gold = Math.round(Phaser.Math.Between(def.gold[0], def.gold[1]) * s.goldFind);
    const coins = Math.min(5, Math.max(1, Math.ceil(gold / 3)));
    for (let i = 0; i < coins; i++) this.pickups.add(new Pickup(this, enemy.x, enemy.y, 'coin', Math.max(1, Math.round(gold / coins))));
    if (Math.random() < 0.13) this.pickups.add(new Pickup(this, enemy.x, enemy.y, 'heart'));
    if (game.data.abilities.bolt && Math.random() < 0.12) this.pickups.add(new Pickup(this, enemy.x, enemy.y, 'mana'));
    this.fx.number(enemy.x, enemy.y - 14, `+${def.xp} XP`, '#b8a0ff');
    // Quest progress feedback for the slime bounty.
    if (game.questActive('slimes') && def.kind.endsWith('slime')) {
      const base = Number(game.flag('slimes_base') ?? 0);
      const n = (game.data.killsByType['slime'] ?? 0) + (game.data.killsByType['bog_slime'] ?? 0) + (game.data.killsByType['cave_slime'] ?? 0) - base;
      if (n <= 10) ui.toast(n >= 10 ? 'Slimes: 10/10. Tell Wendell!' : `Slimes: ${n}/10`, n >= 10 ? 'quest' : 'info');
    }
  }

  // ---- Progress bookkeeping ----------------------------------------------------------

  private loadExplored() {
    const m = this.level.map;
    this.explored = new Uint8Array(Math.ceil((m.w * m.h) / 8));
    const saved = game.data.explored[this.zone];
    if (saved) {
      try {
        const bin = atob(saved);
        for (let i = 0; i < Math.min(bin.length, this.explored.length); i++) this.explored[i] = bin.charCodeAt(i);
      } catch {
        // Ignore corrupt map data; it only affects the map screen.
      }
    }
  }

  private markExplored() {
    const m = this.level.map;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    const idx = ty * m.w + tx;
    if (idx === this.lastTile) return;
    this.lastTile = idx;
    const r = 7;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
        if ((x - tx) ** 2 + (y - ty) ** 2 > r * r) continue;
        const i = y * m.w + x;
        this.explored[i >> 3] |= 1 << (i & 7);
      }
    }
  }

  private flushProgress() {
    if (!game.loaded || !this.explored) return;
    let bin = '';
    for (let i = 0; i < this.explored.length; i++) bin += String.fromCharCode(this.explored[i]);
    const encoded = btoa(bin);
    const ms = Math.round(this.playtimeAcc);
    this.playtimeAcc -= ms;
    game.update((d) => {
      d.explored[this.zone] = encoded;
      d.stats.playtimeMs += ms;
    });
  }

  // ---- Main loop ---------------------------------------------------------------------

  update(time: number, delta: number) {
    this.playtimeAcc += delta;
    this.player.update(time, delta);
    for (const e of this.enemies.getChildren() as Enemy[]) e.update(time, delta);
    for (const n of this.npcs) n.update(time);
    for (const s of this.enemyShots.getChildren() as Projectile[]) s.tick(delta);
    for (const b of this.bolts.getChildren() as Projectile[]) b.tick(delta);
    for (const p of this.pickups.getChildren() as Pickup[]) p.tick(time);
    this.hearth?.update(time);

    // Interaction.
    const target = this.player.state === 'normal' ? this.nearestInteractable() : undefined;
    ui.setPrompt(target ? target.label() : null);
    if (target && this.controls.pressed('interact')) {
      this.player.setVelocity(0, 0);
      target.act();
    }

    this.checkExits();
    this.checkArena();
    this.markExplored();

    this.uiTimer += delta;
    if (this.uiTimer > 100) {
      this.uiTimer = 0;
      ui.setCooldowns(this.player.cooldowns());
    }
    this.syncTimer += delta;
    if (this.syncTimer > 5000) {
      this.syncTimer = 0;
      this.flushProgress();
    }

    this.renderLights(time);
  }

  private renderLights(time: number) {
    const lights: Light[] = [];
    const s = game.stats();
    const flicker = 1 + Math.sin(time / 130) * 0.03;
    lights.push({ x: this.player.x, y: this.player.y - 2, radius: 70 * s.light * flicker, color: 0xffd8a0, intensity: 0.9 });
    for (const l of this.level.staticLights) {
      if (l.flicker) lights.push({ ...l, radius: l.radius * (1 + Math.sin(time / 90 + l.x) * 0.04) });
      else lights.push(l);
    }
    for (const l of this.dynamicLights) lights.push(l);
    if (this.hearth) lights.push(this.hearth.light);
    for (const b of this.bolts.getChildren() as Projectile[]) if (b.light) lights.push({ x: b.x, y: b.y, radius: b.lightRadius, color: b.light });
    for (const sh of this.enemyShots.getChildren() as Projectile[]) if (sh.light) lights.push({ x: sh.x, y: sh.y, radius: sh.lightRadius, color: sh.light, intensity: 0.8 });
    for (const p of this.pickups.getChildren() as Pickup[]) {
      const l = p.getData('light') as Light | undefined;
      if (l) {
        l.x = p.x;
        l.y = p.y;
      }
    }
    this.level.lighting.render(lights, this.cameras.main.worldView);
  }
}
