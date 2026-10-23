/*
 * Shape and lighting helpers for sprites drawn from geometry rather than typed
 * pixels. Shapes are tests on continuous coordinates; lights return a value
 * where higher means more lit (top-left light, like everything else).
 */

export type Shape = (x: number, y: number) => boolean;
export type Light = (x: number, y: number) => number;

export const superellipse =
  (cx: number, cy: number, rx: number, ry: number, n = 2): Shape =>
  (x, y) =>
    Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1;

export const ellipse = (cx: number, cy: number, rx: number, ry: number) => superellipse(cx, cy, rx, ry, 2);

export const rrect =
  (x0: number, y0: number, x1: number, y1: number, r: number): Shape =>
  (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
    const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
    return dx * dx + dy * dy <= r * r;
  };

/** A rounded line from (x0, y0) to (x1, y1): limbs. */
export const capsule =
  (x0: number, y0: number, x1: number, y1: number, r: number): Shape =>
  (x, y) => {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t)) <= r;
  };

export const union =
  (...fs: Shape[]): Shape =>
  (x, y) =>
    fs.some((f) => f(x, y));

export const intersect =
  (...fs: Shape[]): Shape =>
  (x, y) =>
    fs.every((f) => f(x, y));

export const minus =
  (a: Shape, b: Shape): Shape =>
  (x, y) =>
    a(x, y) && !b(x, y);

/** Mirror around the vertical centre line of a `width`-unit canvas. */
export const mirror =
  (f: Shape, width = 64): Shape =>
  (x, y) =>
    f(width - x, y);

export const shift =
  <T>(f: (x: number, y: number) => T, dx: number, dy: number) =>
  (x: number, y: number) =>
    f(x - dx, y - dy);

export const below =
  (y0: number): Shape =>
  (_x, y) =>
    y >= y0;
export const above =
  (y0: number): Shape =>
  (_x, y) =>
    y < y0;

/** Piecewise-linear y at x through sorted points. */
export function polyline(points: [number, number][]) {
  return (x: number) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return points[points.length - 1][1];
  };
}

const L = (() => {
  const v = [-0.55, -0.7, 0.62];
  const len = Math.hypot(...v);
  return v.map((c) => c / len);
})();

export const sphere =
  (cx: number, cy: number, rx: number, ry: number): Light =>
  (x, y) => {
    let nx = (x - cx) / rx;
    let ny = (y - cy) / ry;
    const d = Math.hypot(nx, ny);
    if (d > 0.98) {
      nx /= d / 0.98;
      ny /= d / 0.98;
    }
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return nx * L[0] + ny * L[1] + nz * L[2];
  };

export const cylinder =
  (cx: number, rx: number, tilt = 0.25): Light =>
  (x) => {
    const nx = Math.max(-0.98, Math.min(0.98, (x - cx) / rx));
    return nx * L[0] - tilt * L[1] + Math.sqrt(1 - nx * nx) * L[2];
  };

export const flat =
  (v: number): Light =>
  () =>
    v;

/** Fold lone pixels into their neighbours when at least two of them agree. */
export function cleanup(grid: string[][], keep: string, passes = 2) {
  const H = grid.length;
  const W = grid[0].length;
  for (let pass = 0; pass < passes; pass++)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const c = grid[y][x];
        if (c === '.' || keep.includes(c)) continue;
        const n = [grid[y - 1][x], grid[y + 1][x], grid[y][x - 1], grid[y][x + 1]];
        if (n.includes(c)) continue;
        const counts: Record<string, number> = {};
        for (const v of n) if (v !== '.') counts[v] = (counts[v] ?? 0) + 1;
        const best = Object.entries(counts).sort((p, q) => q[1] - p[1])[0];
        if (best && best[1] >= 2) grid[y][x] = best[0];
      }
}

/** A one-pixel outline around the silhouette. */
export function outline(grid: string[][], ch = 'k'): string[] {
  const H = grid.length;
  const W = grid[0].length;
  const out = grid.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.');
      if (touches) out[y][x] = ch;
    }
  return out.map((r) => r.join(''));
}
