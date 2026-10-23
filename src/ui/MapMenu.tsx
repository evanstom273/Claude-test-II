import { useEffect, useRef } from 'react';
import { getCity } from '../game/city/cache';
import { TILE } from '../game/city/tiles';
import { CITY_SEED } from '../state/newGame';
import { ui, useUI } from '../state/uiStore';
import { ModalShell, useViewport } from './common';
import { cityMapCanvas } from './Minimap';

const LABELS: Partial<Record<string, [string, string]>> = {
  shop_guns: ['G', '#ff7a5a'],
  shop_food: ['F', '#6ad06a'],
  chippy: ['C', '#ffd84f'],
  shop_clothes: ['T', '#d86aff'],
  hospital: ['+', '#ffffff'],
  police: ['P', '#4fa8ff'],
  garage: ['$', '#ffd84f'],
  respray: ['R', '#4fe8ff'],
  bar: ['B', '#c89a4a'],
  club: ['♪', '#ff4fa8'],
  gang_hq: ['☠', '#e04848'],
  safehouse: ['⌂', '#6ad06a'],
};

const LEGEND: [string, string, string][] = [
  ['⌂', '#6ad06a', 'Your flat (save)'],
  ['G', '#ff7a5a', 'Guns'],
  ['F', '#6ad06a', 'Food'],
  ['C', '#ffd84f', 'Chippy'],
  ['T', '#d86aff', 'Clothes (lose the cops)'],
  ['R', '#4fe8ff', 'Respray (lose the cops)'],
  ['$', '#ffd84f', 'Chop shop (sell cars)'],
  ['+', '#ffffff', 'Hospital'],
  ['☠', '#e04848', 'Gang HQ'],
];

export function MapMenu() {
  const ref = useRef<HTMLCanvasElement>(null);
  const vp = useViewport();
  const player = useUI((s) => s.player);
  const markers = useUI((s) => s.markers);
  const city = getCity(CITY_SEED);
  const size = Math.max(200, Math.min(vp.w - 60, vp.h - 210, 720));

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cityMapCanvas(), 0, 0, c.width, c.height);
    const k = c.width / city.W;
    // Turf tints.
    const turfCol = ['', 'rgba(106,208,106,0.16)', 'rgba(160,112,224,0.18)', 'rgba(242,178,58,0.16)'];
    for (const b of city.blocks) {
      if (!b.gang) continue;
      ctx.fillStyle = turfCol[['vipers', 'crowns', 'rats'].indexOf(b.gang) + 1];
      ctx.fillRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0 + 1) * k, (b.y1 - b.y0 + 1) * k);
    }
    ctx.font = `bold ${Math.round(9 * dpr)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of city.buildings) {
      const l = LABELS[b.kind];
      if (!l) continue;
      const x = (b.x + b.w / 2) * k;
      const y = (b.y + b.h / 2) * k;
      ctx.fillStyle = '#0a0910';
      ctx.beginPath();
      ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = l[1];
      ctx.fillText(l[0], x, y + 0.5);
    }
    for (const m of markers) {
      ctx.fillStyle = m.kind === 'job' ? '#ffd84f' : m.kind === 'phone' ? '#4fe8ff' : '#6ad06a';
      ctx.beginPath();
      ctx.arc((m.x / TILE) * k, (m.y / TILE) * k, (m.kind === 'job' ? 6 : 4) * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0a0910';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((player.x / TILE) * k, (player.y / TILE) * k, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [size, player, markers, city]);

  return (
    <ModalShell title="Grimsport" width={size + 48} onClose={() => ui.close()}>
      <canvas ref={ref} className="pixelated mx-auto block" style={{ width: size, height: size }} />
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-dim">
        <span>
          <span className="text-parchment">●</span> You
        </span>
        <span>
          <span className="text-ember-hi">●</span> Job
        </span>
        <span>
          <span className="text-neon">●</span> Ringing phone
        </span>
        {LEGEND.map(([s, c, t]) => (
          <span key={t}>
            <span style={{ color: c }}>{s}</span> {t}
          </span>
        ))}
      </div>
    </ModalShell>
  );
}
