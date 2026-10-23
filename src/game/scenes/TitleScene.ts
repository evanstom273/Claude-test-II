import Phaser from 'phaser';
import { playMusic } from '../audio';
import { getCity } from '../city/cache';
import { ChunkManager } from '../city/chunks';
import { TILE } from '../city/tiles';
import { Lighting } from '../Lighting';
import { CITY_SEED } from '../../state/newGame';
import { fitZoom } from './zoom';

/** A slow night-time drift over the city behind the title screen. */
export class TitleScene extends Phaser.Scene {
  private chunks!: ChunkManager;
  private lighting!: Lighting;
  private t = 0;

  constructor() {
    super('title');
  }

  create() {
    const city = getCity(CITY_SEED);
    this.chunks = new ChunkManager(this, city);
    const cam = this.cameras.main;
    cam.setZoom(fitZoom(this, 18));
    const z = cam.zoom;
    this.lighting = new Lighting(this, this.scale.width / z + 64, this.scale.height / z + 64);
    this.lighting.setDarkness(0.82);
    this.t = 0;
    playMusic('title');
    this.events.once('shutdown', () => {
      this.chunks.destroy();
      this.lighting.destroy();
    });
  }

  update(_t: number, delta: number) {
    this.t += delta / 1000;
    const cam = this.cameras.main;
    const city = getCity(CITY_SEED);
    const cx = (city.W / 2) * TILE + Math.cos(this.t * 0.05) * 420;
    const cy = (city.H / 2) * TILE + Math.sin(this.t * 0.04) * 300;
    cam.centerOn(cx, cy);
    this.chunks.update(cam.worldView);
    const lights = this.chunks.lights.map((l) => ({ ...l, intensity: l.flicker ? l.intensity * (0.82 + 0.18 * Math.sin(this.time.now / 90 + l.x)) : l.intensity }));
    this.lighting.render(lights, cam.worldView);
  }
}
