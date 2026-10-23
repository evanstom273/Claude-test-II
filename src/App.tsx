import { useEffect } from 'react';
import { sfx } from './game/audio';
import { PhaserGame } from './game/PhaserGame';
import { enterWorld, showTitleScene } from './game/sceneControl';
import { game } from './state/gameStore';
import * as session from './state/session';
import { ui, uiStore, useUI } from './state/uiStore';
import { useKeys } from './ui/common';
import { DialogueBox } from './ui/DialogueBox';
import { Ending, GameOver } from './ui/EndScreens';
import { Hud } from './ui/Hud';
import { InventoryMenu } from './ui/InventoryMenu';
import { JournalMenu } from './ui/JournalMenu';
import { MapMenu } from './ui/MapMenu';
import { PauseMenu } from './ui/PauseMenu';
import { ShopMenu } from './ui/ShopMenu';
import { TitleScreen } from './ui/TitleScreen';
import { TouchControls } from './ui/TouchControls';
import { useTouch } from './db/settings';

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__hearth = {
    game,
    ui,
    uiStore,
    session,
    /** Jump to a zone spawn, for testing. */
    warp: (zone: Parameters<typeof game.setZone>[0], spawn: string) => {
      game.setZone(zone, spawn);
      enterWorld(spawn);
    },
  };
}

export function App() {
  const screen = useUI((s) => s.screen);
  const modal = useUI((s) => s.modal);
  const touch = useTouch();

  useEffect(() => {
    if (screen === 'title') showTitleScene();
  }, [screen]);

  // Pause automatically when the tab loses focus.
  useEffect(() => {
    const onHide = () => {
      const s = uiStore.getState();
      if (document.hidden && s.screen === 'game' && !s.modal) ui.open('pause');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useKeys(
    (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === 'Escape') {
        sfx('select');
        ui.open('pause');
      } else if (k === 'i' || k === 'I' || k === 'Tab') {
        e.preventDefault();
        sfx('select');
        ui.open('inventory');
      } else if (k === 'q' || k === 'Q') {
        sfx('select');
        ui.open('journal');
      } else if (k === 'm' || k === 'M') {
        sfx('select');
        session.worldBridge.flush?.();
        ui.open('map');
      }
    },
    screen === 'game' && modal === null,
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink" onContextMenu={(e) => e.preventDefault()}>
      <PhaserGame />
      {screen === 'title' && <TitleScreen />}
      {screen === 'game' && (
        <>
          <Hud />
          {touch && <TouchControls />}
          {modal === 'pause' && <PauseMenu />}
          {modal === 'inventory' && <InventoryMenu />}
          {modal === 'journal' && <JournalMenu />}
          {modal === 'map' && <MapMenu />}
          {modal === 'shop' && <ShopMenu />}
          {modal === 'gameover' && <GameOver />}
          {modal === 'ending' && <Ending />}
          <DialogueBox />
        </>
      )}
    </div>
  );
}
