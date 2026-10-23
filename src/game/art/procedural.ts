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
  key: 'shadow_car',
  w: 28,
  h: 16,
  draw: pixels(28, 16, (x, y) => {
    const dx = Math.max(0, Math.abs(x + 0.5 - 14) - 8) / 6;
    const dy = Math.max(0, Math.abs(y + 0.5 - 8) - 2) / 6;
    return dx * dx + dy * dy <= 1 ? 'rgba(10,6,20,0.4)' : null;
  }),
});

items.push({
  key: 'ring',
  w: 64,
  h: 64,
  draw: pixels(64, 64, (x, y) => {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
    if (r > 31.5 || r < 28) return null;
    return r > 30 ? '#ffffff' : 'rgba(255,255,255,0.6)';
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
