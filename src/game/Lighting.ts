import Phaser from 'phaser';

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity?: number;
  /** Texture to stamp: a round glow or a forward cone. */
  shape?: 'light' | 'cone';
  angle?: number;
}

const SCALE = 2;
const NIGHT = [18, 22, 52];

/**
 * A multiply-blended lightmap the size of the screen that follows the camera.
 * Each frame it is cleared to the ambient colour and lights are stamped on
 * additively, so night costs the same however big the city is.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private ambient = 0xffffff;
  darkness = 0;

  constructor(scene: Phaser.Scene, maxViewW: number, maxViewH: number) {
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(maxViewW / SCALE) + 8, Math.ceil(maxViewH / SCALE) + 8);
    this.rt.setOrigin(0, 0).setScale(SCALE).setDepth(15000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.rt.texture.setSmoothPixelArt(false);
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  /** 0 = noon, 1 = dead of night. */
  setDarkness(d: number) {
    this.darkness = Phaser.Math.Clamp(d, 0, 1);
    const mix = (c: number) => Math.round(255 * (1 - this.darkness) + c * this.darkness);
    this.ambient = (mix(NIGHT[0]) << 16) | (mix(NIGHT[1]) << 8) | mix(NIGHT[2]);
    this.rt.setVisible(this.darkness > 0.02);
  }

  render(lights: Light[], view: Phaser.Geom.Rectangle) {
    if (!this.rt.visible) return;
    const rt = this.rt;
    const ox = Math.floor(view.x / SCALE) * SCALE - 8;
    const oy = Math.floor(view.y / SCALE) * SCALE - 8;
    rt.setPosition(ox, oy);
    rt.clear();
    rt.fill(this.ambient, 1);
    const right = view.right + 8;
    const bottom = view.bottom + 8;
    for (const l of lights) {
      if (l.x + l.radius < ox || l.x - l.radius > right || l.y + l.radius < oy || l.y - l.radius > bottom) continue;
      const cone = l.shape === 'cone';
      rt.stamp(cone ? 'cone' : 'light', undefined, (l.x - ox) / SCALE, (l.y - oy) / SCALE, {
        scale: (l.radius * (cone ? 1 : 2)) / 128 / SCALE,
        tint: l.color,
        alpha: Math.min(1, (l.intensity ?? 1) * (0.3 + this.darkness * 0.7)),
        blendMode: Phaser.BlendModes.ADD,
        rotation: l.angle ?? 0,
        originX: cone ? 0 : 0.5,
        originY: 0.5,
      });
    }
    rt.render();
  }

  destroy() {
    this.rt.destroy();
  }
}
