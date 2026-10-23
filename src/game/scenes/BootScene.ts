import Phaser from 'phaser';
import { markReady } from '../sceneControl';
import { installTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    installTextures(this);
    // Fonts are used by in-world text; wait for them so damage numbers render right.
    const go = () => markReady();
    if (document.fonts?.ready) document.fonts.ready.then(go, go);
    else go();
  }
}
