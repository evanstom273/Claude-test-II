import type { Dir, Pose } from './humanoid';
import type { Palette } from './pixels';

/*
 * The player at 32x32, drawn from shapes and lighting rules instead of typed pixels.
 *
 * Shapes are laid out on a 64-unit grid (two units per pixel) so edges can sit on
 * half pixels. For each frame: build the parts for that view and pose, work out which
 * part owns each pixel, light it, darken creases where one part tucks behind another,
 * add the few details that have to be placed by hand, fold away lone pixels and
 * outline the silhouette. The result is the same palette-indexed rows as every other
 * sprite, so the atlas treats it like any other frame.
 */

export const HERO_SIZE = 32;
const UNITS = 64 / HERO_SIZE;
const CX = 32;

// Four tones per material: highlight, base, shade, deep. The base tones match the 16px palette.
const MATERIALS = {
  hair: { chars: 'qhHQ', tones: ['#a06a3e', '#7a4a2a', '#55321c', '#3a2114'] },
  skin: { chars: 'zsSZ', tones: ['#fcdcbc', '#f2c39b', '#d39773', '#a86a52'] },
  tunic: { chars: 'dcCD', tones: ['#d65e4c', '#b8433b', '#842c2a', '#5a1c22'] },
  leather: { chars: 'jlLJ', tones: ['#a87348', '#8a5a3b', '#5f3b26', '#432819'] },
  gold: { chars: 'ygGY', tones: ['#fff0a0', '#f2c14e', '#b8862b', '#7a5418'] },
  trousers: { chars: 'opPO', tones: ['#64506e', '#4b3a52', '#33263a', '#241a2a'] },
  boots: { chars: 'ubBU', tones: ['#7a5236', '#5a3a2a', '#3d2618', '#2a180f'] },
};
type Material = keyof typeof MATERIALS;

export const HERO_PALETTE: Palette = { '.': null, k: '#1a1423', e: '#2a1f2e', w: '#f4efe4', m: '#8a3f3c', r: '#eaa088' };
for (const m of Object.values(MATERIALS)) [...m.chars].forEach((ch, i) => (HERO_PALETTE[ch] = m.tones[i]));

// ---- Shapes ----------------------------------------------------------------------

type Shape = (x: number, y: number) => boolean;
type Light = (x: number, y: number) => number;

const superellipse =
  (cx: number, cy: number, rx: number, ry: number, n = 2): Shape =>
  (x, y) =>
    Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => superellipse(cx, cy, rx, ry, 2);
const rrect =
  (x0: number, y0: number, x1: number, y1: number, r: number): Shape =>
  (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
    const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
    return dx * dx + dy * dy <= r * r;
  };
/** A rounded line from (x0, y0) to (x1, y1): limbs. */
const capsule =
  (x0: number, y0: number, x1: number, y1: number, r: number): Shape =>
  (x, y) => {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t)) <= r;
  };
const union =
  (...fs: Shape[]): Shape =>
  (x, y) =>
    fs.some((f) => f(x, y));
const mirror =
  (f: Shape): Shape =>
  (x, y) =>
    f(64 - x, y);
const shift =
  <T>(f: (x: number, y: number) => T, dx: number, dy: number) =>
  (x: number, y: number) =>
    f(x - dx, y - dy);

