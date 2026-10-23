import { useState } from 'react';
import { PLAYER_OUTFITS } from '../data/cast';
import { sfx } from '../game/audio';
import { bus } from '../state/bus';
import { game, useGameData } from '../state/gameStore';
import { ui } from '../state/uiStore';
import { Icon, ModalShell, useListNav } from './common';

const NAMES = ['Leather jacket', 'Hoodie & cap', 'Sharp suit', 'Tee & beanie', 'Trench & fedora'];

/** Change into any outfit you own, at home. */
export function Wardrobe() {
  const data = useGameData();
  const [index, setIndex] = useState(0);
  const owned = data?.outfits ?? [0];
  const pick = (i: number) => {
    const o = owned[i];
    sfx('select');
    game.update((d) => (d.outfit = o));
    bus.emit('outfitChanged', { outfit: o });
    ui.closeAll();
  };
  useListNav(owned.length, index, setIndex, pick, { onBack: () => ui.closeAll(), horizontal: true });
  return (
    <ModalShell title="Wardrobe" width={520} onClose={() => ui.closeAll()}>
      <div className="flex flex-wrap gap-3">
        {owned.map((o, i) => (
          <button
            key={o}
            type="button"
            tabIndex={-1}
            data-active={i === index ? 'true' : 'false'}
            onMouseEnter={() => setIndex(i)}
            onClick={() => pick(i)}
            className={`pixel-btn flex w-28 cursor-pointer flex-col items-center gap-1 px-2 py-3 ${data?.outfit === o ? 'text-moss' : ''}`}
          >
            <Icon frame={`${PLAYER_OUTFITS[o].id}_down_idle`} size={64} />
            <span className="text-sm">{NAMES[o]}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-dim">Buy more at clothes shops.</p>
    </ModalShell>
  );
}
