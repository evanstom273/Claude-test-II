import { useEffect, useMemo, useRef, useState } from 'react';
import { MAPS } from '../data/maps';
import { sfx } from '../game/audio';
import { parseMap } from '../game/world/parse';
import { minimapColor } from '../game/world/render';
import { useGameData } from '../state/gameStore';
import { worldBridge } from '../state/session';
import type { ZoneId } from '../state/types';
import { ui } from '../state/uiStore';
import { Kbd, ModalShell, useKeys, useViewport } from './common';

const ZONES: ZoneId[] = ['village', 'whisperwood', 'hollowdeep', 'saltmere', 'rift'];

function decode(b64: string | undefined, size: number): Uint8Array {
  const out = new Uint8Array(size);
  if (!b64) return out;
  try {
    const bin = atob(b64);
    for (let i = 0; i < Math.min(size, bin.length); i++) out[i] = bin.charCodeAt(i);
  } catch {
    // ignore
  }
  return out;
}

export function MapMenu() {
  const data = useGameData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blink, setBlink] = useState(true);
  const zone = data?.zone ?? 'village';
  const map = useMemo(() => parseMap(MAPS[zone]), [zone]);
  const vp = useViewport();

  useKeys((e) => {
    if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
      sfx('back');
      ui.close();
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => setBlink((b) => !b), 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !data) return;
    const explored = decode(data.explored[zone], Math.ceil((map.w * map.h) / 8));
    const scale = 4;
    c.width = map.w * scale;
    c.height = map.h * scale;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, c.width, c.height);
    const theme = map.def.theme;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!(explored[i >> 3] & (1 << (i & 7)))) continue;
        ctx.fillStyle = minimapColor(map.terrain[i], theme);
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    const seen = (x: number, y: number) => {
      const i = y * map.w + x;
      return !!(explored[i >> 3] & (1 << (i & 7)));
    };
    const dot = (x: number, y: number, color: string, size = 3) => {
      ctx.fillStyle = '#0b0a12';
      ctx.fillRect(x * scale + 2 - size / 2 - 1, y * scale + 2 - size / 2 - 1, size + 2, size + 2);
      ctx.fillStyle = color;
      ctx.fillRect(x * scale + 2 - size / 2, y * scale + 2 - size / 2, size, size);
    };
    for (const o of map.objects) {
      if (!seen(o.x, o.y)) continue;
      const d = o.def;
      if (d.type === 'npc') dot(o.x, o.y, '#6dbb4f');
      else if (d.type === 'chest' && !data.flags[`chest:${d.id}`]) dot(o.x, o.y, '#ffd56b');
      else if (d.type === 'hearth') dot(o.x, o.y, '#f2a33a', 5);
      else if (d.type === 'boss' && !data.flags[`boss:${d.boss}`]) dot(o.x, o.y, '#d64545', 5);
      else if (d.type === 'glowcap' && !data.flags[`glowcap:${d.id}`]) dot(o.x, o.y, '#5fd0c4');
      else if (d.type === 'gate' && !data.flags[`gate:${d.id}`]) dot(o.x, o.y, '#c7d0d8');
    }
  }, [data, map, zone]);

  if (!data) return null;
  const pos = worldBridge.getPlayerPos?.();
  // Fit the whole map on screen: beside the legend on wide screens, above it otherwise.
  const wide = vp.w >= 1024;
  const availW = wide ? Math.min(vp.w - 380, 720) : vp.w - 70;
  const availH = vp.h * (wide ? 0.66 : 0.6) - 40;
  const px = Math.max(2, Math.min(8, availW / map.w, availH / map.h));
  const exits = Object.values(map.regions).filter((r) => r.def.type === 'exit' || (r.def.type === 'shrine' && data.flags['rift_open']));

  return (
    <ModalShell title={map.def.name} onClose={() => ui.close()} width={980}>
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
        <div className="pixel-inset relative shrink-0 self-center p-2">
          <div className="relative" style={{ width: map.w * px, height: map.h * px }}>
            <canvas ref={canvasRef} className="pixelated block h-full w-full" />
            {pos && (
              <div
                className="absolute"
                style={{
                  left: `${(pos.x / (map.w * 16)) * 100}%`,
                  top: `${(pos.y / (map.h * 16)) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className={`h-3 w-3 rounded-full border-2 border-ink ${blink ? 'bg-flame' : 'bg-ember'}`} />
              </div>
            )}
            {exits.map((r, i) => {
              const x = r.tiles.reduce((s, t) => s + t.x, 0) / r.tiles.length;
              const y = r.tiles.reduce((s, t) => s + t.y, 0) / r.tiles.length;
              const to = r.def.type === 'exit' ? r.def.to : 'rift';
              return (
                <div
                  key={i}
                  className="text-shadow absolute font-tiny text-[10px] whitespace-nowrap text-parchment"
                  style={{ left: `${(x / map.w) * 100}%`, top: `${(y / map.h) * 100}%`, transform: `translate(${x < map.w * 0.15 ? '0' : x > map.w * 0.85 ? '-100%' : '-50%'}, ${y < 2 ? '10%' : y > map.h - 3 ? '-110%' : '-50%'})` }}
                >
                  ▸ {MAPS[to].name}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-56">
          <div className="pixel-inset p-3 text-sm">
            <div className="mb-2 text-ember-hi">Legend</div>
            {[
              ['#fff3b0', 'You'],
              ['#6dbb4f', 'Folk'],
              ['#ffd56b', 'Unopened chest'],
              ['#5fd0c4', 'Glowcap'],
              ['#c7d0d8', 'Locked gate'],
              ['#d64545', 'Something terrible'],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5" style={{ background: c, boxShadow: '0 0 0 1px #0b0a12' }} />
                {l}
              </div>
            ))}
          </div>
          <div className="pixel-inset p-3 text-sm">
            <div className="mb-2 text-ember-hi">The valley</div>
            {ZONES.map((z) => (
              <div key={z} className={z === zone ? 'text-flame' : data.flags[`visited:${z}`] ? 'text-parchment' : 'text-dim/50'}>
                {z === zone ? '▸ ' : ''}
                {data.flags[`visited:${z}`] || z === zone ? MAPS[z].name : '???'}
              </div>
            ))}
          </div>
          <p className="kbd-hint text-sm text-dim">
            <Kbd>M</Kbd> or <Kbd>Esc</Kbd> close
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