/** Piecewise-linear y at x through sorted points. */
function polyline(points: [number, number][]) {
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

// ---- Lighting: from the top left, like the rest of the game -------------------------

const L = (() => {
  const v = [-0.55, -0.7, 0.62];
  const len = Math.hypot(...v);
  return v.map((c) => c / len);
})();

const sphere =
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
const cylinder =
  (cx: number, rx: number, tilt = 0.25): Light =>
  (x) => {
    const nx = Math.max(-0.98, Math.min(0.98, (x - cx) / rx));
    return nx * L[0] - tilt * L[1] + Math.sqrt(1 - nx * nx) * L[2];
  };
const flat =
  (v: number): Light =>
  () =>
    v;

// ---- Parts --------------------------------------------------------------------------

interface Part {
  name: string;
  mat: Material;
  shape: Shape;
  light: Light;
  /** Light above `hi` is highlight, above `mid` base, else shade. Deep is kept for creases. */
  hi?: number;
  mid?: number;
}

/*
 * How each frame of the walk cycle moves things, in grid units. The cycle plays
 * a, idle, b, idle; the body dips a pixel on the a and b frames.
 */
interface FrontGait {
  bob: number;
  /** Offset of each foot: out to the side and up off the ground. */
  left: [number, number];
  right: [number, number];
}
interface SideGait {
  bob: number;
  /** Where the near and far foot land. */
  near: number;
  far: number;
  /** How far the near arm swings forward. */
  arm: number;
}

const FRONT_GAIT: Record<Pose, FrontGait> = {
  idle: { bob: 0, left: [0, 0], right: [0, 0] },
  a: { bob: 2, left: [-1, -3], right: [0, 0] },
  b: { bob: 2, left: [0, 0], right: [1, -3] },
};
const SIDE_GAIT: Record<Pose, SideGait> = {
  idle: { bob: 0, near: 33, far: 33, arm: 0 },
  a: { bob: 2, near: 39, far: 25, arm: -5 },
  b: { bob: 2, near: 26, far: 38, arm: 5 },
};

const head = superellipse(CX, 20.5, 17.6, 16, 2.4);

/** Front: the fringe hangs in clumps between the eyes and stops at the cheeks. */
const frontFringe = polyline([
  [13, 29], [15.5, 28.5], [17.5, 27], [20.5, 21], [24.5, 23.5], [28, 20], [32.5, 24.5],
  [36, 20.5], [39.5, 23.5], [42.5, 21], [46, 27], [48.5, 28.5], [51, 29],
]);
/** Back: hair covers the head down to the nape, with neck showing at either side. */
const napeLine = polyline([[12, 30], [19, 30], [21, 31], [23.5, 35], [26, 37.5], [38, 37.5], [40.5, 35], [43, 31], [45, 30], [52, 30]]);
/** Side (facing right): fringe over the brow, hair down the back of the head. */
const sideFringe = polyline([[28, 33], [30, 22], [33.5, 24.5], [37, 20.5], [40.5, 23.5], [44, 21], [47, 22.5], [50, 21]]);
const sideHead = union(superellipse(31, 20.5, 17, 16, 2.4), superellipse(36, 28.5, 12, 8.5, 2.3), ellipse(48.5, 27.5, 1.6, 2));
const sideHair: Shape = (x, y) => sideHead(x, y) && (x < 25 || (x < 30.5 && y < 30.5) || y < sideFringe(x));

// Square at the top so the cuff spans the whole leg, rounded at the toe.
const boot = union(rrect(19.5, 56.5, 29, 59, 0), rrect(19, 56.5, 29, 62.5, 2), ellipse(24, 60.5, 5.6, 2.2));
const sideBoot = (fx: number) => union(rrect(fx - 5, 56.5, fx + 3, 59, 0), rrect(fx - 5, 56.5, fx + 4, 62.5, 2), ellipse(fx + 2, 60.5, 4.5, 2.2));
const armL = union(rrect(15.5, 36.5, 21.5, 47.5, 3), ellipse(19.5, 39.5, 4.5, 3.5));
const handL = ellipse(18.4, 49.2, 3.3, 3);

function frontParts(back: boolean, g: FrontGait): Part[] {
  const b = g.bob;
  const [lx, ly] = g.left;
  const [rx, ry] = g.right;
  const up = (p: Part): Part => ({ ...p, shape: shift(p.shape, 0, b), light: shift(p.light, 0, b) });
  const parts: Part[] = [
    {
      name: 'trousers',
      mat: 'trousers',
      shape: union(rrect(20.5, 51 + b, 43.5, 54.5, 1), rrect(20.5 + lx, 53, 29.6 + lx, 58 + ly, 1), rrect(34.4 + rx, 53, 43.5 + rx, 58 + ry, 1)),
      light: (x, y) => cylinder(x < CX ? 25 + lx : 39 + rx, 6, 0.1)(x, y),
    },
    { name: 'bootL', mat: 'boots', shape: shift(boot, lx, ly), light: sphere(23.5 + lx, 58.5 + ly, 7, 6) },
    { name: 'bootR', mat: 'boots', shape: shift(mirror(boot), rx, ry), light: sphere(40.5 + rx, 58.5 + ry, 7, 6) },
    ...[
      { name: 'torso', mat: 'tunic', shape: rrect(20, 35.5, 44, 50, 2), light: cylinder(CX, 14), hi: 2, mid: 0.35 },
      { name: 'belt', mat: 'leather', shape: rrect(19.5, 47, 44.5, 51.5, 0.5), light: (x: number, y: number) => (y < 48 ? 0.9 : cylinder(CX, 15)(x, y)) },
      { name: 'armL', mat: 'tunic', shape: armL, light: cylinder(18.5, 4.5), hi: 0.9, mid: 0.5 },
      { name: 'armR', mat: 'tunic', shape: mirror(armL), light: cylinder(45.5, 4.5), hi: 2, mid: 0.62 },
      { name: 'handL', mat: 'skin', shape: handL, light: sphere(18.4, 49, 3.6, 3.4) },
      { name: 'handR', mat: 'skin', shape: mirror(handL), light: sphere(45.6, 49, 3.6, 3.4) },
    ].map((p) => up(p as Part)),
  ];
  if (back) {
    parts.push(
      up({ name: 'neck', mat: 'skin', shape: (x, y) => head(x, y) && y >= napeLine(x), light: flat(0.3) }),
      up({ name: 'hair', mat: 'hair', shape: (x, y) => head(x, y) && y < napeLine(x), light: sphere(CX, 15, 19, 17), hi: 2, mid: 0.48 }),
    );
  } else {
    // A face is mostly a flat front, so it gets a simple rule instead of a sphere: shade down the far cheek and jaw.
    const face: Light = (x, y) => ((x - CX) / 15 + (0.5 * (y - 27)) / 9 > 0.75 || y > 35 ? 0 : 0.7);
    parts.push(
      up({ name: 'face', mat: 'skin', shape: (x, y) => head(x, y) && y >= frontFringe(x), light: face, hi: 2 }),
      up({ name: 'hair', mat: 'hair', shape: (x, y) => head(x, y) && y < frontFringe(x), light: sphere(CX, 15, 19, 17), hi: 2, mid: 0.48 }),
    );
  }
  return parts;
}

function sideParts(g: SideGait): Part[] {
  const { bob: b, near, far } = g;
  const up = (p: Part): Part => ({ ...p, shape: shift(p.shape, 0, b), light: shift(p.light, 0, b) });
  const wrist = 31 + g.arm;
  const hand = 31 + g.arm * 1.15;
  return [
    // The far leg is behind everything and stays in shade.
    { name: 'legF', mat: 'trousers', shape: capsule(31, 52 + b, far, 56, 4.4), light: flat(0.3) },
    { name: 'bootF', mat: 'boots', shape: sideBoot(far), light: (x, y) => sphere(far - 1, 58.5, 8, 6)(x, y) - 0.25 },
    { name: 'legN', mat: 'trousers', shape: capsule(33, 52 + b, near, 56, 4.4), light: cylinder(near, 6, 0.1) },
    { name: 'bootN', mat: 'boots', shape: sideBoot(near), light: sphere(near - 1, 58.5, 8, 6) },
    ...[
      { name: 'torso', mat: 'tunic', shape: rrect(22, 35.5, 42, 50, 3), light: cylinder(CX, 12), hi: 2, mid: 0.35 },
      { name: 'belt', mat: 'leather', shape: rrect(21.5, 47, 42.5, 51.5, 0.5), light: (x: number, y: number) => (y < 48 ? 0.9 : cylinder(CX, 13)(x, y)) },
      { name: 'arm', mat: 'tunic', shape: capsule(31, 39, wrist, 46, 3.6), light: cylinder(30, 5), hi: 0.9, mid: 0.5 },
      { name: 'hand', mat: 'skin', shape: ellipse(hand, 49, 3.2, 3), light: sphere(hand, 48.5, 3.6, 3.4) },
      { name: 'face', mat: 'skin', shape: (x: number, y: number) => sideHead(x, y) && !sideHair(x, y), light: (_x: number, y: number) => (y > 35 ? 0 : 0.7), hi: 2 },
      { name: 'hair', mat: 'hair', shape: sideHair, light: sphere(31, 15, 19, 17), hi: 2, mid: 0.48 },
      { name: 'ear', mat: 'skin', shape: ellipse(28, 28, 2.4, 3.4), light: sphere(27, 27, 3, 4) },
    ].map((p) => up(p as Part)),
  ];
}

/** Where a part tucks behind a nearer one: [front, behind, tone, extra rows of shadow below]. */
const CREASES: Record<Dir, [string, string, number, number][]> = {
  down: [
    ['hair', 'face', 2, 0],
    ['face', 'torso', 3, 0],
    ['armL', 'torso', 3, 0],
    ['armR', 'torso', 3, 0],
  ],
  up: [
    ['hair', 'neck', 2, 0],
    ['hair', 'torso', 3, 0],
    ['neck', 'torso', 3, 0],
    ['armL', 'torso', 3, 0],
    ['armR', 'torso', 3, 0],
  ],
  side: [
    ['hair', 'face', 2, 0],
    ['face', 'torso', 3, 0],
    ['hair', 'torso', 3, 0],
    ['arm', 'torso', 3, 0],
    ['legN', 'legF', 3, 0],
    ['bootN', 'bootF', 3, 0],
  ],
};

/** Hair clump lines, one tone darker than what they cross. */
const STRANDS: Record<Dir, [number, number][][]> = {
  down: [
    [[20.5, 20], [21.5, 15]],
    [[28, 19], [28.5, 14]],
    [[42.5, 20], [41.5, 15]],
  ],
  up: [
    [[22, 31], [23, 23]],
    [[30, 37], [30, 28]],
    [[38, 35], [38.5, 27]],
    [[44, 30], [43, 22]],
  ],
  side: [
    [[37, 20], [34, 13]],
    [[44, 20.5], [41, 14]],
    [[19, 30], [17.5, 21]],
  ],
};

// ---- Drawing --------------------------------------------------------------------------

export function heroFrame(dir: Dir, pose: Pose): string[] {
  const N = HERO_SIZE;
  const g = dir === 'side' ? SIDE_GAIT[pose] : FRONT_GAIT[pose];
  const parts = dir === 'side' ? sideParts(SIDE_GAIT[pose]) : frontParts(dir === 'up', FRONT_GAIT[pose]);
  const at = (v: number) => (v + 0.5) * UNITS;
  const bob = g.bob / UNITS;

  // Which part owns each pixel (later parts are nearer and win).
  const owner = Array.from({ length: N }, () => new Array<number>(N).fill(-1));
  parts.forEach((p, i) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (p.shape(at(x), at(y))) owner[y][x] = i;
  });
  const own = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : owner[y][x]);
  const part = (x: number, y: number) => parts[own(x, y)]?.name ?? '';

  // Tone from lighting: 0 highlight, 1 base, 2 shade.
  const tone: number[][] = owner.map((row, y) =>
    row.map((i, x) => {
      if (i < 0) return -1;
      const p = parts[i];
      const v = p.light(at(x), at(y));
      return v > (p.hi ?? 0.86) ? 0 : v > (p.mid ?? 0.5) ? 1 : 2;
    }),
  );

  // Creases.
  const index = Object.fromEntries(parts.map((p, i) => [p.name, i]));
  for (const [front, behind, t, rows] of CREASES[dir]) {
    const f = index[front];
    const b = index[behind];
    if (f === undefined || b === undefined) continue;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (owner[y][x] !== b) continue;
        let hit = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => own(x + dx, y + dy) === f);
        for (let k = 2; k <= rows + 1 && !hit; k++) hit = own(x, y - k) === f;
        if (hit) tone[y][x] = Math.max(tone[y][x], t);
      }
  }

  // Hair sheen: a broken band across the lit side of the head.
  const sheenX = dir === 'side' ? 31 : CX;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (part(x, y) !== 'hair') continue;
      const dx = (at(x) - sheenX) / 18;
      const dy = (at(y) - g.bob - 18) / 15;
      const d = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (d > 0.56 && d < 0.76 && a > -160 && a < -60) tone[y][x] = 0;
    }

  const grid = tone.map((row, y) => row.map((t, x) => (t < 0 ? '.' : MATERIALS[parts[owner[y][x]].mat].chars[t])));
  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < N && y < N && grid[y][x] !== '.') grid[y][x] = ch;
  };

  for (const line of STRANDS[dir]) {
    for (let k = 0; k < line.length - 1; k++) {
      const [x0, y0] = line[k].map((v) => v / UNITS);
      const [x1, y1] = line[k + 1].map((v) => v / UNITS);
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let j = 0; j <= n; j++) {
        const x = Math.floor(x0 + ((x1 - x0) * j) / n);
        const y = Math.floor(y0 + ((y1 - y0) * j) / n + bob);
        if (part(x, y) !== 'hair') continue;
        const darker = ({ q: 'h', h: 'H', H: 'Q', Q: 'Q' } as Record<string, string>)[grid[y][x]];
        if (darker) set(x, y, darker);
      }
    }
  }

  // Sleeve cuffs: the bottom edge of each sleeve, where it meets the hand or hangs free.
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N; x++) {
      const below = part(x, y + 1);
      if (part(x, y).startsWith('arm') && !below.startsWith('arm') && below !== 'torso') set(x, y, 'D');
    }

  // Boots: a lit turned-down cuff on top and a dark sole.
  for (const name of ['bootL', 'bootR', 'bootN', 'bootF']) {
    const cells: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (part(x, y) === name) cells.push([x, y]);
    if (!cells.length) continue;
    const top = Math.min(...cells.map((c) => c[1]));
    const bottom = Math.max(...cells.map((c) => c[1]));
    const left = Math.min(...cells.filter((c) => c[1] === top).map((c) => c[0]));
    for (const [x, y] of cells) {
      if (y === top) set(x, y, name === 'bootF' ? 'B' : x < left + 2 ? 'u' : 'b');
      if (y === bottom) set(x, y, 'U');
    }
  }

  // Face and buckle, which have to be placed pixel by pixel.
  const by = Math.round(bob);
  if (dir === 'down') {
    for (const ex of [11, 19]) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) set(ex + dx, 12 + dy + by, 'e');
      set(ex, 12 + by, 'w');
    }
    set(15, 16 + by, 'm');
    set(16, 16 + by, 'm');
    set(10, 15 + by, 'r');
    set(21, 15 + by, 'r');
    ['ygg', 'gJG', 'gGG'].forEach((row, dy) => [...row].forEach((c, dx) => set(13 + dx, 23 + dy + by, c)));
    set(19, 24 + by, 'J');
  } else if (dir === 'side') {
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) set(20 + dx, 12 + dy + by, 'e');
    set(20, 12 + by, 'w');
    set(22, 16 + by, 'm');
    set(18, 15 + by, 'r');
    // The buckle, seen edge-on at the front of the belt.
    for (let y = 23; y <= 25; y++) {
      let front = -1;
      for (let x = 0; x < N; x++) if (part(x, y + by) === 'belt') front = x;
      if (front >= 0) set(front, y + by, y === 23 ? 'y' : 'g');
    }
  }

  // Lone pixels read as noise: fold them into whichever neighbour they're surrounded by.
  const keep = 'kewmrqQHyGJUDC';
  for (let pass = 0; pass < 2; pass++)
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const c = grid[y][x];
        if (c === '.' || keep.includes(c)) continue;
        const n = [grid[y - 1][x], grid[y + 1][x], grid[y][x - 1], grid[y][x + 1]];
        if (n.includes(c)) continue;
        const counts: Record<string, number> = {};
        for (const v of n) if (v !== '.') counts[v] = (counts[v] ?? 0) + 1;
        const best = Object.entries(counts).sort((p, q) => q[1] - p[1])[0];
        // Only when the neighbours agree; a three-way tie is an edge, not noise.
        if (best && best[1] >= 2) grid[y][x] = best[0];
      }

  // A one-pixel outline around the silhouette.
  const out = grid.map((r) => r.slice());
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (grid[y][x] !== '.') continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.');
      if (touches) out[y][x] = 'k';
    }
  return out.map((r) => r.join(''));
}
