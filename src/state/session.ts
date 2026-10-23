import { latestSave, readSave, writeSave } from '../db/saves';
import { sfx } from '../game/audio';
import { enterCity, showTitleScene } from '../game/sceneControl';
import { game } from './gameStore';
import { newGameData } from './newGame';
import type { Point } from './types';
import { ui } from './uiStore';

/** Hooks the world registers so the UI can reach it. */
export const worldBridge: {
  playerPos?: () => Point;
  save?: () => void;
} = {};

worldBridge.save = () => void saveNow();

export async function startNewGame(slot: number) {
  game.start(slot, newGameData());
  ui.setScreen('game');
  enterCity();
  ui.bigText('GRIMSPORT', '#ffd84f', 'Answer ringing payphones for work', 3600);
}

export async function loadSlot(slot: number) {
  const data = await readSave(slot);
  if (!data) return;
  game.start(slot, { ...data, pos: null });
  ui.setScreen('game');
  enterCity();
}

export async function continueLatest() {
  const rec = await latestSave();
  if (rec) await loadSlot(rec.slot);
}

/** Save at the safehouse bed. */
export async function saveNow() {
  const slot = game.slot;
  if (slot === null || !game.loaded) return;
  game.update((d) => {
    d.pos = null;
    d.health = d.maxHealth;
  });
  await writeSave(slot, game.data);
  sfx('save');
  ui.toast('Game saved. Feeling rested.', 'info');
}

/** Quiet save after a job. */
export async function autosave() {
  const slot = game.slot;
  if (slot === null || !game.loaded) return;
  await writeSave(slot, { ...game.data, pos: null });
}

export function quitToTitle() {
  ui.setScreen('title');
  game.clear();
  showTitleScene();
}
