import { useEffect, useState } from 'react';
import { ITEMS, QUICK_ITEMS } from '../data/items';
import { MAPS } from '../data/maps';
import { useGame, useGameData } from '../state/gameStore';
import { derivedStats, MAX_LEVEL, xpToNext } from '../state/progression';
import { useUI } from '../state/uiStore';
import { Bar, Icon, Kbd } from './common';

function Vitals() {
  const data = useGameData();
  if (!data) return null;
  const s = derivedStats(data);
  const low = data.hp / s.maxHp < 0.25;
  const showMp = data.abilities.bolt;
  const need = xpToNext(data.level);
  return (
    <div className="pixel-panel w-64 p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-shadow text-base text-parchment">{data.playerName}</span>
        <span className="font-tiny text-[11px] text-ember-hi">LV {data.level}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 font-tiny text-[10px] text-blood">HP</span>
        <Bar value={data.hp} max={s.maxHp} color={low ? '#ff4a4a' : '#d64545'} height={12} className={`flex-1 ${low ? 'animate-pulse' : ''}`} />
        <span className="w-14 text-right font-tiny text-[10px] text-dim">
          {data.hp}/{s.maxHp}
        </span>
      </div>
      {showMp && (
        <div className="mt-1 flex items-center gap-2">
          <span className="w-6 font-tiny text-[10px] text-mana">MP</span>
          <Bar value={data.mp} max={s.maxMp} color="#4a8fe0" height={9} className="flex-1" />
          <span className="w-14 text-right font-tiny text-[10px] text-dim">
            {data.mp}/{s.maxMp}
          </span>
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        <span className="w-6 font-tiny text-[10px] text-gloam">XP</span>
        <Bar value={data.level >= MAX_LEVEL ? 1 : data.xp} max={data.level >= MAX_LEVEL ? 1 : need} color="#a070e0" height={5} className="flex-1" />
        <span className="w-14" />
      </div>
    </div>
  );
}

function TopRight() {
  const gold = useGame((d) => d.gold);
  const zone = useGame((d) => d.zone);
  const saving = useUI((s) => s.saving);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="pixel-panel flex items-center gap-2 px-3 py-1.5">
        <Icon frame="coin_0" size={16} />
        <span className="text-shadow text-lg text-ember-hi">{gold}</span>
      </div>
      <div className="text-shadow text-sm text-dim">{zone ? MAPS[zone].name : ''}</div>
      {saving && <div className="text-shadow animate-pulse text-xs text-ember">Saving…</div>}
    </div>
  );
}

function QuickItems() {
  const inv = useGame((d) => d.inventory);
  if (!inv) return null;
  return (
    <div className="flex gap-2">
      {QUICK_ITEMS.map((id, i) => {
        const n = inv[id] ?? 0;
        return (
          <div key={id} className={`pixel-panel relative flex h-12 w-12 items-center justify-center ${n ? '' : 'opacity-40'}`} title={ITEMS[id].name}>
            <Icon frame={ITEMS[id].icon} size={32} />
            <span className="absolute -top-1.5 -left-1.5">
              <Kbd>{i + 1}</Kbd>
            </span>
            <span className="text-shadow absolute right-0.5 bottom-0 font-tiny text-[11px]">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function Abilities() {
  const abilities = useGame((d) => d.abilities);
  const cd = useUI((s) => s.cooldowns);
  if (!abilities) return null;
  const slots = [
    { id: 'attack', icon: 'icon_sword_iron', key: 'J', on: true, cd: 0 },
    { id: 'bolt', icon: 'icon_bolt', key: 'K', on: abilities.bolt, cd: cd.bolt },
    { id: 'dash', icon: 'icon_dash', key: 'L', on: abilities.dash, cd: cd.dash },
    { id: 'radiance', icon: 'icon_radiance', key: 'R', on: abilities.radiance, cd: cd.radiance },
  ];
  return (
    <div className="flex gap-2">
      {slots.map((s) => (
        <div key={s.id} className={`pixel-panel relative flex h-12 w-12 items-center justify-center overflow-hidden ${s.on ? '' : 'opacity-25 grayscale'}`}>
          <Icon frame={s.icon} size={32} />
          {s.cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-ink/70" style={{ height: `${s.cd * 100}%` }} />}
          <span className="absolute -top-1.5 -right-1.5">
            <Kbd>{s.key}</Kbd>
          </span>
        </div>
      ))}
    </div>
  );
}

function BossBar() {
  const boss = useUI((s) => s.boss);
  if (!boss) return null;
  return (
    <div className="absolute inset-x-0 top-4 z-10 flex animate-rise justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <div className="glow-ember mb-1 text-xl text-ember-hi">{boss.name}</div>
        <Bar value={boss.hp} max={boss.maxHp} color="linear-gradient(180deg,#e86a4a,#a02a3a)" height={14} />
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute top-24 right-4 z-20 flex w-72 flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`pixel-panel flex animate-rise items-center gap-2 px-3 py-2 text-sm ${t.kind === 'level' ? 'text-ember-hi' : t.kind === 'quest' ? 'text-flame' : t.kind === 'warn' ? 'text-blood' : 'text-parchment'}`}>
          {t.icon && <Icon frame={t.icon} size={20} />}
          {!t.icon && t.kind === 'quest' && <span className="text-ember">✦</span>}
          {!t.icon && t.kind === 'level' && <span className="text-ember-hi">▲</span>}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function Banner() {
  const banner = useUI((s) => s.banner);
  if (!banner) return null;
  return (
    <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[22%] z-10 flex animate-rise flex-col items-center text-center">
      <div className="glow-ember text-4xl text-ember-hi sm:text-5xl">{banner.title}</div>
      {banner.subtitle && <div className="text-shadow mt-2 max-w-xl px-4 text-lg text-parchment/90">{banner.subtitle}</div>}
    </div>
  );
}

function Prompt() {
  const prompt = useUI((s) => s.prompt);
  const modal = useUI((s) => s.modal);
  if (!prompt || modal) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center">
      <div className="pixel-panel animate-rise px-3 py-1.5 text-sm">
        <Kbd>E</Kbd> {prompt}
      </div>
    </div>
  );
}

function HurtFlash() {
  const tick = useUI((s) => s.hurtTick);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (tick) setKey((k) => k + 1);
  }, [tick]);
  if (!key) return null;
  return <div key={key} className="hurt-flash pointer-events-none absolute inset-0 z-[5]" />;
}

export function Hud() {
  const modal = useUI((s) => s.modal);
  const hidden = modal === 'ending';
  if (hidden) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div className="vignette absolute inset-0" />
      <HurtFlash />
      <div className="absolute top-4 left-4">
        <Vitals />
      </div>
      <div className="absolute top-4 right-4">
        <TopRight />
      </div>
      <div className="absolute bottom-4 left-4">
        <QuickItems />
      </div>
      <div className="absolute right-4 bottom-4">
        <Abilities />
      </div>
      <BossBar />
      <Banner />
      <Prompt />
      <Toasts />
    </div>
  );
}
