import Phaser from 'phaser';
import { buildAtlas } from './art/atlas';
import { ANIMS } from './art/registry';
import { makeLightCanvas } from './art/procedural';

export const ATLAS = 'atlas';

/** Register the generated atlas, the light texture and every animation. */
export function installTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures.exists(ATLAS)) {
    const { canvas, rects } = buildAtlas();
    const tex = textures.addCanvas(ATLAS, canvas)!;
    for (const [key, r] of Object.entries(rects)) tex.add(key, 0, r.x, r.y, r.w, r.h);
  }
  if (!textures.exists('light')) {
    const light = textures.addCanvas('light', makeLightCanvas(128))!;
    light.setSmoothPixelArt(false);
    light.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  if (!textures.exists('collide')) {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 16;
    textures.addCanvas('collide', c);
  }

  for (const a of ANIMS) {
    if (scene.anims.exists(a.key)) continue;
    scene.anims.create({
      key: a.key,
      frames: a.frames.map((f) => ({ key: ATLAS, frame: f })),
      frameRate: a.fps,
      repeat: a.repeat ?? -1,
    });
  }
}
