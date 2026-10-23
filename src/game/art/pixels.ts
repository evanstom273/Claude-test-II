/** Palette-indexed pixel art helpers. A sprite is an array of equal-length strings. */

export type Palette = Record<string, string | null>;

/** The shared base palette. Individual sprites override entries. */
export const BASE: Palette = {
  '.': null,
  k: '#1a1423', // outline
  K: '#3b2d3f', // soft outline / deep shade
  w: '#f4efe4', // white
  W: '#c9c2b3', // white shade
  s: '#f2c39b', // skin
  S: '#d39773', // skin shade
  e: '#2a1f2e', // eye
  h: '#7a4a2a', // hair
  H: '#55321c', // hair shade
  c: '#b8433b', // clothes
  C: '#842c2a', // clothes shade
  p: '#4b3a52', // trousers
  P: '#33263a', // trousers shade
  b: '#5a3a2a', // boots
  B: '#3d2618', // boots shade
  l: '#8a5a3b', // leather
  L: '#5f3b26', // leather shade
  m: '#c7d0d8', // metal
  M: '#8892a0', // metal shade
  g: '#f2c14e', // gold
  G: '#b8862b', // gold shade
  r: '#d64545', // red
  R: '#8f2b3a', // dark red
  o: '#f2a33a', // orange
  y: '#ffd56b', // yellow
  f: '#fff3b0', // flame core
  v: '#6dbb4f', // green
  V: '#3a7a35', // dark green
  n: '#4a7bd0', // blue
  N: '#2c4f94', // dark blue
  t: '#5fd0c4', // teal
  T: '#2e8a80', // dark teal
  u: '#8a5fc0', // purple
  U: '#4b2e75', // dark purple
  a: '#9a98a8', // grey
  A: '#605d70', // dark grey
  x: '#000000',
};

export interface SpriteDef {
  rows: string[];
  palette?: Palette;
}

export function spriteSize(rows: string[]): { w: number; h: number } {
  return { w: rows.reduce((m, r) => Math.max(m, r.length), 0), h: rows.length };
}

export function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Palette,
  ox: number,
  oy: number,
  flip = false,
): void {
  const { w } = spriteSize(rows);
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const color = ch in palette ? palette[ch] : BASE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + (flip ? w - 1 - x : x), oy + y, 1, 1);
    }
  }
}

/** Overlay `top` onto `base`; non-'.' characters of `top` win. */
export function layer(base: string[], top: string[]): string[] {
  return base.map((row, y) => {
    const t = top[y] ?? '';
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const c = t[x];
      out += c && c !== '.' && c !== ' ' ? c : row[x];
    }
    return out;
  });
}

/** Shift a sprite's pixels by dx, dy (pixels shifted off the edge are lost). */
export function shift(rows: string[], dx: number, dy: number): string[] {
  const h = rows.length;
  const w = rows[0].length;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const sy = y - dy;
      const sx = x - dx;
      line += sy >= 0 && sy < h && sx >= 0 && sx < w ? rows[sy][sx] : '.';
    }
    out.push(line);
  }
  return out;
}

/** Replace characters in a sprite, e.g. to strip an accessory. */
export function recolor(rows: string[], map: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((c) => map[c] ?? c).join(''));
}

/** Small seeded RNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
