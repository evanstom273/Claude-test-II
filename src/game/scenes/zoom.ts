import type Phaser from 'phaser';

/** Zoom so the shorter side of the screen shows about `tiles` tiles. */
export function fitZoom(scene: Phaser.Scene, tiles: number) {
  const short = Math.min(scene.scale.width, scene.scale.height);
  return Math.max(1, short / (16 * tiles));
}
