import Phaser from 'phaser';
import { settingsStore } from '../db/settings';
import { ATLAS } from './textures';

export const FONT = '"Pixelify Sans", "Silkscreen", monospace';

/** Visual effects that don't affect gameplay. */
export class Fx {
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private scene: Phaser.Scene) {}

  private emitter(key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) {
    let e = this.emitters.get(key);
    if (!e) {
      e = this.scene.add.particles(0, 0, ATLAS, { ...cfg, emitting: false });
      e.setDepth(12000);
      this.emitters.set(key, e);
    }
    return e;
  }

  burst(x: number, y: number, tint: number | number[], count = 10, speed = 60, frame = 'px') {
    const key = `burst:${frame}:${Array.isArray(tint) ? tint.join(',') : tint}:${speed}`;
    this.emitter(key, {
      frame,
      lifespan: { min: 250, max: 550 },
      speed: { min: speed * 0.3, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
    }).explode(count, x, y);
  }

  glow(x: number, y: number, tint: number | number[], count = 8, speed = 30) {
    const key = `glow:${Array.isArray(tint) ? tint.join(',') : tint}`;
    this.emitter(key, {
      frame: 'dot',
      lifespan: { min: 400, max: 900 },
      speed: { min: speed * 0.3, max: speed },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint,
      blendMode: Phaser.BlendModes.ADD,
    }).explode(count, x, y);
  }

  smoke(x: number, y: number, count = 6) {
    this.emitter('smoke', {
      frame: 'dot',
      lifespan: { min: 400, max: 800 },
      speed: { min: 6, max: 24 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.5, end: 0 },
      tint: [0x9a98a8, 0x6a6878],
    }).explode(count, x, y);
  }

  number(x: number, y: number, text: string, color = '#ffffff', big = false) {
    if (!settingsStore.getState().damageNumbers && /^\d+$/.test(text)) return;
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: big ? '10px' : '8px',
        color,
        stroke: '#1a1423',
        strokeThickness: 2,
        resolution: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(20000);
    this.scene.tweens.add({
      targets: t,
      y: y - 14,
      alpha: { from: 1, to: 0 },
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  shake(duration = 120, intensity = 0.004) {
    if (!settingsStore.getState().screenShake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  ring(x: number, y: number, radius: number, tint = 0xffd56b, duration = 350) {
    const r = this.scene.add.image(x, y, ATLAS, 'ring').setDepth(11900).setTint(tint).setBlendMode(Phaser.BlendModes.ADD);
    r.setScale(0.1);
    this.scene.tweens.add({
      targets: r,
      scale: (radius * 2) / 64,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => r.destroy(),
    });
  }

  flash(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, color = 0xffffff, ms = 90) {
    target.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => {
      if (target.active) target.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  afterimage(src: Phaser.GameObjects.Sprite, tint = 0xffb040) {
    const img = this.scene.add
      .image(src.x, src.y, src.texture.key, src.frame.name)
      .setScale(src.scaleX, src.scaleY)
      .setFlipX(src.flipX)
      .setDepth(src.depth - 1)
      .setTint(tint)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.6);
    this.scene.tweens.add({ targets: img, alpha: 0, duration: 220, onComplete: () => img.destroy() });
  }

  /** A pulsing warning circle that resolves after `ms`. */
  warnCircle(x: number, y: number, radius: number, ms: number, color = 0xff4040): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(-4000);
    const start = this.scene.time.now;
    const draw = () => {
      if (!g.active) return;
      const t = Math.min(1, (this.scene.time.now - start) / ms);
      g.clear();
      g.fillStyle(color, 0.12 + 0.18 * t);
      g.fillCircle(x, y, radius);
      g.lineStyle(1, color, 0.6 + 0.4 * t);
      g.strokeCircle(x, y, radius * (0.4 + 0.6 * t));
      g.strokeCircle(x, y, radius);
    };
    draw();
    const ev = this.scene.time.addEvent({ delay: 30, loop: true, callback: draw });
    this.scene.time.delayedCall(ms, () => {
      ev.remove();
      g.destroy();
    });
    return g;
  }

  /** A warning band from (x, y) along `angle`, `len` long. */
  warnLine(x: number, y: number, angle: number, len: number, width: number, ms: number, color = 0xff4040) {
    const g = this.scene.add.graphics().setDepth(-4000);
    g.setPosition(x, y).setRotation(angle);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        g.clear();
        g.fillStyle(color, 0.1 + 0.25 * t);
        g.fillRect(0, -width / 2, len, width);
        g.lineStyle(1, color, 0.7);
        g.strokeRect(0, -width / 2, len, width);
      },
      onComplete: () => g.destroy(),
    });
  }
}
