import { useState } from 'react';
import { PLAYER_OUTFITS } from '../data/cast';
import { ITEM_INFO, shopLines, type ShopLine } from '../data/shops';
import { WEAPONS } from '../data/weapons';
import { sfx } from '../game/audio';
import type { BuildingKind } from '../game/city/tiles';
import { bus } from '../state/bus';
import { game, useGameData } from '../state/gameStore';
import { ui, useUI } from '../state/uiStore';
import { Icon, ModalShell, useListNav } from './common';

function describe(line: ShopLine, owned: (w: string) => boolean, outfits: number[]): { name: string; desc: string; icon?: string; disabled?: string } {
  switch (line.kind) {
    case 'weapon': {
      const w = WEAPONS[line.weapon];
      return { name: w.name, desc: w.melee ? `Hits for ${w.damage}.` : `${w.ammo} rounds. ${w.damage}${w.pellets > 1 ? `×${w.pellets}` : ''} damage.`, icon: w.frame ?? undefined, disabled: w.melee && owned(line.weapon) ? 'Owned' : undefined };
    }
    case 'ammo': {
      const w = WEAPONS[line.weapon];
      return { name: `${w.name} ammo`, desc: `+${w.ammo} rounds.`, icon: 'ammo', disabled: owned(line.weapon) ? undefined : 'Need the gun' };
    }
    case 'item':
      return { name: line.name, desc: line.desc, icon: line.icon };
    case 'heal':
      return { name: line.name, desc: line.desc, icon: 'medkit' };
    case 'outfit': {
      const o = PLAYER_OUTFITS[line.outfit];
      const names = ['', 'Hoodie & cap', 'Sharp suit', 'Tee & beanie', 'Trench & fedora'];
      return { name: names[line.outfit] ?? 'Outfit', desc: outfits.includes(line.outfit) ? 'Yours. Wear it again for free.' : 'A new look. Changing here shakes off the police.', icon: `${o.id}_down_idle` };
    }
  }
}

export function ShopMenu() {
  const shop = useUI((s) => s.shop);
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const lines = shop ? shopLines(shop.kind as BuildingKind) : [];

  const buy = (i: number) => {
    const line = lines[i];
    if (!line || !data) return;
    const info = describe(line, (w) => game.hasWeapon(w as never), data.outfits);
    if (info.disabled) return sfx('deny');
    const free = line.kind === 'outfit' && data.outfits.includes(line.outfit);
    if (!free && !game.spend(line.price)) {
      sfx('deny');
      return ui.toast('Not enough cash.', 'warn', 1500);
    }
    sfx('buy');
    switch (line.kind) {
      case 'weapon':
        game.giveWeapon(line.weapon, WEAPONS[line.weapon].melee ? 1 : WEAPONS[line.weapon].ammo);
        game.update((d) => (d.current = line.weapon));
        bus.emit('weaponsChanged', {});
        break;
      case 'ammo':
        game.update((d) => (d.weapons[line.weapon] = (d.weapons[line.weapon] ?? 0) + WEAPONS[line.weapon].ammo));
        break;
      case 'item':
        if (line.now) {
          game.heal(ITEM_INFO[line.item].heal);
          ui.toast('Cheers.', 'info', 1200);
        } else game.addItem(line.item);
        break;
      case 'heal':
        game.heal(999);
        break;
      case 'outfit':
        game.update((d) => {
          d.outfit = line.outfit;
          if (!d.outfits.includes(line.outfit)) d.outfits.push(line.outfit);
        });
        bus.emit('outfitChanged', { outfit: line.outfit });
        if (ui.get().wanted > 0) {
          bus.emit('clearWanted', {});
          ui.toast('New look. The police lose track of you.', 'info');
        }
        break;
    }
  };

  useListNav(lines.length, index, setIndex, buy, { onBack: () => ui.closeAll() });
  if (!shop || !data) return null;

  return (
    <ModalShell title={shop.name} width={540} onClose={() => ui.closeAll()}>
      <div className="mb-2 text-right text-moss">${data.cash}</div>
      <div className="flex flex-col gap-1.5">
        {lines.map((line, i) => {
          const info = describe(line, (w) => game.hasWeapon(w as never), data.outfits);
          const free = line.kind === 'outfit' && data.outfits.includes(line.outfit);
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              data-active={i === index ? 'true' : 'false'}
              onMouseEnter={() => setIndex(i)}
              onClick={() => buy(i)}
              className="pixel-btn flex cursor-pointer items-center gap-3 px-3 py-2 text-left"
            >
              <div className="flex h-10 w-12 shrink-0 items-center justify-center">{info.icon && <Icon frame={info.icon} size={line.kind === 'outfit' ? 32 : info.icon.startsWith('w_') ? 40 : 24} />}</div>
              <div className="min-w-0 flex-1">
                <div className="text-base">{info.name}</div>
                <div className="text-sm text-dim">{info.desc}</div>
              </div>
              <div className={`shrink-0 text-right ${info.disabled ? 'text-dim' : free ? 'text-moss' : data.cash >= line.price ? 'text-ember-hi' : 'text-blood'}`}>{info.disabled ?? (free ? 'Wear' : `$${line.price}`)}</div>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
