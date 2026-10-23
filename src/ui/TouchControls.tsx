import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../game/audio';
import { touchInput, type TouchAction } from '../game/touchInput';
import { useGame } from '../state/gameStore';
import { worldBridge } from '../state/session';
import { ui, useUI } from '../state/uiStore';
import { Icon } from './common';

const STICK_RADIUS = 52;
const DEADZONE = 0.18;

function buzz(ms = 8) {
  navigator.vibrate?.(ms);
}

/** A stick that appears wherever your thumb lands in the left-hand zone. */
function Joystick() {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const release = () => {
    pointer.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    touchInput.setStick(0, 0);
  };

  useEffect(() => release, []);

  const move = (cx: number, cy: number, o: { x: number; y: number }) => {
    let dx = cx - o.x;
    let dy = cy - o.y;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const mag = Math.min(1, len / STICK_RADIUS);
    if (mag < DEADZONE) touchInput.setStick(0, 0);
    else {
      // Remap so the stick ramps up smoothly from the edge of the dead zone.
      const scaled = (mag - DEADZONE) / (1 - DEADZONE);
      touchInput.setStick((dx / Math.hypot(dx, dy)) * scaled, (dy / Math.hypot(dx, dy)) * scaled);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-0 left-0 h-[58%] w-1/2"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const o = { x: e.clientX, y: e.clientY };
        setOrigin(o);
        move(e.clientX, e.clientY, o);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointer.current || !origin) return;
        move(e.clientX, e.clientY, origin);
      }}
      onPointerUp={(e) => e.pointerId === pointer.current && release()}
      onPointerCancel={(e) => e.pointerId === pointer.current && release()}
    >
      {origin ? (
        <div className="pointer-events-none fixed" style={{ left: origin.x, top: origin.y }}>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-parchment/30 bg-ink/35" style={{ width: STICK_RADIUS * 2 + 28, height: STICK_RADIUS * 2 + 28 }} />
          <div className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember-hi/80 bg-ember/40 shadow-[0_0_12px_rgb(242_163_58/0.5)]" style={{ left: knob.x, top: knob.y }} />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-[calc(2.5rem+env(safe-area-inset-left))] h-32 w-32 rounded-full border-2 border-dashed border-parchment/15">
          <div className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-parchment/10" />
        </div>
      )}
    </div>
  );
}

function PadButton({
  action,
  size,
  children,
  locked,
  cooldown = 0,
  repeatMs,
  className = '',
  style,
}: {
  action: TouchAction;
  size: number;
  children: ReactNode;
  locked?: boolean;
  cooldown?: number;
  repeatMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const timer = useRef<number | null>(null);
  const [down, setDown] = useState(false);
  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setDown(false);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`pointer-events-auto absolute flex items-center justify-center rounded-full border-2 transition-transform ${down ? 'scale-95 border-ember-hi bg-panel-2/90' : 'border-edge-hi/70 bg-panel/75'} ${locked ? 'opacity-35 grayscale' : ''} ${className}`}
      style={{ width: size, height: size, touchAction: 'none', boxShadow: '0 0 0 2px #0b0a12, 0 4px 10px rgb(0 0 0 / 0.45)', ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        touchInput.press(action);
        buzz();
        if (repeatMs) timer.current = window.setInterval(() => touchInput.press(action), repeatMs);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {cooldown > 0 && <span className="pointer-events-none absolute inset-0 rounded-full bg-ink/65" style={{ clipPath: `inset(${(1 - cooldown) * 100}% 0 0 0)` }} />}
    </button>
  );
}

function ActionPad() {
  const abilities = useGame((d) => d.abilities);
  const cd = useUI((s) => s.cooldowns);
  const prompt = useUI((s) => s.prompt);
  if (!abilities) return null;
  // Positions are offsets from the bottom-right corner of the pad.
  return (
    <div className="pointer-events-none absolute right-[calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] h-56 w-56">
      {prompt && (
        <button
          type="button"
          tabIndex={-1}
          className="pointer-events-auto absolute right-0 bottom-[170px] flex animate-rise items-center gap-2 rounded-full border-2 border-ember-hi bg-panel-2/95 px-4 py-2 text-base text-ember-hi shadow-[0_0_0_2px_#0b0a12,0_0_14px_rgb(242_163_58/0.45)]"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            touchInput.press('interact');
            buzz(12);
          }}
        >
          <span className="text-lg">✦</span> {prompt}
        </button>
      )}
      <PadButton action="attack" size={88} repeatMs={300} style={{ right: 0, bottom: 0 }}>
        <Icon frame="icon_sword_iron" size={44} />
      </PadButton>
      <PadButton action="dash" size={58} locked={!abilities.dash} cooldown={cd.dash} style={{ right: 100, bottom: 6 }}>
        <Icon frame="icon_dash" size={30} />
      </PadButton>
      <PadButton action="bolt" size={58} locked={!abilities.bolt} cooldown={cd.bolt} style={{ right: 84, bottom: 76 }}>
        <Icon frame="icon_bolt" size={30} />
      </PadButton>
      <PadButton action="radiance" size={58} locked={!abilities.radiance} cooldown={cd.radiance} style={{ right: 16, bottom: 100 }}>
        <Icon frame="icon_radiance" size={30} />
      </PadButton>
    </div>
  );
}

function MenuButtons() {
  const open = (m: 'pause' | 'inventory' | 'journal' | 'map') => {
    sfx('select');
    touchInput.clear();
    if (m === 'map') worldBridge.flush?.();
    ui.open(m);
  };
  const btn = 'pointer-events-auto pixel-btn flex h-10 min-w-10 items-center justify-center px-1.5 text-sm';
  return (
    <div className="flex gap-1.5 sm:gap-2">
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('inventory')} aria-label="Bag">
        <Icon frame="chest_closed" size={24} />
      </button>
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('journal')} aria-label="Journal">
        <Icon frame="sign" size={24} />
      </button>
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('map')} aria-label="Map">
        <span className="font-tiny text-xs text-parchment">MAP</span>
      </button>
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('pause')} aria-label="Pause">
        <span className="font-tiny text-sm text-parchment">❚❚</span>
      </button>
    </div>
  );
}

export function TouchControls() {
  const modal = useUI((s) => s.modal);
  // Never leave the stick held down behind a menu.
  useEffect(() => {
    if (modal) touchInput.clear();
  }, [modal]);
  if (modal) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" onContextMenu={(e) => e.preventDefault()}>
      <Joystick />
      <ActionPad />
      <div className="absolute top-[calc(6.4rem+env(safe-area-inset-top))] right-[calc(0.75rem+env(safe-area-inset-right))] sm:top-[calc(4.75rem+env(safe-area-inset-top))]">
        <MenuButtons />
      </div>
    </div>
  );
}
