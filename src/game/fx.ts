import Phaser from 'phaser';
import { settingsStore } from '../db/settings';
import { sfx } from './audio';
import { ATLAS } from './textures';

export const FONT = '"Pixelify Sans", "Silkscreen", monospace';

/** Visual effects that don't affect gameplay. */
export class Fx {
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private scene: Phaser.Scene) {}

  private emitter(key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 12000) {
    let e = this.emitters.get(key);
    if (!e) {
      e = this.scene.add.particles(0, 0, ATLAS, { ...cfg, emitting: false });
      e.setDepth(depth);
      this.emitters.set(key, e);
    }
    return e;
  }

  burst(x: number, y: number, tint: number | number[], count = 10, speed = 60, frame = 'px') {
    const key = `burst:${frame}:${Array.isArray(tint) ? tint.join(',') : tint}:${speed}`;
    this.emitter(key, {
      frame,
      lifespan: { min: 200, max: 500 },
      speed: { min: speed * 0.3, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
    }).explode(count, x, y);
  }

  blood(x: number, y: number, angle: number) {
    const deg = (angle * 180) / Math.PI;
    this.emitter('blood', {
      frame: 'px',
      lifespan: { min: 200, max: 420 },
      speed: { min: 20, max: 70 },
      angle: { min: deg - 35, max: deg + 35 },
      scale: { start: 0.7, end: 0.2 },
      gravityY: 140,
      tint: [0x9a2430, 0x7a1a22, 0xc23b3b],
    }).explode(7, x, y);
  }

  smoke(x: number, y: number, count = 3, dark = false) {
    this.emitter(dark ? 'smoke_dark' : 'smoke', {
      frame: 'dot',
      lifespan: { min: 600, max: 1100 },
      speed: { min: 6, max: 18 },
      angle: { min: 230, max: 310 },
      scale: { start: 0.8, end: 2.4 },
      alpha: { start: dark ? 0.55 : 0.4, end: 0 },
      tint: dark ? [0x2a2428, 0x3a3436] : [0x9a98a8, 0x7a7888],
    }, 13000).explode(count, x, y);
  }

  fire(x: number, y: number) {
    this.emitter('fire', {
      frame: 'dot',
      lifespan: { min: 250, max: 500 },
      speed: { min: 10, max: 30 },
      angle: { min: 240, max: 300 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [0xffd84f, 0xff8a3a, 0xd84a2a],
      blendMode: Phaser.BlendModes.ADD,
    }, 13000).explode(3, x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-3, 3));
  }

  sparks(x: number, y: number, count = 6) {
    this.burst(x, y, [0xffd84f, 0xfff3b0, 0xffffff], count, 90, 'px');
  }

  crash(x: number, y: number, speed: number) {
    this.sparks(x, y, Math.min(14, Math.floor(speed / 12)));
    sfx(speed > 110 ? 'crash' : 'bump');
    if (speed > 120) this.shake(120, 0.004);
  }

  muzzle(x: number, y: number, angle: number) {
    const f = this.scene.add.image(x, y, ATLAS, 'flash').setRotation(angle).setDepth(14001).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.time.delayedCall(45, () => f.destroy());
  }

  tracer(x0: number, y0: number, x1: number, y1: number) {
    const g = this.scene.add.graphics().setDepth(14000).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(1, 0xfff3b0, 0.85);
    g.lineBetween(x0, y0, x1, y1);
    this.scene.time.delayedCall(50, () => g.destroy());
  }

  explosion(x: number, y: number) {
    const img = this.scene.add.image(x, y, ATLAS, 'boom_0').setDepth(14002).setScale(1.1);
    let f = 0;
    this.scene.time.addEvent({
      delay: 70,
      repeat: 3,
      callback: () => {
        f++;
        if (f < 4) img.setFrame(`boom_${f}`).setScale(1.1 + f * 0.15);
        else img.destroy();
      },
    });
    this.burst(x, y, [0xffd84f, 0xff8a3a, 0xd84a2a], 24, 140, 'dot');
    this.smoke(x, y, 10, true);
    this.shake(260, 0.012);
    sfx('explosion');
  }

  number(x: number, y: number, text: string, color = '#ffffff', big = false) {
    if (!settingsStore.getState().damageNumbers && /^\d+$/.test(text)) return;
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: big ? '10px' : '8px', color, stroke: '#1a1423', strokeThickness: 2, resolution: 6 })
      .setOrigin(0.5, 1)
      .setDepth(20000);
    this.scene.tweens.add({ targets: t, y: y - 14, alpha: { from: 1, to: 0 }, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  shake(duration = 120, intensity = 0.004) {
    if (!settingsStore.getState().screenShake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  ring(x: number, y: number, radius: number, tint = 0xffd56b, duration = 350) {
    const r = this.scene.add.image(x, y, ATLAS, 'ring').setDepth(11900).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale(0.1);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 64, alpha: { from: 1, to: 0 }, duration, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  flash(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, color = 0xffffff, ms = 80) {
    target.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => {
      if (target.active) target.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }
}
