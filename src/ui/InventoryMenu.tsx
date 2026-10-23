import { useMemo, useState } from 'react';
import { ITEMS, isEquipment, type EquipSlot, type ItemDef } from '../data/items';
import { sfx } from '../game/audio';
import { game, useGameData } from '../state/gameStore';
import { derivedStats, xpToNext } from '../state/progression';
import { ui } from '../state/uiStore';
import { Icon, Kbd, ModalShell, useKeys } from './common';

const TABS = [
  { id: 'gear', label: 'Gear' },
  { id: 'items', label: 'Items' },
  { id: 'key', label: 'Key items' },
] as const;

type Tab = (typeof TABS)[number]['id'];

const KIND_ORDER = ['weapon', 'armor', 'charm', 'consumable', 'material', 'key'];

export function statLine(def: ItemDef): string {
  const parts: string[] = [];
  if (def.atk) parts.push(`ATK +${def.atk}`);
  if (def.def) parts.push(`DEF +${def.def}`);
  if (def.maxHp) parts.push(`HP +${def.maxHp}`);
  if (def.maxMp) parts.push(`MP +${def.maxMp}`);
  if (def.speed) parts.push(`Speed +${Math.round(def.speed * 100)}%`);
  if (def.goldFind) parts.push(`Gold +${Math.round(def.goldFind * 100)}%`);
  if (def.light) parts.push(`Light +${Math.round(def.light * 100)}%`);
  if (def.mpRegen) parts.push('MP regen ×2');
  if (def.heal && def.heal < 999) parts.push(`Heals ${def.heal}`);
  if (def.mana && def.mana < 999) parts.push(`+${def.mana} MP`);
  return parts.join(' · ');
}

/** "+3 ATK" style comparison against the item currently equipped in that slot. */
export function compare(def: ItemDef, equippedId: string | null | undefined) {
  if (!isEquipment(def)) return [];
  const cur = equippedId ? ITEMS[equippedId] : undefined;
  if (cur?.id === def.id) return [];
  const keys: [keyof ItemDef, string][] = [
    ['atk', 'ATK'],
    ['def', 'DEF'],
    ['maxHp', 'HP'],
    ['maxMp', 'MP'],
  ];
  const out: { label: string; delta: number }[] = [];
  for (const [k, label] of keys) {
    const delta = ((def[k] as number) ?? 0) - ((cur?.[k] as number) ?? 0);
    if (delta) out.push({ label, delta });
  }
  return out;
}

