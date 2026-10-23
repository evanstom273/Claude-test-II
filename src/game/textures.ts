import Phaser from 'phaser';
import { buildAtlas } from './art/atlas';
import { makeLightCanvas } from './art/procedural';
import { ANIMS } from './art/registry';

export const ATLAS = 'atlas';

/** Register the generated atlas, the light texture and every animation. */
export function installTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (!textures.exists(ATLAS)) {
    const { canvas, rects } = buildAtlas();
    const tex = textures.addCanvas(ATLAS, canvas)!;
    for (const [key, r] of Object.entries(rects)) tex.add(key, 0, r.x, r.y, r.w, r.h);
  }
  for (const [key, size] of [['light', 128], ['cone', 128]] as const) {
    if (textures.exists(key)) continue;
    const t = textures.addCanvas(key, key === 'light' ? makeLightCanvas(size) : makeConeCanvas(size))!;
    t.setSmoothPixelArt(false);
    t.setFilter(Phaser.Textures.FilterMode.LINEAR);
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

/** A soft wedge of light pointing right, for headlights. */
function makeConeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x / size;
      const dy = Math.abs(y - size / 2) / (size / 2);
      const spread = 0.15 + dx * 0.85;
      const inCone = dy < spread ? 1 - dy / spread : 0;
      const a = Math.max(0, inCone * (1 - dx) * Math.min(1, dx * 6));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
