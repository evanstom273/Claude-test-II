import { useMemo, useState } from 'react';
import { ITEMS, isEquipment, sellPrice } from '../data/items';
import { SHOPS } from '../data/shops';
import { useTouch } from '../db/settings';
import { sfx } from '../game/audio';
import { game, useGameData } from '../state/gameStore';
import { ui, useUI } from '../state/uiStore';
import { Icon, Kbd, ModalShell, useKeys } from './common';
import { compare, statLine } from './InventoryMenu';

export function ShopMenu() {
  const shopId = useUI((s) => s.shopId);
  const data = useGameData();
  const touch = useTouch();
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const shop = shopId ? SHOPS[shopId] : undefined;

  const rows = useMemo(() => {
    if (!shop || !data) return [];
    if (mode === 'buy') return shop.stock().map((id) => ({ def: ITEMS[id], price: ITEMS[id].price ?? 0, owned: data.inventory[id] ?? 0 }));
    return Object.entries(data.inventory)
      .map(([id, n]) => ({ def: ITEMS[id], price: sellPrice(ITEMS[id]), owned: n }))
      .filter((r) => r.def && r.price > 0 && r.owned > 0)
      .filter((r) => !(isEquipment(r.def) && data.equipment[r.def.kind] === r.def.id && r.owned <= 1));
  }, [shop, data, mode]);

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 1800);
  };

  const act = (i: number) => {
    const r = rows[i];
    if (!r || !data) return;
    if (mode === 'buy') {
      if (isEquipment(r.def) && r.owned > 0) {
        sfx('deny');
        return say('You already own one of those.');
      }
      if (!game.spendGold(r.price)) {
        sfx('deny');
        return say("You can't afford that.");
      }
      game.giveItem(r.def.id, 1, true);
      sfx('coin');
      say(`Bought ${r.def.name}.`);
    } else {
      game.takeItem(r.def.id, 1);
      game.addGold(r.price);
      sfx('coin');
      say(`Sold ${r.def.name} for ${r.price}g.`);
      setIndex((x) => Math.max(0, Math.min(x, rows.length - 2)));
    }
  };

  useKeys((e) => {
    const k = e.key;
    if (e.repeat && (k === 'Enter' || k === 'e' || k === 'E')) return;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'A' || k === 'd' || k === 'D') {
      setMode((m) => (m === 'buy' ? 'sell' : 'buy'));
      setIndex(0);
      sfx('move');
    } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      setIndex((i) => Math.max(0, i - 1));
      sfx('move');
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      setIndex((i) => Math.min(rows.length - 1, i + 1));
      sfx('move');
    } else if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ' || k === 'j' || k === 'J') {
      e.preventDefault();
      act(index);
    } else if (k === 'Escape') {
      sfx('back');
      ui.closeAll();
    }
  });

  if (!shop || !data) return null;
  const sel = rows[Math.min(index, rows.length - 1)];

  return (
    <ModalShell title={shop.name} onClose={() => ui.closeAll()} width={820}>
      <div className="mb-3 flex items-center gap-3">
        <div className="pixel-inset flex h-14 w-14 items-center justify-center bg-night">
          <Icon frame={`${shop.portrait}_down_idle`} size={44} />
        </div>
        <p className="flex-1 text-base italic sm:text-lg">“{flash ?? shop.greeting}”</p>
        <div className="pixel-panel flex items-center gap-2 px-3 py-1.5">
          <Icon frame="coin_0" size={16} />
          <span className="text-lg text-ember-hi">{data.gold}</span>
        </div>
      </div>
      <div className="mb-2 flex gap-2">
        {(['buy', 'sell'] as const).map((m) => (
          <button
            key={m}
            type="button"
            tabIndex={-1}
            data-active={mode === m ? 'true' : 'false'}
            onClick={() => {
              setMode(m);
              setIndex(0);
            }}
            className="pixel-btn cursor-pointer px-4 py-1 capitalize"
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-col gap-3 md:flex-row">
        <div className="pixel-inset scroll-thin flex-1 overflow-y-auto p-1" style={{ maxHeight: 280, minHeight: 160 }}>
          {rows.length === 0 && <div className="p-3 text-dim italic">{mode === 'buy' ? 'Nothing for sale.' : 'Nothing you can sell here.'}</div>}
          {rows.map((r, i) => {
            const cantAfford = mode === 'buy' && r.price > data.gold;
            const owned = mode === 'buy' && isEquipment(r.def) && r.owned > 0;
            return (
              <div
                key={r.def.id}
                onMouseEnter={() => !touch && setIndex(i)}
                onClick={() => (touch ? setIndex(i) : act(i))}
                className={`flex cursor-pointer items-center gap-3 px-2 py-1.5 touch:py-2.5 ${i === index ? 'bg-panel-2 text-ember-hi' : ''} ${cantAfford || owned ? 'opacity-50' : ''}`}
              >
                <Icon frame={r.def.icon} size={24} />
                <span className="flex-1">{r.def.name}</span>
                {owned && <span className="font-tiny text-[9px] text-moss">OWNED</span>}
                {mode === 'sell' && r.owned > 1 && <span className="font-tiny text-xs text-dim">×{r.owned}</span>}
                <span className="w-16 text-right text-ember-hi">{r.price}g</span>
              </div>
            );
          })}
        </div>
        <div className="pixel-inset w-full p-3 md:w-72">
          {sel ? (
            <>
              <div className="text-lg text-ember-hi">{sel.def.name}</div>
              <div className="mb-1 text-sm text-dim">{statLine(sel.def)}</div>
              <p className="text-sm">{sel.def.desc}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {isEquipment(sel.def) &&
                  compare(sel.def, data.equipment[sel.def.kind]).map((c) => (
                    <span key={c.label} className={c.delta > 0 ? 'text-moss' : 'text-blood'}>
                      {c.delta > 0 ? '▲' : '▼'} {c.label} {c.delta > 0 ? '+' : ''}
                      {c.delta}
                    </span>
                  ))}
              </div>
              {!isEquipment(sel.def) && <div className="mt-2 text-sm text-dim">You have {data.inventory[sel.def.id] ?? 0}.</div>}
              <button type="button" tabIndex={-1} className="pixel-btn mt-3 cursor-pointer px-4 py-1.5 text-sm text-ember-hi" onClick={() => act(Math.min(index, rows.length - 1))}>
                {mode === 'buy' ? `Buy for ${sel.price}g` : `Sell for ${sel.price}g`}
              </button>
            </>
          ) : (
            <span className="text-dim">-</span>
          )}
        </div>
      </div>
      <p className="kbd-hint mt-3 text-sm text-dim">
        <Kbd>←</Kbd>
        <Kbd>→</Kbd> buy/sell · <Kbd>Enter</Kbd> {mode} · <Kbd>Esc</Kbd> leave
      </p>
    </ModalShell>
  );
}
