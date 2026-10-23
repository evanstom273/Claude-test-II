import type { Dialogue } from '../data/dialogue';
import { MAPS } from '../data/maps';
import { deleteSave, latestSave, readSave, writeSave } from '../db/saves';
import { playMusic, sfx } from '../game/audio';
import { enterWorld, showTitleScene } from '../game/sceneControl';
import { game } from './gameStore';
import { createNewGame } from './newGame';
import type { Facing } from './types';
import { ui, uiStore } from './uiStore';

/** Hooks the running world registers so the UI can ask it things. */
export const worldBridge: {
  getPlayerPos: (() => { x: number; y: number; facing: Facing }) | null;
  flush: (() => void) | null;
} = { getPlayerPos: null, flush: null };

let saving: Promise<void> | null = null;

export async function saveNow(opts: { silent?: boolean; keepPosition?: boolean } = {}): Promise<boolean> {
  if (!game.loaded || game.slot === null) return false;
  worldBridge.flush?.();
  if (opts.keepPosition !== false) {
    const pos = worldBridge.getPlayerPos?.();
    if (pos) game.update((d) => (d.pos = pos));
  }
  const slot = game.slot;
  const data = game.data;
  uiStore.setState({ saving: true });
  try {
    if (saving) await saving;
    saving = writeSave(slot, data);
    await saving;
    if (!opts.silent) {
      ui.toast('Game saved.', 'info');
      sfx('save');
    }
    return true;
  } catch (err) {
    console.error('Save failed', err);
    ui.toast('Saving failed!', 'warn');
    return false;
  } finally {
    saving = null;
    uiStore.setState({ saving: false });
  }
}

/** Save at a zone entrance, so a fall puts you back there. */
export function autosave() {
  void saveNow({ silent: true, keepPosition: false });
}

export function talk(node: Dialogue, speaker?: string, portrait?: string) {
  uiStore.setState({ dialogue: { node, line: 0, speaker, portrait } });
  ui.open('dialogue');
}

export async function startNewGame(slot: number, name: string) {
  await deleteSave(slot);
  const data = createNewGame(name);
  game.start(slot, data);
  await writeSave(slot, game.data);
  begin();
}

export async function loadSlot(slot: number): Promise<boolean> {
  const data = await readSave(slot);
  if (!data) return false;
  game.start(slot, data);
  begin();
  return true;
}

export async function continueLatest(): Promise<boolean> {
  const rec = await latestSave();
  if (!rec) return false;
  return loadSlot(rec.slot);
}

function begin() {
  ui.reset();
  ui.setScreen('game');
  (document.activeElement as HTMLElement | null)?.blur?.();
  enterWorld();
}

/** After falling in battle: back to the last zone entrance, a little poorer. */
export function respawn() {
  game.update((d) => {
    d.stats.deaths++;
    d.gold = Math.floor(d.gold * 0.9);
    d.zone = d.entry.zone;
    d.pos = null;
  });
  game.fullRestore();
  ui.closeAll();
  ui.setBoss(null);
  enterWorld(game.data.entry.spawn);
  autosave();
}

export function quitToTitle() {
  game.clear();
  ui.setScreen('title');
  ui.reset();
  playMusic('title');
  showTitleScene();
}

export function zoneName(zone: keyof typeof MAPS) {
  return MAPS[zone].name;
}
