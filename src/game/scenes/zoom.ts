import type Phaser from 'phaser';

/** Pick a camera zoom that shows roughly the same number of tiles on any screen. */
export function fitZoom(scene: Phaser.Scene, tilesTall = 15.5) {
  const h = scene.scale.height;
  const w = scene.scale.width;
  const byHeight = h / (16 * tilesTall);
  const byWidth = w / (16 * 22);
  return Math.max(1.5, Math.min(byHeight, Math.max(byWidth, byHeight * 0.75)));
}
