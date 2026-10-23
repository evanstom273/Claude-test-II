import { useState } from 'react';
import { GANG_NAMES } from '../game/city/gen';
import { sfx } from '../game/audio';
import { bus } from '../state/bus';
import { useGameData } from '../state/gameStore';
import { quitToTitle } from '../state/session';
import { ui } from '../state/uiStore';
import { Bar, Kbd, ModalShell, canFullscreen, formatTime, toggleFullscreen, useKeys, useListNav } from './common';
import { ControlsList, SettingsPanel } from './SettingsPanel';

/** Your phone: the pause menu. */
export function PauseMenu() {
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const [sub, setSub] = useState<null | 'settings' | 'controls' | 'quit' | 'stats'>(null);

  const items = [
    { label: 'Back to the streets', run: () => ui.close() },
    { label: 'City map', run: () => ui.open('map') },
    ...(data?.job ? [{ label: 'Drop the current job', run: () => (bus.emit('jobCancelled', {}), ui.close()) }] : []),
    { label: 'Rep & stats', run: () => setSub('stats') },
    { label: 'Settings', run: () => setSub('settings') },
    { label: 'Controls', run: () => setSub('controls') },
    ...(canFullscreen ? [{ label: 'Toggle fullscreen', run: () => toggleFullscreen() }] : []),
    { label: 'Quit to title', run: () => setSub('quit') },
  ];

  useListNav(
    items.length,
    index,
    setIndex,
    (i) => {
      sfx('select');
      void items[i].run();
    },
    { enabled: sub === null, onBack: () => ui.close() },
  );

  useKeys(
    (e) => {
      if ((sub === 'controls' || sub === 'stats') && (e.key === 'Escape' || e.key === 'Enter' || e.key === 'Backspace')) {
        sfx('back');
        setSub(null);
      }
      if (sub === 'quit') {
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') quitToTitle();
        else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') setSub(null);
      }
    },
    sub === 'controls' || sub === 'quit' || sub === 'stats',
  );

  if (!data) return null;
  const back = (
    <button type="button" tabIndex={-1} className="pixel-btn mt-4 cursor-pointer px-4 py-2" onClick={() => setSub(null)}>
      Back
    </button>
  );

  return (
    <ModalShell title={sub === 'settings' ? 'Settings' : sub === 'controls' ? 'Controls' : sub === 'stats' ? 'Rep & stats' : 'Your phone'} width={520} onClose={sub === null ? () => ui.close() : undefined}>
      {sub === null && (
        <div className="flex flex-col gap-2">
          {data.job && (
            <div className="pixel-inset mb-2 p-3 text-sm">
              <div className="text-ember-hi">{data.job.title}</div>
              <div className="mt-1 text-dim">{data.job.brief}</div>
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={it.label}
              type="button"
              tabIndex={-1}
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
          <div className="mt-2 text-sm text-dim">
            ${data.cash} · Day {data.day} · {formatTime(data.stats.playtimeMs)} on the streets
          </div>
        </div>
      )}
      {sub === 'settings' && (
        <>
          <SettingsPanel onBack={() => setSub(null)} />
          {back}
        </>
      )}
      {sub === 'controls' && (
        <>
          <ControlsList />
          {back}
        </>
      )}
      {sub === 'stats' && (
        <div className="flex flex-col gap-3">
          {(['vipers', 'crowns', 'rats'] as const).map((g) => {
            const r = data.respect[g];
            return (
              <div key={g}>
                <div className="flex justify-between text-sm">
                  <span>{GANG_NAMES[g]}</span>
                  <span className={r >= 20 ? 'text-moss' : r <= -25 ? 'text-blood' : 'text-dim'}>{r >= 20 ? 'Friendly' : r <= -25 ? 'Out for your blood' : 'Wary'}</span>
                </div>
                <Bar value={r + 100} max={200} color={r >= 0 ? '#6ad06a' : '#e04848'} height={8} />
              </div>
            );
          })}
          <div className="pixel-inset grid grid-cols-2 gap-x-6 gap-y-1 p-3 text-sm">
            <span className="text-dim">Jobs done</span>
            <span className="text-right">{data.stats.jobsDone}</span>
            <span className="text-dim">Cars nicked</span>
            <span className="text-right">{data.stats.carsStolen}</span>
            <span className="text-dim">Bodies</span>
            <span className="text-right">{data.stats.kills}</span>
            <span className="text-dim">Highest wanted</span>
            <span className="text-right">{'★'.repeat(data.stats.maxWanted) || '-'}</span>
            <span className="text-dim">Wasted / busted</span>
            <span className="text-right">
              {data.stats.wasted} / {data.stats.busted}
            </span>
            <span className="text-dim">Cash earned</span>
            <span className="text-right">${data.stats.cashEarned}</span>
          </div>
          {back}
        </div>
      )}
      {sub === 'quit' && (
        <div className="text-center">
          <p className="mb-2 text-lg">Back to the title screen?</p>
          <p className="mb-4 text-dim">Anything since you last slept at your flat (or finished a job) is lost.</p>
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
