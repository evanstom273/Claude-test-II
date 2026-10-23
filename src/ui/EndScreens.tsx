import { useState } from 'react';
import { MAPS } from '../data/maps';
import { sfx } from '../game/audio';
import { enterWorld } from '../game/sceneControl';
import { game, useGameData } from '../state/gameStore';
import { autosave, quitToTitle, respawn } from '../state/session';
import { ui } from '../state/uiStore';
import { Icon, Kbd, Panel, formatTime, useListNav } from './common';

export function GameOver() {
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const options = [
    { label: 'Rise again', run: () => respawn() },
    { label: 'Return to title', run: () => quitToTitle() },
  ];
  useListNav(options.length, index, setIndex, (i) => options[i].run());
  if (!data) return null;
  return (
    <div className="absolute inset-0 z-40 flex animate-fade items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(40,8,16,0.75),rgb(5,3,8,0.95))] p-4">
      <div className="flex animate-rise flex-col items-center text-center">
        <h2 className="glow-ember mb-2 text-5xl text-blood">The Gloam takes you…</h2>
        <p className="text-shadow mb-8 max-w-md text-lg text-parchment/80">…but the Hearthlight remembers you. You'll wake at the edge of {MAPS[data.entry.zone].name}, a little poorer and a lot wiser.</p>
        <div className="flex w-64 flex-col gap-3">
          {options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              tabIndex={-1}
              data-active={i === index ? 'true' : 'false'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                sfx('select');
                o.run();
              }}
              className="pixel-btn cursor-pointer py-2.5 text-center text-xl"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-dim">You'll lose 10% of your gold.</p>
      </div>
    </div>
  );
}

export function Ending() {
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const options = [
    {
      label: 'Walk home in the dawn',
      run: () => {
        game.update((d) => {
          d.zone = 'village';
          d.pos = null;
          d.entry = { zone: 'village', spawn: 'rift' };
        });
        ui.closeAll();
        enterWorld('rift');
        autosave();
      },
    },
    { label: 'Return to title', run: () => quitToTitle() },
  ];
  useListNav(options.length, index, setIndex, (i) => {
    sfx('select');
    options[i].run();
  });
  if (!data) return null;
  const s = data.stats;
  return (
    <div className="absolute inset-0 z-50 flex animate-fade items-center justify-center overflow-y-auto bg-[linear-gradient(180deg,#2a1830_0%,#7a4a5a_45%,#f2b07a_100%)] p-4">
      <Panel className="w-full max-w-2xl animate-rise p-6 text-center">
        <div className="mb-3 flex justify-center gap-3">
          <Icon frame="icon_ember_green" size={36} className="animate-flicker" />
          <Icon frame="icon_ember_stone" size={36} className="animate-flicker" />
          <Icon frame="icon_ember_blue" size={36} className="animate-flicker" />
        </div>
        <h2 className="glow-ember mb-4 text-5xl text-ember-hi">Dawn</h2>
        <div className="mx-auto mb-5 max-w-xl space-y-3 text-lg leading-relaxed text-parchment/90">
          <p>The sun came up over Emberhold for the first time in living memory, and nobody quite knew what to do about it.</p>
          <p>Maren sat on the steps of the shrine and wept, and then told everyone she hadn't. Bram hammered a crown into a horseshoe. Ivo sold out of sun-cream he had invented that morning. Whiskers slept in the warmest patch of light in the valley, as was his right.</p>
          <p>The Hearthlight still burns. It always will. But it doesn't have to burn alone any more.</p>
          <p className="text-ember-hi">Thank you for playing, {data.playerName}.</p>
        </div>
        <div className="pixel-inset mx-auto mb-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-1 p-3 text-left text-sm">
          <span className="text-dim">Time</span>
          <span className="text-right">{formatTime(s.playtimeMs)}</span>
          <span className="text-dim">Level</span>
          <span className="text-right">{data.level}</span>
          <span className="text-dim">Foes felled</span>
          <span className="text-right">{s.kills}</span>
          <span className="text-dim">Falls</span>
          <span className="text-right">{s.deaths}</span>
          <span className="text-dim">Chests opened</span>
          <span className="text-right">{s.chestsOpened}</span>
          <span className="text-dim">Quests completed</span>
          <span className="text-right">{Object.values(data.quests).filter((q) => q?.status === 'complete').length} / 6</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          {options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              tabIndex={-1}
              data-active={i === index ? 'true' : 'false'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                sfx('select');
                o.run();
              }}
              className="pixel-btn w-72 cursor-pointer py-2 text-center text-lg"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-dim">
          <Kbd>Enter</Kbd> choose
        </p>
      </Panel>
    </div>
  );
}
