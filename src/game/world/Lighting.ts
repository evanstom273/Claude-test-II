import Phaser from 'phaser';
import type { ThemeId } from '../../data/maps/types';

/** Colour the world fades towards as darkness approaches 1. */
const NIGHT: Record<ThemeId, [number, number, number]> = {
  village: [22, 26, 64],
  forest: [14, 30, 26],
  mine: [16, 12, 16],
  marsh: [20, 30, 44],
  rift: [22, 10, 40],
};

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity?: number;
  flicker?: boolean;
}

const SCALE = 2;

/**
 * A multiply-blended lightmap over the world. Each frame it is cleared to the
 * ambient colour and lights are stamped on additively.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private ambient = 0xffffff;
  private darkness = 0;
  private theme: ThemeId;
  enabled = true;

  constructor(scene: Phaser.Scene, width: number, height: number, theme: ThemeId, darkness: number) {
    this.theme = theme;
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(width / SCALE), Math.ceil(height / SCALE));
    this.rt.setOrigin(0, 0).setScale(SCALE).setDepth(15000).setBlendMode(Phaser.BlendModes.MULTIPLY);
    // Light should be soft, not pixel-perfect.
    this.rt.texture.setSmoothPixelArt(false);
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.setDarkness(darkness);
  }

  setDarkness(d: number) {
    this.darkness = Phaser.Math.Clamp(d, 0, 1);
    const [r, g, b] = NIGHT[this.theme];
    const mix = (c: number) => Math.round(255 * (1 - this.darkness) + c * this.darkness);
    this.ambient = (mix(r) << 16) | (mix(g) << 8) | mix(b);
    this.rt.setVisible(this.darkness > 0.01 && this.enabled);
  }

  get level() {
    return this.darkness;
  }

  render(lights: Light[], view: Phaser.Geom.Rectangle) {
    if (!this.rt.visible) return;
    const rt = this.rt;
    rt.clear();
    rt.fill(this.ambient, 1);
    for (const l of lights) {
      // Skip lights that can't touch the screen.
      if (l.x + l.radius < view.x || l.x - l.radius > view.right || l.y + l.radius < view.y || l.y - l.radius > view.bottom) continue;
      rt.stamp('light', undefined, l.x / SCALE, l.y / SCALE, {
        scale: (l.radius * 2) / 128 / SCALE,
        tint: l.color,
        alpha: Math.min(1, (l.intensity ?? 1) * (0.25 + this.darkness * 0.75)),
        blendMode: Phaser.BlendModes.ADD,
      });
    }
    rt.render();
  }

  destroy() {
    this.rt.destroy();
  }
}
