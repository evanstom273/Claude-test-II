import { useEffect, useMemo, useRef } from 'react';
import { getCity } from '../game/city/cache';
import { paintMinimap } from '../game/city/paint';
import { TILE } from '../game/city/tiles';
import { CITY_SEED } from '../state/newGame';
import { uiStore, type UIState } from '../state/uiStore';

const MARKER: Record<UIState['markers'][number]['kind'], string> = { job: '#ffd84f', phone: '#4fe8ff', home: '#6ad06a', shop: '#ff4fa8' };

let mapCanvas: HTMLCanvasElement | null = null;
export function cityMapCanvas() {
  if (!mapCanvas) mapCanvas = paintMinimap(getCity(CITY_SEED));
  return mapCanvas;
}

/** A square window of the city map centred on the player, with job and phone markers. */
export function Minimap({ size = 112, tiles = 56 }: { size?: number; tiles?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = useMemo(() => cityMapCanvas(), []);

  useEffect(() => {
    const draw = (s: UIState) => {
      const c = ref.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      const dpr = 2;
      if (c.width !== size * dpr) {
        c.width = size * dpr;
        c.height = size * dpr;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#1e3a66';
      ctx.fillRect(0, 0, c.width, c.height);
      const ptx = s.player.x / TILE;
      const pty = s.player.y / TILE;
      const sx = ptx - tiles / 2;
      const sy = pty - tiles / 2;
      const k = c.width / tiles;
      ctx.drawImage(map, sx, sy, tiles, tiles, 0, 0, c.width, c.height);
      const t = performance.now();
      for (const m of s.markers) {
        let mx = (m.x / TILE - sx) * k;
        let my = (m.y / TILE - sy) * k;
        const off = mx < 6 || my < 6 || mx > c.width - 6 || my > c.height - 6;
        mx = Math.max(6, Math.min(c.width - 6, mx));
        my = Math.max(6, Math.min(c.height - 6, my));
        ctx.fillStyle = MARKER[m.kind];
        const pulse = m.kind === 'job' ? 1 + 0.3 * Math.sin(t / 150) : 1;
        const r = (off ? 4 : 6) * pulse;
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0a0910';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0a0910';
      ctx.beginPath();
      ctx.arc(c.width / 2, c.height / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    draw(uiStore.getState());
    const unsub = uiStore.subscribe(draw);
    const iv = window.setInterval(() => draw(uiStore.getState()), 120);
    return () => {
      unsub();
      window.clearInterval(iv);
    };
  }, [map, size, tiles]);

  return <canvas ref={ref} className="pixelated block rounded-full" style={{ width: size, height: size }} />;
}
