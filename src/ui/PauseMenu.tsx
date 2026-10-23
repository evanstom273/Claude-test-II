import { useState } from 'react';
import { sfx } from '../game/audio';
import { useGameData } from '../state/gameStore';
import { quitToTitle, saveNow, worldBridge } from '../state/session';
import { ui } from '../state/uiStore';
import { Kbd, ModalShell, formatTime, useKeys, useListNav } from './common';
import { ControlsList, SettingsPanel } from './SettingsPanel';

export function PauseMenu() {
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const [sub, setSub] = useState<null | 'settings' | 'controls' | 'quit'>(null);
  const boss = !!ui.get().boss;

  const items = [
    { label: 'Resume', run: () => ui.close() },
    {
      label: boss ? 'Save (not during a fight)' : 'Save game',
      disabled: boss,
      run: async () => {
        await saveNow();
      },
    },
    { label: 'Bag', run: () => ui.open('inventory') },
    { label: 'Journal', run: () => ui.open('journal') },
    {
      label: 'Map',
      run: () => {
        worldBridge.flush?.();
        ui.open('map');
      },
    },
    { label: 'Settings', run: () => setSub('settings') },
    { label: 'Controls', run: () => setSub('controls') },
    { label: 'Quit to title', run: () => setSub('quit') },
  ];

  useListNav(
    items.length,
    index,
    setIndex,
    (i) => {
      if (items[i].disabled) return sfx('deny');
      sfx('select');
      void items[i].run();
    },
    { enabled: sub === null, onBack: () => ui.close() },
  );

  useKeys(
    (e) => {
      if (sub === 'controls' && (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Backspace')) {
        sfx('back');
        setSub(null);
      }
      if (sub === 'quit') {
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') quitToTitle();
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
          sfx('back');
          setSub(null);
        }
      }
    },
    sub === 'controls' || sub === 'quit',
  );

  if (!data) return null;

  return (
    <ModalShell title={sub === 'settings' ? 'Settings' : sub === 'controls' ? 'Controls' : 'Paused'} width={520}>
      {sub === null && (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <button
              key={it.label}
              type="button"
              tabIndex={-1}
              disabled={it.disabled}
              data-active={i === index ? 'true' : 'false'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                sfx('select');
                void it.run();
              }}
              className="pixel-btn cursor-pointer px-4 py-2 text-left text-lg"
            >
              {it.label}
            </button>
          ))}
          <div className="mt-3 text-sm text-dim">
            {data.playerName} · LV {data.level} · {formatTime(data.stats.playtimeMs)} played
          </div>
        </div>
      )}
      {sub === 'settings' && <SettingsPanel onBack={() => setSub(null)} />}
      {sub === 'controls' && (
        <>
          <ControlsList />
          <p className="mt-4 text-sm text-dim">
            <Kbd>Esc</Kbd> back
          </p>
        </>
      )}
      {sub === 'quit' && (
        <div className="text-center">
          <p className="mb-2 text-lg">Return to the title screen?</p>
          <p className="mb-4 text-dim">Progress since your last save will be lost. (Zone changes and resting autosave.)</p>
          <div className="flex justify-center gap-4">
            <button type="button" tabIndex={-1} className="pixel-btn cursor-pointer px-5 py-2 text-blood" onClick={() => quitToTitle()}>
              Quit <Kbd>Y</Kbd>
            </button>
            <button type="button" tabIndex={-1} className="pixel-btn cursor-pointer px-5 py-2" onClick={() => setSub(null)}>
              Stay <Kbd>N</Kbd>
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
