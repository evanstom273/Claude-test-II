import { useState } from 'react';
import { updateSettings, useSettings, type Settings } from '../db/settings';
import { sfx } from '../game/audio';
import { Kbd, useKeys } from './common';

type Row = { key: keyof Settings; label: string; kind: 'volume' | 'toggle' };

const ROWS: Row[] = [
  { key: 'musicVolume', label: 'Music volume', kind: 'volume' },
  { key: 'sfxVolume', label: 'Sound effects', kind: 'volume' },
  { key: 'screenShake', label: 'Screen shake', kind: 'toggle' },
  { key: 'damageNumbers', label: 'Damage numbers', kind: 'toggle' },
];

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const settings = useSettings((s) => s);
  const [row, setRow] = useState(0);

  const adjust = (r: Row, dir: number) => {
    if (r.kind === 'volume') {
      const v = Math.round(Math.max(0, Math.min(1, (settings[r.key] as number) + dir * 0.1)) * 10) / 10;
      updateSettings({ [r.key]: v });
    } else {
      updateSettings({ [r.key]: !settings[r.key] });
    }
    sfx('move');
  };

  useKeys((e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') setRow((r) => (r + ROWS.length - 1) % ROWS.length);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') setRow((r) => (r + 1) % ROWS.length);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') adjust(ROWS[row], -1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'Enter' || k === 'e' || k === 'E') adjust(ROWS[row], 1);
    else if (k === 'Escape' || k === 'Backspace') {
      sfx('back');
      onBack();
    }
  });

  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((r, i) => {
        const v = settings[r.key];
        return (
          <div key={r.key} onMouseEnter={() => setRow(i)} className={`flex items-center justify-between gap-6 px-3 py-2 ${i === row ? 'bg-panel-2 text-ember-hi' : ''}`}>
            <span>{r.label}</span>
            {r.kind === 'volume' ? (
              <div className="flex items-center gap-2">
                <button type="button" tabIndex={-1} className="cursor-pointer px-1 text-dim hover:text-parchment" onClick={() => adjust(r, -1)}>
                  ◂
                </button>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, j) => (
                    <div key={j} className={`h-3 w-2.5 ${j < Math.round((v as number) * 10) ? 'bg-ember' : 'bg-ink'}`} />
                  ))}
                </div>
                <button type="button" tabIndex={-1} className="cursor-pointer px-1 text-dim hover:text-parchment" onClick={() => adjust(r, 1)}>
                  ▸
                </button>
              </div>
            ) : (
              <button type="button" tabIndex={-1} className="cursor-pointer" onClick={() => adjust(r, 1)}>
                {v ? 'On' : 'Off'}
              </button>
            )}
          </div>
        );
      })}
      <p className="mt-2 text-sm text-dim">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> choose · <Kbd>←</Kbd>
        <Kbd>→</Kbd> adjust · <Kbd>Esc</Kbd> back
      </p>
    </div>
  );
}

export function ControlsList() {
  const rows: [string, string[]][] = [
    ['Move', ['W A S D', 'Arrows']],
    ['Attack (three-hit combo)', ['J', 'Space']],
    ['Talk / interact', ['E', 'Enter']],
    ['Ember Bolt', ['K']],
    ['Ember Dash', ['L', 'Shift']],
    ['Radiance', ['R']],
    ['Drink potions', ['1', '2', '3', '4']],
    ['Bag & equipment', ['I', 'Tab']],
    ['Journal', ['Q']],
    ['Map', ['M']],
    ['Pause', ['Esc']],
  ];
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
      {rows.map(([label, keys]) => (
        <div key={label} className="contents">
          <span className="text-parchment">{label}</span>
          <span className="text-right">
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
