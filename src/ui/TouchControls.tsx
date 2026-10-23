import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../game/audio';
import { touchInput, type TouchAction } from '../game/touchInput';
import { useGame } from '../state/gameStore';
import { ui, useUI } from '../state/uiStore';
import { Icon } from './common';
import { WEAPONS } from '../data/weapons';

const STICK_RADIUS = 54;
const DEADZONE = 0.16;

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
      const scaled = (mag - DEADZONE) / (1 - DEADZONE);
      const l = Math.hypot(dx, dy);
      touchInput.setStick((dx / l) * scaled, (dy / l) * scaled);
    }
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-0 left-0 h-[60%] w-1/2"
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
          <div className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ember/80 bg-ember/30 shadow-[0_0_12px_rgb(255_79_168/0.5)]" style={{ left: knob.x, top: knob.y }} />
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-[calc(2.5rem+env(safe-area-inset-bottom))] left-[calc(2.5rem+env(safe-area-inset-left))] h-32 w-32 rounded-full border-2 border-dashed border-parchment/15">
          <div className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-parchment/10" />
        </div>
      )}
    </div>
  );
}

function PadButton({ action, size, children, style, hold, className = '' }: { action: TouchAction; size: number; children: ReactNode; style?: React.CSSProperties; hold?: boolean; className?: string }) {
  const [down, setDown] = useState(false);
  const up = () => {
    setDown(false);
    touchInput.release(action);
  };
  useEffect(() => () => touchInput.release(action), [action]);
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`pointer-events-auto absolute flex items-center justify-center rounded-full border-2 transition-transform ${down ? 'scale-95 border-ember bg-panel-2/90' : 'border-edge-hi/70 bg-panel/75'} ${className}`}
      style={{ width: size, height: size, touchAction: 'none', boxShadow: '0 0 0 2px #0a0910, 0 4px 10px rgb(0 0 0 / 0.45)', ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        touchInput.press(action);
        if (!hold) window.setTimeout(() => touchInput.release(action), 60);
        buzz();
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function ActionPad() {
  const inCar = useUI((s) => s.inCar);
  const prompt = useUI((s) => s.prompt);
  const weapon = useGame((d) => d.current);
  const spec = weapon ? WEAPONS[weapon] : null;
  return (
    <div className="pointer-events-none absolute right-[calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] h-56 w-60">
      {prompt && (
        <button
          type="button"
          tabIndex={-1}
          className="pointer-events-auto absolute right-0 bottom-[178px] flex animate-rise items-center gap-2 rounded-full border-2 border-ember-hi bg-panel-2/95 px-4 py-2 text-base text-ember-hi shadow-[0_0_0_2px_#0a0910,0_0_14px_rgb(255_216_79/0.4)]"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            touchInput.press('interact');
            window.setTimeout(() => touchInput.release('interact'), 60);
            buzz(12);
          }}
        >
          {prompt}
        </button>
      )}
      {inCar ? (
        <>
          <PadButton action="handbrake" size={90} hold style={{ right: 0, bottom: 0 }}>
            <span className="font-tiny text-sm text-parchment">BRAKE</span>
          </PadButton>
          <PadButton action="horn" size={56} style={{ right: 104, bottom: 8 }}>
            <span className="text-xl">📯</span>
          </PadButton>
          <PadButton action="radio" size={56} style={{ right: 86, bottom: 78 }}>
            <span className="text-xl text-ember">♫</span>
          </PadButton>
        </>
      ) : (
        <>
          <PadButton action="attack" size={90} hold style={{ right: 0, bottom: 0 }}>
            {spec?.frame ? <Icon frame={spec.frame} size={52} /> : <span className="text-3xl">✊</span>}
          </PadButton>
          <PadButton action="weapon" size={56} style={{ right: 104, bottom: 8 }}>
            <span className="text-lg text-parchment">⇄</span>
          </PadButton>
          <PadButton action="eat" size={56} style={{ right: 86, bottom: 78 }}>
            <Icon frame="burger" size={26} />
          </PadButton>
        </>
      )}
    </div>
  );
}

function MenuButtons() {
  const open = (m: 'pause' | 'map') => {
    sfx('select');
    touchInput.clear();
    ui.open(m);
  };
  const btn = 'pointer-events-auto pixel-btn flex h-10 min-w-10 items-center justify-center px-2 text-sm';
  return (
    <div className="flex gap-1.5">
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('map')} aria-label="Map">
        <span className="font-tiny text-xs text-parchment">MAP</span>
      </button>
      <button type="button" tabIndex={-1} className={btn} onClick={() => open('pause')} aria-label="Phone">
        <span className="font-tiny text-xs text-parchment">☰</span>
      </button>
    </div>
  );
}

export function TouchControls() {
  const modal = useUI((s) => s.modal);
  useEffect(() => {
    if (modal) touchInput.clear();
  }, [modal]);
  if (modal) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" onContextMenu={(e) => e.preventDefault()}>
      <Joystick />
      <ActionPad />
      <div className="absolute top-[calc(9.6rem+env(safe-area-inset-top))] right-[calc(0.5rem+env(safe-area-inset-right))]">
        <MenuButtons />
      </div>
    </div>
  );
}
