import Phaser from 'phaser';
import { MAPS } from '../../data/maps';
import type { ZoneId } from '../../state/types';
import { ATLAS } from '../textures';
import { TERRAIN } from './legend';
import { Lighting, type Light } from './Lighting';
import { parseMap, tileAt, type ParsedMap } from './parse';
import { renderMap, TILE, type RenderedMap } from './render';

const cache = new Map<ZoneId, { map: ParsedMap; rendered: RenderedMap }>();

function loadZone(zone: ZoneId) {
  let hit = cache.get(zone);
  if (!hit) {
    const map = parseMap(MAPS[zone]);
    hit = { map, rendered: renderMap(map) };
    cache.set(zone, hit);
  }
  return hit;
}

/** The static part of a zone: terrain art, collision layers, lighting and ambience. */
export class Level {
  readonly map: ParsedMap;
  readonly rendered: RenderedMap;
  readonly width: number;
  readonly height: number;
  readonly walls: Phaser.Tilemaps.TilemapLayer;
  readonly liquids: Phaser.Tilemaps.TilemapLayer;
  readonly gaps: Phaser.Tilemaps.TilemapLayer;
  readonly lighting: Lighting;
  readonly staticLights: Light[];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, readonly zone: ZoneId) {
    this.scene = scene;
    const { map, rendered } = loadZone(zone);
    this.map = map;
    this.rendered = rendered;
    this.width = map.w * TILE;
    this.height = map.h * TILE;

    const gKey = `ground_${zone}`;
    const oKey = `overhead_${zone}`;
    if (!scene.textures.exists(gKey)) scene.textures.addCanvas(gKey, rendered.ground);
    if (!scene.textures.exists(oKey)) scene.textures.addCanvas(oKey, rendered.overhead);
    scene.add.image(0, 0, gKey).setOrigin(0, 0).setDepth(-10000);
    scene.add.image(0, 0, oKey).setOrigin(0, 0).setDepth(10000);

    const tm = scene.make.tilemap({ width: map.w, height: map.h, tileWidth: TILE, tileHeight: TILE });
    const ts = tm.addTilesetImage('collide', 'collide', TILE, TILE, 0, 0)!;
    this.walls = tm.createBlankLayer('walls', ts)!;
    this.liquids = tm.createBlankLayer('liquids', ts)!;
    this.gaps = tm.createBlankLayer('gaps', ts)!;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const solid = TERRAIN[tileAt(map, x, y)]?.solid;
        if (solid === 'wall') this.walls.putTileAt(1, x, y);
        else if (solid === 'liquid') this.liquids.putTileAt(1, x, y);
        else if (solid === 'gap') this.gaps.putTileAt(1, x, y);
      }
    }
    for (const l of [this.walls, this.liquids, this.gaps]) {
      l.setCollision(1);
      l.setVisible(false);
    }

    this.staticLights = rendered.lights.map((l) => ({ ...l }));
    this.lighting = new Lighting(scene, this.width, this.height, map.def.theme, map.def.darkness);

    this.addWaterShimmer();
    this.addAmbience();
  }

  setWall(tx: number, ty: number, solid: boolean) {
    if (solid) this.walls.putTileAt(1, tx, ty).setCollision(true);
    else this.walls.removeTileAt(tx, ty);
  }

  tileAtWorld(x: number, y: number): string {
    return tileAt(this.map, Math.floor(x / TILE), Math.floor(y / TILE));
  }

  isGapAt(x: number, y: number): boolean {
    return this.gaps.hasTileAtWorldXY(x, y);
  }

  isBlockedAt(x: number, y: number): boolean {
    return this.walls.hasTileAtWorldXY(x, y) || this.liquids.hasTileAtWorldXY(x, y) || this.gaps.hasTileAtWorldXY(x, y);
  }

  private addWaterShimmer() {
    const tiles = this.rendered.waterTiles;
    if (!tiles.length || this.map.def.theme === 'rift') return;
    const rand = new Phaser.Math.RandomDataGenerator([this.zone]);
    const count = Math.min(60, Math.floor(tiles.length / 4));
    for (let i = 0; i < count; i++) {
      const t = rand.pick(tiles);
      const s = this.scene.add
        .image(t.x * TILE + rand.between(2, 13), t.y * TILE + rand.between(3, 13), ATLAS, 'px')
        .setDepth(-9000)
        .setAlpha(0)
        .setScale(rand.pick([1, 1.5]), 0.5);
      this.scene.tweens.add({
        targets: s,
        alpha: { from: 0, to: 0.7 },
        duration: rand.between(500, 900),
        yoyo: true,
        repeat: -1,
        delay: rand.between(0, 3000),
        repeatDelay: rand.between(800, 3000),
      });
    }
  }

  private addAmbience() {
    const amb = this.map.def.ambient;
    if (!amb) return;
    const area = new Phaser.Geom.Rectangle(0, 0, this.width, this.height);
    const freq = Math.max(30, Math.round(400000 / (this.width * this.height / 256)));
    const base = {
      emitZone: { type: 'random' as const, source: area as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      frequency: freq,
      quantity: 1,
    };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    switch (amb) {
      case 'embers':
        cfg = { ...base, frame: 'px', lifespan: 4000, speedY: { min: -14, max: -6 }, speedX: { min: -4, max: 4 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffb040, 0xff7a30, 0xffe08a], blendMode: Phaser.BlendModes.ADD };
        break;
      case 'leaves':
        cfg = { ...base, frame: 'leaf', lifespan: 6000, speedY: { min: 6, max: 14 }, speedX: { min: -10, max: 4 }, rotate: { min: 0, max: 360 }, alpha: { start: 0.9, end: 0 }, frequency: freq * 2 };
        break;
      case 'dust':
        cfg = { ...base, frame: 'px1', lifespan: 5000, speedY: { min: -3, max: 3 }, speedX: { min: -3, max: 3 }, alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' }, tint: 0xd8c8b0 };
        break;
      case 'spray':
        cfg = { ...base, frame: 'dot', lifespan: 6000, speedX: { min: 4, max: 10 }, speedY: { min: -2, max: 2 }, scale: { start: 0.6, end: 1.4 }, alpha: { start: 0.18, end: 0 }, tint: 0xd0e8f0 };
        break;
      case 'motes':
        cfg = { ...base, frame: 'px', lifespan: 4500, speedY: { min: -12, max: -4 }, speedX: { min: -3, max: 3 }, scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xa070e0, 0x6fd0f0, 0xe070c0], blendMode: Phaser.BlendModes.ADD };
        break;
    }
    this.scene.add.particles(0, 0, ATLAS, cfg).setDepth(10500);
  }

  destroy() {
    this.lighting.destroy();
  }
}

export { TILE };
