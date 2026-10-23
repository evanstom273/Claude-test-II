import { useEffect, useMemo, useState } from 'react';
import { normLine, type Choice, type Dialogue } from '../data/dialogue';
import { sfx } from '../game/audio';
import { bus } from '../state/bus';
import { ui, uiStore, useUI } from '../state/uiStore';
import { Icon, Kbd, useKeys, useViewport } from './common';

function finish(node: Dialogue, run?: () => void) {
  const before = uiStore.getState().dialogue;
  run?.();
  const after = uiStore.getState();
  // The callback started another conversation; let it take over.
  if (after.dialogue !== before) return;
  if (node.next) {
    uiStore.setState({ dialogue: { ...before!, node: node.next, line: 0 } });
    return;
  }
  uiStore.setState({ dialogue: null });
  if (after.modal === 'dialogue') ui.close();
  bus.emit('dialogueEnded', { id: node.id });
}

export function DialogueBox() {
  const dlg = useUI((s) => s.dialogue);
  const [chars, setChars] = useState(0);
  const [choice, setChoice] = useState(0);
  const { w } = useViewport();
  const small = w < 640;

  const node = dlg?.node;
  const line = node ? normLine(node.lines[dlg!.line] ?? '') : null;
  const isLast = !!node && dlg!.line >= node.lines.length - 1;
  const choices: Choice[] = useMemo(() => (isLast && node?.choices ? node.choices.filter((c) => !c.when || c.when()) : []), [node, isLast]);
  const text = line?.text ?? '';
  const done = chars >= text.length;

  useEffect(() => {
    setChars(0);
    setChoice(0);
  }, [dlg?.node, dlg?.line]);

  useEffect(() => {
    if (!text) return;
    // Time-based so slow frames don't slow the text down.
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const tick = () => {
      const n = Math.min(text.length, Math.floor((performance.now() - start) / 16));
      if (n !== last) {
        if (Math.floor(n / 3) !== Math.floor(last / 3) && text[n - 1] !== ' ') sfx('blip');
        last = n;
        setChars((c) => Math.max(c, n));
      }
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, dlg?.node, dlg?.line]);

  const advance = () => {
    if (!dlg || !node) return;
    if (!done) {
      setChars(text.length);
      return;
    }
    if (!isLast) {
      uiStore.setState({ dialogue: { ...dlg, line: dlg.line + 1 } });
      return;
    }
    if (choices.length) return pick(choice);
    finish(node, node.onEnd);
  };

  const pick = (i: number) => {
    const c = choices[i];
    if (!c || !dlg) return;
    sfx('select');
    if (c.then) {
      c.action?.();
      // The action may have opened something else entirely (a shop).
      if (uiStore.getState().modal !== 'dialogue') {
        uiStore.setState({ dialogue: null });
        bus.emit('dialogueEnded', {});
        return;
      }
      uiStore.setState({ dialogue: { ...dlg, node: c.then, line: 0 } });
    } else {
      finish({ lines: [] }, c.action);
    }
  };

  useKeys(
    (e) => {
      if (!dlg) return;
      if (e.repeat) return;
      const k = e.key;
      if (choices.length && done) {
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
          setChoice((c) => (c - 1 + choices.length) % choices.length);
          sfx('move');
          return;
        }
        if (k === 'ArrowDown' || k === 's' || k === 'S') {
          setChoice((c) => (c + 1) % choices.length);
          sfx('move');
          return;
        }
        const n = Number(k);
        if (n >= 1 && n <= choices.length) return pick(n - 1);
      }
      if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E' || k === 'j' || k === 'J') {
        e.preventDefault();
        advance();
      }
    },
    !!dlg,
  );

  if (!dlg || !line) return null;
  const narration = line.who === '';
  const speaker = line.who === undefined ? dlg.speaker : line.who;
  const portrait = line.portrait ?? (line.who === undefined ? dlg.portrait : undefined);

  return (
    <div className="safe-pad absolute inset-x-0 bottom-0 z-40 flex justify-center" onClick={advance}>
      <div className="pixel-panel m-3 flex w-full max-w-3xl animate-rise gap-3 p-3 sm:m-6 sm:gap-4 sm:p-4">
        {portrait && !narration && (
          <div className="pixel-inset flex h-16 w-16 shrink-0 items-center justify-center bg-night sm:h-24 sm:w-24">
            <Icon frame={portrait} size={(portrait.endsWith('_0') && /thornmother|colossus|abbess|hollow/.test(portrait) ? 80 : 72) * (small ? 0.7 : 1)} />
          </div>
        )}
        <div className="min-h-20 flex-1 sm:min-h-24">
          {speaker && !narration && <div className="text-shadow mb-1 text-base text-ember-hi sm:text-lg">{speaker}</div>}
          <p className={`text-base leading-snug sm:text-lg ${narration ? 'italic text-dim' : 'text-parchment'}`}>
            {text.slice(0, chars)}
            <span className="opacity-0">{text.slice(chars)}</span>
          </p>
          {done && choices.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {choices.map((c, i) => (
                <button
                  key={c.label}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(i);
                  }}
                  onMouseEnter={() => setChoice(i)}
                  className={`cursor-pointer px-2 py-1 text-left text-base touch:py-2.5 ${i === choice ? 'bg-panel-2 text-ember-hi' : 'text-parchment'}`}
                >
                  <span className="mr-2 inline-block w-3">{i === choice ? '▸' : ''}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {done && !choices.length && (
            <div className="mt-2 text-right text-xs text-dim">
              <span className="inline-block animate-bob">
                <Kbd>E</Kbd>
                <span className="hidden text-ember-hi touch:inline">▼ tap</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