export function InventoryMenu() {
  const data = useGameData();
  const [tab, setTab] = useState<Tab>('gear');
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.inventory)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ def: ITEMS[id], count: n }))
      .filter(({ def }) => def && (tab === 'gear' ? isEquipment(def) : tab === 'items' ? def.kind === 'consumable' || def.kind === 'material' : def.kind === 'key'))
      .sort((a, b) => KIND_ORDER.indexOf(a.def.kind) - KIND_ORDER.indexOf(b.def.kind) || a.def.name.localeCompare(b.def.name));
  }, [data, tab]);

  const sel = items[Math.min(index, items.length - 1)];

  const activate = (i: number) => {
    const it = items[i];
    if (!it || !data) return;
    const def = it.def;
    if (isEquipment(def)) {
      if (data.equipment[def.kind] === def.id) {
        if (def.kind === 'weapon') return sfx('deny');
        game.unequip(def.kind);
      } else game.equip(def.id);
      sfx('select');
    } else if (def.kind === 'consumable') {
      if (game.useItem(def.id)) sfx('heal');
      else sfx('deny');
    } else sfx('deny');
  };

  const switchTab = (dir: number) => {
    const i = TABS.findIndex((t) => t.id === tab);
    setTab(TABS[(i + dir + TABS.length) % TABS.length].id);
    setIndex(0);
    sfx('move');
  };

  useKeys((e) => {
    const k = e.key;
    if (e.repeat && (k === 'Enter' || k === 'e' || k === 'E')) return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') switchTab(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') switchTab(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      setIndex((i) => Math.max(0, i - 1));
      sfx('move');
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      setIndex((i) => Math.min(items.length - 1, i + 1));
      sfx('move');
    } else if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ' || k === 'j' || k === 'J') {
      e.preventDefault();
      activate(index);
    } else if (k === 'Escape' || k === 'i' || k === 'I' || k === 'Tab') {
      e.preventDefault();
      sfx('back');
      ui.close();
    }
  });

  if (!data) return null;
  const s = derivedStats(data);
  const slots: EquipSlot[] = ['weapon', 'armor', 'charm'];

  return (
    <ModalShell title="Bag" onClose={() => ui.close()} width={900}>
      <div className="flex min-h-0 flex-col gap-4 md:flex-row">
        {/* Character */}
        <div className="pixel-inset flex w-full shrink-0 flex-col gap-3 p-3 md:w-64">
          <div className="flex items-center gap-3">
            <div className="pixel-panel flex h-16 w-16 items-center justify-center bg-night">
              <Icon frame="player_down_idle" size={48} />
            </div>
            <div>
              <div className="text-xl">{data.playerName}</div>
              <div className="text-sm text-dim">Keeper's apprentice · LV {data.level}</div>
              <div className="font-tiny text-[10px] text-gloam">
                XP {data.xp}/{xpToNext(data.level)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <span className="text-dim">HP</span>
            <span className="text-right">
              {data.hp}/{s.maxHp}
            </span>
            <span className="text-dim">MP</span>
            <span className="text-right">
              {data.mp}/{s.maxMp}
            </span>
            <span className="text-dim">Attack</span>
            <span className="text-right text-ember-hi">{s.atk}</span>
            <span className="text-dim">Defence</span>
            <span className="text-right text-ember-hi">{s.def}</span>
            {s.speed > 1 && (
              <>
                <span className="text-dim">Speed</span>
                <span className="text-right">+{Math.round((s.speed - 1) * 100)}%</span>
              </>
            )}
            <span className="text-dim">Gold</span>
            <span className="text-right text-ember-hi">{data.gold}</span>
          </div>
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const id = data.equipment[slot];
              const def = id ? ITEMS[id] : undefined;
              return (
                <div key={slot} className="flex items-center gap-2 bg-ink/40 px-2 py-1.5">
                  <div className="flex h-8 w-8 items-center justify-center">{def ? <Icon frame={def.icon} size={28} /> : <span className="text-dim">·</span>}</div>
                  <div className="min-w-0">
                    <div className="font-tiny text-[9px] tracking-wide text-dim uppercase">{slot === 'armor' ? 'armour' : slot}</div>
                    <div className="truncate text-sm">{def?.name ?? '-'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                tabIndex={-1}
                data-active={t.id === tab ? 'true' : 'false'}
                onClick={() => {
                  setTab(t.id);
                  setIndex(0);
                }}
                className="pixel-btn cursor-pointer px-3 py-1 text-sm"
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pixel-inset scroll-thin min-h-48 flex-1 overflow-y-auto p-1" style={{ maxHeight: 300 }}>
            {items.length === 0 && <div className="p-3 text-dim italic">Nothing here yet.</div>}
            {items.map((it, i) => {
              const def = it.def;
              const equipped = isEquipment(def) && data.equipment[def.kind] === def.id;
              return (
                <div
                  key={def.id}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => activate(i)}
                  className={`flex cursor-pointer items-center gap-3 px-2 py-1.5 ${i === index ? 'bg-panel-2 text-ember-hi' : ''}`}
                >
                  <Icon frame={def.icon} size={24} />
                  <span className="flex-1">{def.name}</span>
                  {equipped && <span className="font-tiny text-[9px] text-moss">EQUIPPED</span>}
                  {it.count > 1 && <span className="font-tiny text-xs text-dim">×{it.count}</span>}
                </div>
              );
            })}
          </div>
          <div className="pixel-inset mt-2 min-h-24 p-3">
            {sel ? (
              <>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-lg text-ember-hi">{sel.def.name}</span>
                  <span className="text-sm text-dim">{statLine(sel.def)}</span>
                </div>
                <p className="text-sm text-parchment/90">{sel.def.desc}</p>
                <div className="mt-1 flex gap-3 text-sm">
                  {isEquipment(sel.def) &&
                    compare(sel.def, data.equipment[sel.def.kind]).map((c) => (
                      <span key={c.label} className={c.delta > 0 ? 'text-moss' : 'text-blood'}>
                        {c.delta > 0 ? '▲' : '▼'} {c.label} {c.delta > 0 ? '+' : ''}
                        {c.delta}
                      </span>
                    ))}
                </div>
              </>
            ) : (
              <span className="text-dim">-</span>
            )}
          </div>
          <p className="mt-2 text-sm text-dim">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> tabs · <Kbd>Enter</Kbd> {tab === 'gear' ? 'equip' : tab === 'items' ? 'use' : 'inspect'} · <Kbd>Esc</Kbd> close
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
