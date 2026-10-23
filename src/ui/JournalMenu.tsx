import { useMemo, useState } from 'react';
import { EMBERS, QUEST_ORDER, QUESTS } from '../data/quests';
import { sfx } from '../game/audio';
import { useGameData } from '../state/gameStore';
import { ui } from '../state/uiStore';
import { Icon, Kbd, ModalShell, formatTime, useKeys } from './common';

export function JournalMenu() {
  const data = useGameData();
  const [index, setIndex] = useState(0);

  const entries = useMemo(() => {
    if (!data) return [];
    const list = QUEST_ORDER.filter((id) => data.quests[id]).map((id) => ({ id, def: QUESTS[id], state: data.quests[id]! }));
    return [...list.filter((q) => q.state.status === 'active'), ...list.filter((q) => q.state.status === 'complete')];
  }, [data]);

  useKeys((e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      setIndex((i) => Math.max(0, i - 1));
      sfx('move');
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      setIndex((i) => Math.min(entries.length - 1, i + 1));
      sfx('move');
    } else if (k === 'Escape' || k === 'q' || k === 'Q') {
      sfx('back');
      ui.close();
    }
  });

  if (!data) return null;
  const sel = entries[Math.min(index, entries.length - 1)];

  return (
    <ModalShell title="Journal" onClose={() => ui.close()} width={860}>
      <div className="flex min-h-0 flex-col gap-4 md:flex-row">
        <div className="pixel-inset scroll-thin w-full shrink-0 overflow-y-auto p-1 md:w-72" style={{ maxHeight: 'min(380px, 32vh)' }}>
          {entries.length === 0 && <div className="p-3 text-dim italic">No quests yet.</div>}
          {entries.map((q, i) => (
            <div
              key={q.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => setIndex(i)}
              className={`flex cursor-pointer items-center touch:py-2.5 gap-2 px-2 py-1.5 ${i === index ? 'bg-panel-2' : ''} ${q.state.status === 'complete' ? 'text-dim' : q.def.main ? 'text-ember-hi' : 'text-parchment'}`}
            >
              <span className="w-4 text-center">{q.state.status === 'complete' ? '✓' : q.def.main ? '✦' : '•'}</span>
              <span className={q.state.status === 'complete' ? 'line-through decoration-dim/60' : ''}>{q.def.title}</span>
            </div>
          ))}
        </div>
        <div className="pixel-inset min-h-48 flex-1 p-4">
          {sel ? (
            <>
              <div className="text-shadow text-2xl text-ember-hi">{sel.def.title}</div>
              <div className="mb-3 text-sm text-dim">From {sel.def.giver}</div>
              {sel.state.status === 'complete' ? (
                <p className="text-moss">{sel.def.done}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {sel.def.objective(data).map((line) => (
                    <li key={line} className="text-parchment">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              {sel.id === 'main' && (
                <div className="mt-5 flex gap-4">
                  {EMBERS.map((e, i) => {
                    const placed = !!data.flags[`placed:${e.key}`];
                    const held = (data.inventory[e.id] ?? 0) > 0;
                    return (
                      <div key={e.id} className="flex flex-col items-center gap-1 text-center text-xs">
                        <Icon frame={['icon_ember_green', 'icon_ember_stone', 'icon_ember_blue'][i]} size={36} className={placed ? 'animate-flicker' : held ? '' : 'opacity-20 grayscale'} />
                        <span className={placed ? 'text-ember-hi' : 'text-dim'}>{placed ? 'Burning' : held ? 'Carried' : 'Lost'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <span className="text-dim">-</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-dim">
        <span>
          Played {formatTime(data.stats.playtimeMs)} · Foes felled {data.stats.kills} · Falls {data.stats.deaths}
        </span>
        <span className="kbd-hint">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> browse · <Kbd>Esc</Kbd> close
        </span>
      </div>
    </ModalShell>
  );
}
