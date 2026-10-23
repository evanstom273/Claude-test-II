import type Phaser from 'phaser';
import { settingsStore } from '../../db/settings';

/**
 * Pick a camera zoom that shows a comfortable number of tiles on any screen:
 * about 15 tiles tall on desktops and foldables, at least 11.5 tiles wide in
 * portrait, and a little closer on short landscape phones.
 */
export function fitZoom(scene: Phaser.Scene, tilesTall = 15.5) {
  const h = scene.scale.height;
  const w = scene.scale.width;
  const tall = h < 520 ? Math.min(tilesTall, 11.5) : tilesTall;
  const byHeight = h / (16 * tall);
  const byWidth = w / (16 * 11.5);
  return Math.max(1, Math.min(byHeight, byWidth));
}

/**
 * In portrait with touch controls the bottom of the screen is under your
 * thumbs, so frame the player a little above centre.
 */
export function followOffsetY(scene: Phaser.Scene, zoom: number) {
  const h = scene.scale.height;
  const w = scene.scale.width;
  if (!settingsStore.getState().touchControls || h < w * 1.15) return 0;
  return -(h / zoom) * 0.1;
}
