import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { MAPS } from '../data/maps';
import { SLOT_COUNT, type SaveRecord } from '../db/db';
import { deleteSave, listSaves } from '../db/saves';
import { playMusic, sfx } from '../game/audio';
import { continueLatest, loadSlot, startNewGame } from '../state/session';
import { Icon, Kbd, Panel, formatTime, useKeys, useListNav } from './common';
import { ControlsList, SettingsPanel } from './SettingsPanel';

type View = 'main' | 'new' | 'name' | 'load' | 'settings' | 'controls' | 'credits';

function Logo() {
  return (
    <div className="mb-8 flex flex-col items-center">
      <div className="mb-2 animate-flicker">
        <Icon frame="icon_radiance" size={56} />
      </div>
      <h1 className="glow-ember text-6xl tracking-wide text-ember-hi sm:text-7xl">Hearthlight</h1>
      <p className="text-shadow mt-2 text-lg text-parchment/80">The last flame of Emberhold</p>
    </div>
  );
}

function SlotCard({ slot, rec, active, onClick, onDelete }: { slot: number; rec?: SaveRecord; active: boolean; onClick: () => void; onDelete?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`pixel-btn flex cursor-pointer items-center gap-4 px-4 py-3 ${active ? 'text-ember-hi' : ''}`}
      data-active={active ? 'true' : 'false'}
    >
      <div className="w-10 text-center font-tiny text-xs text-dim">#{slot}</div>
      {rec ? (
        <>
          <Icon frame="player_down_idle" size={32} />
          <div className="flex-1">
            <div className="text-lg">
              {rec.playerName} <span className="font-tiny text-xs text-ember">LV {rec.level}</span>
            </div>
            <div className="text-sm text-dim">
              {MAPS[rec.zone]?.name ?? rec.zone} · {formatTime(rec.playtimeMs)} · {new Date(rec.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Icon key={i} frame={['icon_ember_green', 'icon_ember_stone', 'icon_ember_blue'][i]} size={18} className={i < rec.embers ? '' : 'opacity-20 grayscale'} />
            ))}
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
  const [slot, setSlot] = useState(1);
  const [name, setName] = useState('Wren');
  const [confirm, setConfirm] = useState<null | { text: string; yes: () => void }>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    playMusic('title');
  }, []);

  const bySlot = (s: number) => saves?.find((r) => r.slot === s);
  const hasSaves = !!saves?.length;

  const menu = [
    { label: 'Continue', disabled: !hasSaves, run: async () => go(() => continueLatest()) },
    { label: 'New Game', run: () => open('new') },
    { label: 'Load Game', disabled: !hasSaves, run: () => open('load') },
    { label: 'Settings', run: () => open('settings') },
    { label: 'Controls', run: () => open('controls') },
    { label: 'Credits', run: () => open('credits') },
  ];

  function open(v: View) {
    setView(v);
    setIndex(0);
  }

  async function go(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  // Default to the first enabled item.
  useEffect(() => {
    if (view === 'main' && saves !== undefined) setIndex(hasSaves ? 0 : 1);
  }, [saves, hasSaves, view]);

  const pickNewSlot = (s: number) => {
    const doIt = () => {
      setSlot(s);
      setView('name');
      setTimeout(() => nameRef.current?.focus(), 50);
    };
    if (bySlot(s)) setConfirm({ text: `Overwrite ${bySlot(s)!.playerName}'s save in slot ${s}?`, yes: doIt });
    else doIt();
  };

  const askDelete = (s: number) => {
    const rec = bySlot(s);
    if (!rec) return;
    setConfirm({ text: `Delete ${rec.playerName}'s save? This can't be undone.`, yes: () => void deleteSave(s) });
  };

  // ---- Keyboard ----
  useListNav(
    menu.length,
    index,
    (i) => {
      let j = i;
      // Skip disabled entries.
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
      if (view === 'load' && (e.key === 'Delete' || e.key === 'x' || e.key === 'X')) askDelete(index + 1);
      if ((view === 'controls' || view === 'credits') && (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Backspace')) {
        sfx('back');
        open('main');
      }
    },
    !confirm,
  );

  useKeys(
    (e) => {
      if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
        confirm!.yes();
        setConfirm(null);
        sfx('select');
      } else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        setConfirm(null);
        sfx('back');
      }
    },
    !!confirm,
  );

  const begin = () => {
    const n = name.trim() || 'Wren';
    sfx('select');
    void go(() => startNewGame(slot, n));
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-ink/30 via-transparent to-ink/80 p-6">
      <div className="flex w-full max-w-xl flex-col items-center">
        <Logo />

        {view === 'main' && (
          <div className="flex w-72 flex-col gap-3">
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
            <p className="mt-3 text-center text-sm text-dim">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> choose · <Kbd>Enter</Kbd> select
            </p>
          </div>
        )}

        {(view === 'new' || view === 'load') && (
          <Panel className="w-full animate-rise p-5">
            <h2 className="text-shadow mb-3 text-2xl text-ember-hi">{view === 'new' ? 'Choose a slot' : 'Load game'}</h2>
            <div className="flex flex-col gap-3">
              {Array.from({ length: SLOT_COUNT }, (_, i) => (
                <SlotCard
                  key={i}
                  slot={i + 1}
                  rec={bySlot(i + 1)}
                  active={index === i}
                  onClick={() => {
                    setIndex(i);
                    sfx('select');
                    if (view === 'new') pickNewSlot(i + 1);
                    else if (bySlot(i + 1)) void go(() => loadSlot(i + 1));
                  }}
                  onDelete={view === 'load' ? () => askDelete(i + 1) : undefined}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-dim">
              <Kbd>Enter</Kbd> {view === 'new' ? 'choose' : 'load'}
              {view === 'load' && (
                <>
                  {' '}
                  · <Kbd>X</Kbd> delete
                </>
              )}{' '}
              · <Kbd>Esc</Kbd> back
            </p>
          </Panel>
        )}

        {view === 'name' && (
          <Panel className="w-full animate-rise p-5">
            <h2 className="text-shadow mb-1 text-2xl text-ember-hi">Who keeps the flame?</h2>
            <p className="mb-4 text-dim">Maren's apprentice needs a name.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                begin();
              }}
            >
              <input
                ref={nameRef}
                value={name}
                maxLength={14}
                onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} '-]/gu, ''))}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    sfx('back');
                    open('new');
                  }
                }}
                className="pixel-inset w-full bg-ink px-3 py-2 text-2xl text-parchment outline-none"
              />
              <div className="mt-4 flex justify-between gap-3">
                <button type="button" tabIndex={-1} className="pixel-btn cursor-pointer px-4 py-2" onClick={() => open('new')}>
                  Back
                </button>
                <button type="submit" disabled={busy} className="pixel-btn cursor-pointer px-6 py-2 text-ember-hi">
                  Begin ▸
                </button>
              </div>
            </form>
          </Panel>
        )}

        {view === 'settings' && (
          <Panel className="w-full animate-rise p-5">
            <h2 className="text-shadow mb-3 text-2xl text-ember-hi">Settings</h2>
            <SettingsPanel onBack={() => open('main')} />
          </Panel>
        )}

        {view === 'controls' && (
          <Panel className="w-full animate-rise p-5">
            <h2 className="text-shadow mb-3 text-2xl text-ember-hi">Controls</h2>
            <ControlsList />
            <p className="mt-4 text-sm text-dim">
              <Kbd>Esc</Kbd> back
            </p>
          </Panel>
        )}

        {view === 'credits' && (
          <Panel className="w-full animate-rise p-5 text-center">
            <h2 className="text-shadow mb-3 text-2xl text-ember-hi">Credits</h2>
            <p className="mb-2">Hearthlight: an action RPG in five places, three Embers and one very stubborn cat.</p>
            <p className="mb-2 text-dim">Built with React, Vite, TypeScript, Tailwind CSS, Dexie (IndexedDB) and Phaser 4.</p>
            <p className="mb-4 text-dim">Every sprite, tile, tune and sound effect is generated in code at runtime.</p>
            <p className="text-sm text-dim">
              <Kbd>Esc</Kbd> back
            </p>
          </Panel>
        )}

        {confirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70">
            <Panel className="w-96 animate-rise p-5 text-center">
              <p className="mb-4 text-lg">{confirm.text}</p>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  tabIndex={-1}
                  className="pixel-btn cursor-pointer px-5 py-2 text-blood"
                  onClick={() => {
                    confirm.yes();
                    setConfirm(null);
                  }}
                >
                  Yes <Kbd>Y</Kbd>
                </button>
                <button type="button" tabIndex={-1} className="pixel-btn cursor-pointer px-5 py-2" onClick={() => setConfirm(null)}>
                  No <Kbd>N</Kbd>
                </button>
              </div>
            </Panel>
          </div>
        )}
      </div>
      <div className="text-shadow absolute bottom-3 left-0 right-0 text-center text-xs text-dim/70">v0.1 · saves are kept in this browser (IndexedDB)</div>
    </div>
  );
}
