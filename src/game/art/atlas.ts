import { FRAMES, FRAME_MAP } from './registry';
import { drawRows, spriteSize } from './pixels';
import { PROCEDURAL } from './procedural';
import { PROPS } from './props';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  rects: Record<string, Rect>;
}

const PAD = 2;
const WIDTH = 2048;

/** Pack every pixel-art frame and procedural texture into a single canvas. */
export function buildAtlas(): Atlas {
  type Item = { key: string; w: number; h: number; draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void };
  const items: Item[] = [];
  for (const f of FRAMES) {
    const { w, h } = spriteSize(f.rows);
    items.push({ key: f.key, w, h, draw: (ctx, x, y) => drawRows(ctx, f.rows, f.palette, x, y) });
  }
  for (const p of PROCEDURAL) items.push(p);
  for (const p of PROPS) items.push(p);

  items.sort((a, b) => b.h - a.h || b.w - a.w);

  const rects: Record<string, Rect> = {};
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  for (const it of items) {
    if (x + it.w + PAD > WIDTH) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    rects[it.key] = { x, y, w: it.w, h: it.h };
    x += it.w + PAD;
    shelf = Math.max(shelf, it.h);
  }
  const height = y + shelf + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = Math.pow(2, Math.ceil(Math.log2(height)));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const it of items) {
    const r = rects[it.key];
    it.draw(ctx, r.x, r.y);
  }
  return { canvas, rects };
}

const iconCache = new Map<string, string>();

/** A data URL of a single frame, for use in the React UI. */
export function frameDataUrl(key: string, flip = false): string {
  const cacheKey = flip ? `${key}:flip` : key;
  const hit = iconCache.get(cacheKey);
  if (hit) return hit;
  const f = FRAME_MAP[key];
  const proc = f ? undefined : [...PROCEDURAL, ...PROPS].find((p) => p.key === key);
  if (!f && !proc) return '';
  const { w, h } = f ? spriteSize(f.rows) : { w: proc!.w, h: proc!.h };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (f) drawRows(ctx, f.rows, f.palette, 0, 0, flip);
  else proc!.draw(ctx, 0, 0);
  const url = canvas.toDataURL();
  iconCache.set(cacheKey, url);
  return url;
}
