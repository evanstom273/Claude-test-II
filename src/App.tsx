import { useEffect } from 'react';
import { useTouch } from './db/settings';
import { sfx } from './game/audio';
import { PhaserGame } from './game/PhaserGame';
import { enterCity, showTitleScene } from './game/sceneControl';
import { game } from './state/gameStore';
import * as session from './state/session';
import { ui, uiStore, useUI } from './state/uiStore';
import { useKeys } from './ui/common';
import { Hud } from './ui/Hud';
import { JobOffer } from './ui/JobOffer';
import { MapMenu } from './ui/MapMenu';
import { PauseMenu } from './ui/PauseMenu';
import { ShopMenu } from './ui/ShopMenu';
import { TitleScreen } from './ui/TitleScreen';
import { TouchControls } from './ui/TouchControls';
import { Wardrobe } from './ui/Wardrobe';

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__city = { game, ui, uiStore, session, enterCity };
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
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        sfx('select');
        ui.open('pause');
      } else if (e.key === 'm' || e.key === 'M') {
        sfx('select');
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
          {modal === 'map' && <MapMenu />}
          {modal === 'shop' && <ShopMenu />}
          {modal === 'job' && <JobOffer />}
          {modal === 'wardrobe' && <Wardrobe />}
        </>
      )}
    </div>
  );
}
