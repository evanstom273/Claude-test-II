/** Textures drawn with code rather than pixel strings. Packed into the atlas. */

type Draw = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;

export interface ProcItem {
  key: string;
  w: number;
  h: number;
  draw: Draw;
}

function pixels(w: number, h: number, fn: (px: number, py: number) => string | null): Draw {
  return (ctx, ox, oy) => {
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const c = fn(px, py);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + px, oy + py, 1, 1);
      }
    }
  };
}

const items: ProcItem[] = [];

items.push({
  key: 'shadow',
  w: 12,
  h: 5,
  draw: pixels(12, 5, (x, y) => {
    const dx = (x + 0.5 - 6) / 6;
    const dy = (y + 0.5 - 2.5) / 2.5;
    return dx * dx + dy * dy <= 1 ? 'rgba(10,6,20,0.38)' : null;
  }),
});

items.push({
  key: 'shadow_big',
  w: 28,
  h: 9,
  draw: pixels(28, 9, (x, y) => {
    const dx = (x + 0.5 - 14) / 14;
    const dy = (y + 0.5 - 4.5) / 4.5;
    return dx * dx + dy * dy <= 1 ? 'rgba(10,6,20,0.38)' : null;
  }),
});

items.push({ key: 'px', w: 2, h: 2, draw: pixels(2, 2, () => '#ffffff') });
items.push({ key: 'px1', w: 1, h: 1, draw: pixels(1, 1, () => '#ffffff') });

items.push({
  key: 'dot',
  w: 5,
  h: 5,
  draw: pixels(5, 5, (x, y) => {
    const d = Math.hypot(x - 2, y - 2);
    return d <= 1.2 ? '#ffffff' : d <= 2.3 ? 'rgba(255,255,255,0.55)' : null;
  }),
});

items.push({
  key: 'spark',
  w: 7,
  h: 7,
  draw: pixels(7, 7, (x, y) => {
    if (x === 3 && y === 3) return '#ffffff';
    if ((x === 3 && Math.abs(y - 3) <= 3) || (y === 3 && Math.abs(x - 3) <= 3)) return Math.abs(x - 3) + Math.abs(y - 3) <= 1 ? '#ffffff' : '#fff3b0';
    return null;
  }),
});

items.push({
  key: 'leaf',
  w: 4,
  h: 3,
  draw: pixels(4, 3, (x, y) => ((x + y) % 4 === 3 ? null : y === 1 ? '#7dc85a' : '#4f9a3c')),
});

/** Sword slash crescents facing right, in three stages. */
function slash(stage: number): Draw {
  const cx = 6;
  const cy = 16;
  const spans = [
    [-80, -15],
    [-80, 55],
    [-10, 80],
  ];
  const [a0, a1] = spans[stage];
  return pixels(32, 32, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const r = Math.hypot(dx, dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < a0 || ang > a1) return null;
    // Thicker in the middle of the arc.
    const t = (ang - a0) / (a1 - a0);
    const thick = 2 + Math.sin(t * Math.PI) * 4;
    const inner = 18 - thick;
    if (r < inner || r > 18) return null;
    const edge = r > 17 ? '#ffffff' : r > 15.5 ? '#fff6d0' : 'rgba(255,214,120,0.75)';
    return stage === 2 && t < 0.3 ? 'rgba(255,240,200,0.5)' : edge;
  });
}
for (let i = 0; i < 3; i++) items.push({ key: `slash_${i}`, w: 32, h: 32, draw: slash(i) });

items.push({
  key: 'ring',
  w: 64,
  h: 64,
  draw: pixels(64, 64, (x, y) => {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
    if (r > 31.5 || r < 27) return null;
    return r > 30 ? '#fff3b0' : r > 28.5 ? '#ffd56b' : 'rgba(242,163,58,0.6)';
  }),
});

items.push({
  key: 'portal',
  w: 32,
  h: 32,
  draw: pixels(32, 32, (x, y) => {
    const dx = x + 0.5 - 16;
    const dy = y + 0.5 - 16;
    const r = Math.hypot(dx, dy);
    if (r > 15) return null;
    const a = Math.atan2(dy, dx);
    const swirl = Math.sin(a * 3 + r * 0.55);
    if (r < 4) return '#f0d8ff';
    if (swirl > 0.55) return '#a070e0';
    if (swirl > -0.2) return '#4b2e75';
    return r > 13 ? '#2a1a40' : '#1a0f2a';
  }),
});

items.push({
  key: 'rift_crack',
  w: 16,
  h: 16,
  draw: pixels(16, 16, (x, y) => {
    const on = Math.abs(x - 8 - Math.sin(y * 0.9) * 3) < 1 || (y > 9 && Math.abs(x - 3 - (y - 9)) < 0.8);
    return on ? '#a070e0' : null;
  }),
});

export const PROCEDURAL: ProcItem[] = items;

/** A smooth radial gradient, used to cut light out of darkness. */
export function makeLightCanvas(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
