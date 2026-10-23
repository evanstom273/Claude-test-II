import Phaser from 'phaser';
import { ATLAS } from '../textures';
import type { Light } from './Lighting';

const EMBER_TINTS = [0xffb040, 0x8fe060, 0xf0a060, 0x6fd0f0];

/** The Hearthlight brazier: a stone pedestal and a fire that grows with each Ember. */
export class Hearth {
  readonly base: Phaser.Physics.Arcade.Image;
  readonly light: Light;
  private flame: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, embers: number, withBody = true) {
    // x, y is the centre of the marker tile; the bowl sits a little above it.
    this.base = scene.physics.add.staticImage(x, y - 8, ATLAS, 'brazier');
    this.base.setDepth(y + 8);
    if (withBody) {
      const b = this.base.body as Phaser.Physics.Arcade.StaticBody;
      b.setSize(22, 10).setOffset(5, 18);
    } else {
      this.base.disableBody(true, false);
    }
    this.light = { x, y: y - 12, radius: 70, color: 0xffa040, intensity: 1 };
    this.flame = scene.add.particles(x, y - 16, ATLAS, {
      frame: 'dot',
      lifespan: { min: 400, max: 800 },
      speedY: { min: -40, max: -18 },
      speedX: { min: -8, max: 8 },
      scale: { start: 2.2, end: 0.3 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd56b, 0xf2a33a, 0xff8a30],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 60,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-6, -2, 12, 4) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
    });
    this.flame.setDepth(y + 9);
    this.sparks = scene.add.particles(x, y - 18, ATLAS, {
      frame: 'px',
      lifespan: { min: 800, max: 1600 },
      speedY: { min: -40, max: -20 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff3b0, 0xffb040],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 260,
    });
    this.sparks.setDepth(y + 10);
    this.setEmbers(embers, false);
  }

  setEmbers(n: number, celebrate = true) {
    this.embers = n;
    const size = 0.85 + n * 0.3;
    this.flame.setScale(size);
    this.flame.frequency = Math.max(18, 60 - n * 14);
    const tints = [EMBER_TINTS[0], ...EMBER_TINTS.slice(1, 1 + n), 0xffd56b, 0xf2a33a, 0xff8a30];
    this.flame.setParticleTint(tints);
    this.sparks.frequency = Math.max(60, 260 - n * 60);
    this.light.radius = 60 + n * 34;
    this.light.intensity = 0.9 + n * 0.2;
    if (celebrate) {
      this.flame.explode(40);
      this.sparks.explode(30);
    }
  }

  get count() {
    return this.embers;
  }

  update(time: number) {
    this.light.radius += Math.sin(time / 90) * 0.4 + (Math.random() - 0.5) * 1.2;
    this.light.radius = Phaser.Math.Clamp(this.light.radius, 50 + this.embers * 32, 66 + this.embers * 36);
  }
}
