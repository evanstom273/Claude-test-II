import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { frameDataUrl } from '../game/art/atlas';
import { sfx } from '../game/audio';

export function Icon({ frame, size = 32, flip = false, className = '', style }: { frame: string; size?: number; flip?: boolean; className?: string; style?: CSSProperties }) {
  const src = frameDataUrl(frame, flip);
  if (!src) return null;
  return <img src={src} alt="" draggable={false} className={`pixelated inline-block ${className}`} style={{ width: size, height: 'auto', ...style }} />;
}

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`pixel-panel ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Bar({ value, max, color, back = '#2a1e36', height = 10, className = '' }: { value: number; max: number; color: string; back?: string; height?: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`pixel-inset relative overflow-hidden ${className}`} style={{ height, background: back }}>
      <div className="absolute inset-y-0 left-0 transition-[width] duration-200" style={{ width: `${pct * 100}%`, background: color, boxShadow: 'inset 0 2px 0 rgb(255 255 255 / 0.25), inset 0 -2px 0 rgb(0 0 0 / 0.25)' }} />
    </div>
  );
}

export function Button({
  children,
  onClick,
  active,
  disabled,
  className = '',
  silent,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  silent?: boolean;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      data-active={active ? 'true' : 'false'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (!silent) sfx('select');
        onClick?.();
      }}
      className={`pixel-btn cursor-pointer px-4 py-2 text-left font-pixel text-parchment ${className}`}
    >
      {children}
    </button>
  );
}

/** Listen to keydown for as long as the component is mounted. */
export function useKeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [enabled]);
}

/** Up/down (and optionally left/right) navigation over a list. */
export function useListNav(count: number, index: number, setIndex: (i: number) => void, onSelect: (i: number) => void, opts: { onBack?: () => void; horizontal?: boolean; enabled?: boolean } = {}) {
  useKeys(
    (e) => {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E')) return;
      const prev = opts.horizontal ? ['ArrowLeft', 'a', 'A'] : ['ArrowUp', 'w', 'W'];
      const next = opts.horizontal ? ['ArrowRight', 'd', 'D'] : ['ArrowDown', 's', 'S'];
      if (prev.includes(e.key)) {
        e.preventDefault();
        if (count > 0) {
          setIndex((index - 1 + count) % count);
          sfx('move');
        }
      } else if (next.includes(e.key)) {
        e.preventDefault();
        if (count > 0) {
          setIndex((index + 1) % count);
          sfx('move');
        }
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (count > 0) onSelect(index);
      } else if ((e.key === 'Escape' || e.key === 'Backspace') && opts.onBack) {
        e.preventDefault();
        sfx('back');
        opts.onBack();
      }
    },
    opts.enabled ?? true,
  );
}

/** The window size, kept up to date. */
export function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const fn = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return size;
}

/** Toggle browser fullscreen, where supported. */
export function toggleFullscreen() {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
  } else {
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    void req?.call(el)?.catch?.(() => undefined);
  }
}

export const canFullscreen = typeof document !== 'undefined' && !!(document.fullscreenEnabled || (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);

export function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd mx-0.5 inline-block min-w-5 rounded-[2px] bg-ink px-1.5 py-0.5 text-center font-tiny text-[10px] leading-none text-ember-hi shadow-[0_0_0_1px_var(--color-edge)]">{children}</span>;
}

export function ModalShell({ title, children, onClose, width = 720, className = '' }: { title: ReactNode; children: ReactNode; onClose?: () => void; width?: number; className?: string }) {
  return (
    <div className="safe-pad absolute inset-0 z-30 flex animate-fade items-center justify-center bg-ink/60 backdrop-blur-[1px]">
      <Panel className={`relative m-3 flex max-h-[calc(100%-1.5rem)] w-full animate-rise flex-col p-3 sm:m-4 sm:p-5 ${className}`} style={{ maxWidth: width }}>
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-shadow text-xl text-ember-hi sm:text-2xl">{title}</h2>
          {onClose && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                sfx('back');
                onClose();
              }}
              className="cursor-pointer px-2 py-1 text-dim hover:text-parchment"
            >
              <Kbd>Esc</Kbd> <span className="touch:hidden">close</span>
              <span className="hidden text-2xl leading-none touch:inline">✕</span>
            </button>
          )}
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Panel>
    </div>
  );
}
