import { useEffect, useState } from 'react';
import { WEAPONS } from '../data/weapons';
import { useGame } from '../state/gameStore';
import { useUI } from '../state/uiStore';
import { Bar, Icon, Kbd } from './common';
import { Minimap } from './Minimap';

function clock(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function Stars() {
  const wanted = useUI((s) => s.wanted);
  const flashing = useUI((s) => s.wantedFlashing);
  return (
    <div className={`flex gap-0.5 ${flashing ? 'star-flash' : ''}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} frame="star" size={18} className={i < wanted ? 'drop-shadow-[0_0_4px_rgb(255_216_79/0.9)]' : 'opacity-15 grayscale'} />
      ))}
    </div>
  );
}

function PlayerPanel() {
  const health = useGame((d) => d.health);
  const max = useGame((d) => d.maxHealth);
  const cash = useGame((d) => d.cash);
  const weapon = useGame((d) => d.current);
  const ammo = useGame((d) => d.weapons[d.current]);
  const food = useGame((d) => (d.items.burger ?? 0) + (d.items.chips ?? 0) + (d.items.medkit ?? 0));
  if (health === undefined) return null;
  const spec = WEAPONS[weapon];
  return (
    <div className="pixel-panel w-44 p-2 sm:w-52">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xl text-moss">${cash.toLocaleString()}</span>
        {food > 0 && (
          <span className="flex items-center gap-1 text-sm text-dim">
            <Icon frame="burger" size={14} />×{food}
          </span>
        )}
      </div>
      <Bar value={health} max={max} color={health < 30 ? '#e04848' : '#d64571'} height={9} />
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <div className="flex h-6 w-10 items-center justify-center">{spec.frame ? <Icon frame={spec.frame} size={spec.id === 'pistol' ? 22 : 34} /> : <span className="text-base">✊</span>}</div>
        <span className="text-parchment">{spec.name}</span>
        {!spec.melee && <span className="ml-auto text-ember-hi">{ammo ?? 0}</span>}
      </div>
    </div>
  );
}

function Objective() {
  const job = useGame((d) => d.job);
  if (!job) return null;
  const secs = job.timeLeftMs !== undefined ? Math.max(0, Math.ceil(job.timeLeftMs / 1000)) : null;
  return (
    <div className="pixel-panel max-w-[60vw] px-3 py-1.5 text-center text-sm sm:text-base">
      <span className="text-ember-hi">{job.title}</span>
      {job.type === 'cull' && <span className="ml-2 text-dim">{job.progress ?? 0}/{job.count}</span>}
      {secs !== null && <span className={`ml-2 ${secs < 15 ? 'text-blood' : 'text-neon'}`}>{secs}s</span>}
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`text-shadow animate-rise rounded-sm px-3 py-1 text-sm sm:text-base ${t.kind === 'warn' ? 'bg-blood/25 text-[#ffb0b0]' : t.kind === 'radio' ? 'bg-ember/20 text-ember glow-ember' : t.kind === 'job' ? 'bg-ember-hi/15 text-ember-hi' : t.kind === 'cash' ? 'text-moss' : 'bg-ink/50 text-parchment'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

function BigText() {
  const big = useUI((s) => s.big);
  if (!big) return null;
  return (
    <div key={big.id} className="pointer-events-none absolute inset-x-0 top-[34%] flex animate-rise flex-col items-center text-center">
      <div className="text-6xl tracking-widest sm:text-8xl" style={{ color: big.color, textShadow: `0 0 18px ${big.color}99, 4px 4px 0 #0a0910` }}>
        {big.text}
      </div>
      {big.sub && <div className="text-shadow mt-2 text-lg text-parchment sm:text-xl">{big.sub}</div>}
    </div>
  );
}

function CarPanel() {
  const car = useUI((s) => s.inCar);
  const station = useUI((s) => s.station);
  if (!car) return null;
  return (
    <div className="pixel-panel flex items-center gap-3 px-3 py-1.5 text-sm">
      <span>{car.name}</span>
      <Bar value={car.hp} max={1} color={car.hp < 0.3 ? '#e04848' : '#6ad06a'} height={7} className="w-16" />
      {station && <span className="text-ember">♫ {station}</span>}
    </div>
  );
}

function Prompt() {
  const prompt = useUI((s) => s.prompt);
  if (!prompt) return null;
  return (
    <div className="kbd-hint pixel-panel px-3 py-1 text-sm">
      <Kbd>E</Kbd> {prompt}
    </div>
  );
}

function HurtFlash() {
  const at = useUI((s) => s.hurtAt);
  const [, force] = useState(0);
  useEffect(() => {
    if (!at) return;
    force((n) => n + 1);
  }, [at]);
  if (!at || performance.now() - at > 400) return null;
  return <div key={at} className="hurt-flash pointer-events-none absolute inset-0" />;
}

export function Hud() {
  const clockMin = useGame((d) => d.clock);
  const day = useGame((d) => d.day);
  return (
    <div className="safe-pad pointer-events-none absolute inset-0 z-10 select-none">
      <HurtFlash />
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
        <PlayerPanel />
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5 sm:top-3 sm:right-3">
        <div className="flex items-center gap-2">
          <Stars />
          <span className="text-shadow font-tiny text-sm text-parchment">
            {clockMin !== undefined ? clock(clockMin) : ''} <span className="text-dim">D{day}</span>
          </span>
        </div>
        <div className="rounded-full shadow-[0_0_0_3px_#0a0910,0_0_0_5px_#45405e]">
          <Minimap />
        </div>
      </div>
      <div className="absolute inset-x-0 top-2 flex flex-col items-center gap-1.5 sm:top-3">
        <div className="max-sm:mt-[118px]">
          <Objective />
        </div>
        <Toasts />
      </div>
      <BigText />
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1.5">
        <CarPanel />
        <Prompt />
      </div>
    </div>
  );
}
