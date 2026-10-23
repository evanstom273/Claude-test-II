import type Phaser from 'phaser';

let instance: Phaser.Game | null = null;
let ready = false;
const queue: (() => void)[] = [];

export function setGameInstance(g: Phaser.Game | null) {
  instance = g;
  if (!g) ready = false;
}

export function getGameInstance() {
  return instance;
}

/** Called by the boot scene once textures exist. */
export function markReady() {
  ready = true;
  while (queue.length) queue.shift()!();
}

function whenReady(fn: () => void) {
  if (ready && instance) fn();
  else queue.push(fn);
}

export function showTitleScene() {
  whenReady(() => {
    const sm = instance!.scene;
    if (sm.isActive('city') || sm.isPaused('city')) sm.stop('city');
    if (!sm.isActive('title')) sm.start('title');
  });
}

export function enterCity() {
  whenReady(() => {
    const sm = instance!.scene;
    if (sm.isActive('title')) sm.stop('title');
    if (sm.isActive('city') || sm.isPaused('city')) sm.stop('city');
    sm.start('city');
  });
}
