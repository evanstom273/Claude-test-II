import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { SLOT_COUNT, type SaveRecord } from '../db/db';
import { deleteSave, listSaves } from '../db/saves';
import { playMusic, sfx } from '../game/audio';
import { continueLatest, loadSlot, startNewGame } from '../state/session';
import { Icon, Kbd, Panel, canFullscreen, formatTime, toggleFullscreen, useKeys, useListNav } from './common';
import { ControlsList, SettingsPanel } from './SettingsPanel';

type View = 'main' | 'new' | 'load' | 'settings' | 'controls';

function Logo() {
  return (
    <div className="mb-6 flex flex-col items-center sm:mb-8">
      <h1 className="glow-ember neon-flicker text-6xl tracking-[0.12em] text-ember sm:text-8xl">LOWLIFE</h1>
      <p className="glow-neon mt-1 text-lg tracking-widest text-neon sm:text-xl">GRIMSPORT · AFTER DARK</p>
    </div>
  );
}

function SlotCard({ slot, rec, active, onClick, onDelete }: { slot: number; rec?: SaveRecord; active: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div onClick={onClick} className={`pixel-btn flex cursor-pointer items-center gap-4 px-4 py-3 ${active ? 'text-ember-hi' : ''}`} data-active={active ? 'true' : 'false'}>
      <div className="w-8 text-center font-tiny text-xs text-dim">#{slot}</div>
      {rec ? (
        <>
          <Icon frame={`player${rec.data.outfit ?? 0}_down_idle`} size={32} />
          <div className="flex-1">
            <div className="text-lg text-moss">${rec.cash.toLocaleString()}</div>
            <div className="text-sm text-dim">
              Day {rec.day} · {rec.jobsDone} jobs · {formatTime(rec.playtimeMs)}
            </div>
          </div>
          {onDelete && (
            <button
              type="button"
              tabIndex={-1}
              className="cursor-pointer px-2 text-dim hover:text-blood"
              title="Delete save"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              ✕
            </button>
          )}
        </>
      ) : (
        <div className="flex-1 text-dim italic">Empty slot</div>
      )}
    </div>
  );
}

export function TitleScreen() {
  const saves = useLiveQuery(() => listSaves(), [], undefined);
  const [view, setView] = useState<View>('main');
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState<null | { text: string; yes: () => void }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    playMusic('title');
  }, []);

  const bySlot = (s: number) => saves?.find((r) => r.slot === s);
  const hasSaves = !!saves?.length;

  async function go(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const menu = [
    { label: 'Continue', disabled: !hasSaves, run: () => go(() => continueLatest()) },
    { label: 'New Game', run: () => open('new') },
    { label: 'Load Game', disabled: !hasSaves, run: () => open('load') },
    { label: 'Settings', run: () => open('settings') },
    { label: 'Controls', run: () => open('controls') },
    ...(canFullscreen ? [{ label: 'Fullscreen', run: () => toggleFullscreen() }] : []),
  ];

  function open(v: View) {
    setView(v);
    setIndex(0);
  }

  useEffect(() => {
    if (view === 'main' && saves !== undefined) setIndex(hasSaves ? 0 : 1);
  }, [saves, hasSaves, view]);

  const pickNewSlot = (s: number) => {
    const doIt = () => void go(() => startNewGame(s));
    if (bySlot(s)) setConfirm({ text: `Overwrite the save in slot ${s}?`, yes: doIt });
    else doIt();
  };

  useListNav(
    menu.length,
    index,
    (i) => {
      let j = i;
      for (let n = 0; n < menu.length && menu[j].disabled; n++) j = (j + (i >= index ? 1 : -1) + menu.length) % menu.length;
      setIndex(j);
    },
    (i) => {
      if (menu[i].disabled) return sfx('deny');
      sfx('select');
      void menu[i].run();
    },
    { enabled: view === 'main' && !confirm },
  );
  useListNav(
    SLOT_COUNT,
    index,
    setIndex,
    (i) => {
      sfx('select');
      if (view === 'new') pickNewSlot(i + 1);
      else if (bySlot(i + 1)) void go(() => loadSlot(i + 1));
      else sfx('deny');
    },
    { enabled: (view === 'new' || view === 'load') && !confirm, onBack: () => open('main') },
  );
  useKeys(
    (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Enter') {
        sfx('back');
        open('main');
      }
    },
    view === 'controls',
  );
  useKeys(
    (e) => {
      if (!confirm) return;
      if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        confirm.yes();
        setConfirm(null);
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') setConfirm(null);
    },
    !!confirm,
  );

  return (
    <div className="safe-pad absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgb(10_9_16/0.25),rgb(10_9_16/0.8))]">
      <div className="my-auto flex w-full max-w-md flex-col items-center px-4 py-6">
        <Logo />
        {view === 'main' && (
          <div className="flex w-64 flex-col gap-2.5">
            {menu.map((m, i) => (
              <button
                key={m.label}
                type="button"
                tabIndex={-1}
                disabled={m.disabled}
                data-active={i === index ? 'true' : 'false'}
                onMouseEnter={() => !m.disabled && setIndex(i)}
                onClick={() => {
                  sfx('select');
                  void m.run();
                }}
                className="pixel-btn cursor-pointer py-2.5 text-center text-xl"
              >
                {m.label}
              </button>
            ))}
            <p className="kbd-hint mt-2 text-center text-sm text-dim">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> choose · <Kbd>Enter</Kbd> select
            </p>
          </div>
        )}
        {(view === 'new' || view === 'load') && (
          <Panel className="w-full p-4">
            <h2 className="mb-3 text-xl text-ember-hi">{view === 'new' ? 'Pick a save slot' : 'Load a game'}</h2>
            <div className="flex flex-col gap-2">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <SlotCard
                  key={i}
                  slot={i + 1}
                  rec={bySlot(i + 1)}
                  active={i === index}
                  onClick={() => {
                    sfx('select');
                    if (view === 'new') pickNewSlot(i + 1);
                    else if (bySlot(i + 1)) void go(() => loadSlot(i + 1));
                  }}
                  onDelete={view === 'load' ? () => setConfirm({ text: `Delete the save in slot ${i + 1}?`, yes: () => void deleteSave(i + 1) }) : undefined}
                />
              ))}
            </div>
            <button type="button" tabIndex={-1} className="pixel-btn mt-3 cursor-pointer px-4 py-2" onClick={() => open('main')}>
              Back
            </button>
          </Panel>
        )}
        {view === 'settings' && (
          <Panel className="w-full p-4">
            <SettingsPanel onBack={() => open('main')} />
            <button type="button" tabIndex={-1} className="pixel-btn mt-3 cursor-pointer px-4 py-2" onClick={() => open('main')}>
              Back
            </button>
          </Panel>
        )}
        {view === 'controls' && (
          <Panel className="w-full p-4">
            <ControlsList />
            <button type="button" tabIndex={-1} className="pixel-btn mt-3 cursor-pointer px-4 py-2" onClick={() => open('main')}>
              Back
            </button>
          </Panel>
        )}
        {confirm && (
          <Panel className="mt-4 w-full p-4 text-center">
            <p className="mb-3">{confirm.text}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                tabIndex={-1}
                className="pixel-btn cursor-pointer px-4 py-2 text-blood"
                onClick={() => {
                  confirm.yes();
                  setConfirm(null);
                }}
              >
                Yes <Kbd>Y</Kbd>
              </button>
              <button type="button" tabIndex={-1} className="pixel-btn cursor-pointer px-4 py-2" onClick={() => setConfirm(null)}>
                No <Kbd>N</Kbd>
              </button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
