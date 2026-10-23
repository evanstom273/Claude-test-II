import Phaser from 'phaser';
import { Level } from '../world/Level';
import { Hearth } from '../world/hearth';
import { TILE } from '../world/render';
import { fitZoom } from './zoom';

/** A slow drift over Emberhold at night, behind the title menu. */
export class TitleScene extends Phaser.Scene {
  private level!: Level;
  private hearth?: Hearth;

  constructor() {
    super('title');
  }

  create() {
    this.level = new Level(this, 'village');
    this.level.lighting.setDarkness(0.62);
    const marker = this.level.map.objects.find((o) => o.def.type === 'hearth');
    if (marker) this.hearth = new Hearth(this, marker.x * TILE + 8, marker.y * TILE + 8, 0, false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.level.width, this.level.height);
    cam.setZoom(fitZoom(this, 13));
    cam.setScroll(0, this.level.height * 0.25);
    const centreX = marker ? marker.x * TILE : this.level.width / 2;
    const centreY = marker ? marker.y * TILE : this.level.height / 2;
    cam.centerOn(centreX - 140, centreY - 30);
    this.tweens.add({
      targets: cam,
      scrollX: cam.scrollX + 280,
      duration: 40000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    cam.fadeIn(1200, 11, 10, 18);
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      this.level.destroy();
    });
  }

  private onResize() {
    this.cameras.main.setZoom(fitZoom(this, 13));
  }

  update(time: number) {
    this.hearth?.update(time);
    const view = this.cameras.main.worldView;
    const lights = [...this.level.staticLights];
    if (this.hearth) lights.push(this.hearth.light);
    this.level.lighting.render(lights, view);
  }
}
