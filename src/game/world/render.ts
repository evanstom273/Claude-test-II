import type { ThemeId } from '../../data/maps/types';
import { hashString, rng } from '../art/pixels';
import { tileAt, type ParsedMap } from './parse';

export const TILE = 16;

type Ctx = CanvasRenderingContext2D;

interface ThemeColors {
  grass: string[]; // base, dark, light, deep
  path: string[];
  sand: string[];
  floor: string[];
  water: string[]; // base, deep, light, foam
  wall: string[]; // top, face, highlight, deep
  canopy: string[]; // base, dark, light, outline
  trunk: string[];
  rock: string[];
  crystal: string[];
  flowers: string[];
}

const THEMES: Record<ThemeId, ThemeColors> = {
  village: {
    grass: ['#5c9e4a', '#4a8a3e', '#74b85a', '#3d7534'],
    path: ['#c9a66b', '#a8864f', '#dcc08a'],
    sand: ['#d8c48a', '#bfa86e', '#ece0b0'],
    floor: ['#a39a8e', '#857c72', '#bdb4a8', '#6a6258'],
    water: ['#3f7fcf', '#2f62a8', '#7fb6ef', '#d0e8ff'],
    wall: ['#a6a3b2', '#7a7788', '#c4c2ce', '#4a4858'],
    canopy: ['#3f8a3a', '#2d6a2c', '#62b04e', '#1a3a1e'],
    trunk: ['#6a4428', '#4a2e1a'],
    rock: ['#8e8c96', '#6a6872', '#b2b0ba', '#3e3c46'],
    crystal: ['#9fe0ff', '#5aa8d8', '#e8faff'],
    flowers: ['#f4efe4', '#ffd56b', '#e86a8a', '#b48ae0'],
  },
  forest: {
    grass: ['#3f7f3c', '#326a32', '#559a4a', '#245226'],
    path: ['#a88a58', '#866c42', '#c0a470'],
    sand: ['#b8a878', '#9a8a5e', '#d0c498'],
    floor: ['#7a8a78', '#5e6c5c', '#94a490', '#465244'],
    water: ['#2f6aa0', '#245482', '#5f9ad0', '#b8dcf0'],
    wall: ['#7e8a78', '#5c6656', '#9aa892', '#323a30'],
    canopy: ['#2f6f34', '#1f5226', '#4a944a', '#10301a'],
    trunk: ['#5a3a24', '#3a2414'],
    rock: ['#7a8070', '#5a6052', '#9aa090', '#30342c'],
    crystal: ['#9fffcf', '#4ab88a', '#eafff4'],
    flowers: ['#f4efe4', '#9fd0ff', '#ffd56b', '#e8a0d0'],
  },
  mine: {
    grass: ['#5a4c44', '#4a3e38', '#6e5e54', '#3a302c'],
    path: ['#6e5a48', '#58483a', '#82705c'],
    sand: ['#7a6a58', '#645646', '#92806a'],
    floor: ['#7a5a3a', '#5a4028', '#946e48', '#3a2818'],
    water: ['#2a4a70', '#1e3858', '#4a7aa8', '#8ab8e0'],
    wall: ['#5e4e46', '#40342e', '#7a6a60', '#221c1a'],
    canopy: ['#5a4c44', '#4a3e38', '#6e5e54', '#2a221e'],
    trunk: ['#4a3a2a', '#2e2218'],
    rock: ['#6e5e54', '#4e423a', '#8a7a6e', '#2a221e'],
    crystal: ['#7fe8ff', '#3a9ad0', '#e8fbff'],
    flowers: ['#8a7a6e', '#a89888', '#6e5e54', '#9a8a7a'],
  },
  marsh: {
    grass: ['#6b7a48', '#56643a', '#83945a', '#43502e'],
    path: ['#8a7a58', '#6e6044', '#a49470'],
    sand: ['#c8b888', '#a89868', '#e0d4a8'],
    floor: ['#6a7482', '#545c68', '#848e9c', '#3a404a'],
    water: ['#2f5a68', '#234856', '#4f8494', '#a8d0d8'],
    wall: ['#7a8290', '#555c6a', '#959cab', '#2e3240'],
    canopy: ['#4f6a3c', '#3a5030', '#6a8a4f', '#1e2a18'],
    trunk: ['#4a3a2e', '#2e241c'],
    rock: ['#787c74', '#5a5e56', '#969a90', '#32342e'],
    crystal: ['#9fe8e0', '#4ab0a8', '#e8fffa'],
    flowers: ['#e8e4d0', '#c8d0e8', '#b8a0c8', '#f0e0a0'],
  },
  rift: {
    grass: ['#2c2440', '#221c34', '#3a3054', '#16121f'],
    path: ['#3a2e4e', '#2c2240', '#4a3c62'],
    sand: ['#3a3048', '#2c2438', '#4a3e5a'],
    floor: ['#24203a', '#1a1628', '#34304e', '#0e0c16'],
    water: ['#0c0816', '#08050f', '#3a2a60', '#a070e0'],
    wall: ['#4a3868', '#30244a', '#64508a', '#140e20'],
    canopy: ['#4a3a60', '#342848', '#6a5490', '#1e1630'],
    trunk: ['#3a2e4a', '#241c30'],
    rock: ['#3e3454', '#2c243e', '#54486e', '#16121f'],
    crystal: ['#d0a0ff', '#8a50d0', '#f6e8ff'],
    flowers: ['#a070e0', '#6fd0f0', '#f0d8ff', '#e070c0'],
  },
};

export function themeColors(theme: ThemeId): ThemeColors {
  return THEMES[theme];
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker?: boolean;
  intensity?: number;
}

export interface RenderedMap {
  ground: HTMLCanvasElement;
  overhead: HTMLCanvasElement;
  lights: LightSource[];
  /** Tile coordinates of water, for shimmer effects. */
  waterTiles: { x: number; y: number }[];
}

class Painter {
  tileTop = 0;
  constructor(
    public g: Ctx,
    public o: Ctx,
  ) {}

  rect(x: number, y: number, w: number, h: number, c: string) {
    this.g.fillStyle = c;
    this.g.fillRect(x, y, w, h);
  }

  /** A pixel that goes to the overhead layer if it pokes above the current tile. */
  p(x: number, y: number, c: string) {
    const ctx = y < this.tileTop ? this.o : this.g;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  }

  over(x: number, y: number, w: number, h: number, c: string) {
    this.o.fillStyle = c;
    this.o.fillRect(x, y, w, h);
  }
}

const SOFT = new Set([',', '.', '"', 'M', 'V', 'Z']);
const PATHLIKE = new Set([':', '=', 'H', '_', 'Y']);

/** Render the static terrain of a map to two canvases. */
export function renderMap(map: ParsedMap): RenderedMap {
  const W = map.w * TILE;
  const H = map.h * TILE;
  const ground = document.createElement('canvas');
  ground.width = W;
  ground.height = H;
  const overhead = document.createElement('canvas');
  overhead.width = W;
  overhead.height = H;
  const P = new Painter(ground.getContext('2d')!, overhead.getContext('2d')!);
  const theme = map.def.theme;
  const T = THEMES[theme];
  const lights: LightSource[] = [];
  const waterTiles: { x: number; y: number }[] = [];
  const seed = hashString(map.def.id);

  const at = (x: number, y: number) => tileAt(map, x, y);
  const roofHue = labelRegions(map, 'R');

  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const ch = at(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      const r = rng(seed ^ (tx * 73856093) ^ (ty * 19349663));
      P.tileTop = py;
      const env: Env = { P, T, theme, tx, ty, px, py, r, at };

      // Base layer.
      switch (ch) {
        case ':':
          drawPath(env, T.path);
          break;
        case ';':
          drawPath(env, T.sand);
          break;
        case '_':
          drawFloor(env);
          break;
        case '~':
          drawWater(env);
          waterTiles.push({ x: tx, y: ty });
          break;
        case 'X':
          drawChasm(env);
          break;
        case '#':
          drawWall(env);
          break;
        case '=':
        case 'H':
          drawWater(env);
          drawBridge(env, ch === '=');
          break;
        case 'R':
          drawRoof(env, roofHue[ty * map.w + tx]);
          break;
        case 'W':
          drawHouseWall(env, false);
          if (theme === 'village' && (tx * 7 + ty) % 3 === 0) lights.push({ x: px + 8, y: py + 10, radius: 18, color: 0xffc070, intensity: 0.7 });
          break;
        case 'D':
          drawHouseWall(env, true);
          break;
        case 'Y':
          drawGround(env, '.');
          drawRails(env);
          break;
        default: {
          const under = groundUnder(ch, env);
          drawGround(env, under);
        }
      }

      // Objects on top of ground.
      switch (ch) {
        case 'T':
          drawTree(env);
          break;
        case '^':
          drawRock(env);
          break;
        case 'F':
          drawFence(env);
          break;
        case 'C':
          drawCrystal(env);
          lights.push({ x: px + 8, y: py + 6, radius: 44, color: theme === 'rift' ? 0xc080ff : 0x80e0ff, flicker: false });
          break;
        case 'P':
          drawPillar(env);
          break;
        case 'B':
          drawBarrel(env);
          break;
        case 'L':
          drawLamp(env);
          lights.push({ x: px + 8, y: py - 4, radius: 50, color: 0xffc070, flicker: true, intensity: 0.85 });
          break;
        case 'G':
          drawGrave(env);
          break;
        case 'O':
          drawWell(env);
          break;
        case 'Q':
          drawStatue(env);
          break;
        case 'K':
          drawStall(env);
          break;
        case 'U':
          drawBush(env);
          break;
        case 'V':
          drawCrops(env);
          break;
        case 'M':
          drawMushrooms(env);
          lights.push({ x: px + 8, y: py + 10, radius: 20, color: 0x80ffe0 });
          break;
        case 'Z':
          drawCrack(env);
          break;
        case 'N':
          drawSeal(env);
          break;
        case '"':
          drawTallGrass(env);
          break;
      }
    }
  }

  return { ground, overhead, lights, waterTiles };
}

interface Env {
  P: Painter;
  T: ThemeColors;
  theme: ThemeId;
  tx: number;
  ty: number;
  px: number;
  py: number;
  r: () => number;
  at: (x: number, y: number) => string;
}

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function groundUnder(ch: string, e: Env): string {
  if (ch === ',' || ch === '.') return ch;
  // Obstacles sit on whatever walkable ground is next to them.
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ]) {
    const n = e.at(e.tx + dx, e.ty + dy);
    if (n === ':' || n === ';' || n === '_') return n === '_' ? '_' : '.';
  }
  return '.';
}

function drawGround(e: Env, variant: string) {
  const { P, T, px, py, r, theme } = e;
  if (variant === '_') return drawFloor(e);
  const [base, dark, light, deep] = T.grass;
  P.rect(px, py, TILE, TILE, base);
  // Soft mottling.
  for (let i = 0; i < 5; i++) {
    const x = px + Math.floor(r() * 14);
    const y = py + Math.floor(r() * 14);
    P.rect(x, y, 2 + Math.floor(r() * 2), 2, dark);
  }
  // Tufts and specks.
  const tufts = theme === 'mine' || theme === 'rift' ? 3 : 6;
  for (let i = 0; i < tufts; i++) {
    const x = px + 1 + Math.floor(r() * 14);
    const y = py + 1 + Math.floor(r() * 13);
    if (theme === 'mine' || theme === 'rift') {
      P.rect(x, y, 1, 1, light);
      P.rect(x + 1, y + 1, 1, 1, deep);
    } else {
      P.rect(x, y, 1, 2, deep);
      P.rect(x + 1, y + 1, 1, 1, light);
    }
  }
  if (variant === ',') {
    if (theme === 'mine') {
      for (let i = 0; i < 4; i++) {
        const x = px + 2 + Math.floor(r() * 11);
        const y = py + 2 + Math.floor(r() * 11);
        P.rect(x, y, 3, 2, T.rock[0]);
        P.rect(x, y, 2, 1, T.rock[2]);
        P.rect(x, y + 2, 3, 1, T.rock[3]);
      }
    } else if (theme === 'marsh') {
      const x = px + 2 + Math.floor(r() * 7);
      const y = py + 3 + Math.floor(r() * 7);
      P.rect(x, y, 6, 3, T.water[1]);
      P.rect(x + 1, y - 1, 4, 1, T.water[1]);
      P.rect(x + 1, y, 3, 1, T.water[2]);
    } else if (theme === 'rift') {
      for (let i = 0; i < 4; i++) {
        P.rect(px + 1 + Math.floor(r() * 14), py + 1 + Math.floor(r() * 14), 1, 1, pick(r, T.flowers));
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = px + 2 + Math.floor(r() * 11);
        const y = py + 2 + Math.floor(r() * 11);
        const c = pick(r, T.flowers);
        P.rect(x - 1, y, 3, 1, c);
        P.rect(x, y - 1, 1, 3, c);
        P.rect(x, y, 1, 1, '#ffd56b');
      }
    }
  }
}

function drawTallGrass(e: Env) {
  const { P, T, px, py, r, theme } = e;
  const blade = theme === 'marsh' ? ['#8a8a50', '#5a6034', '#a8a868'] : [T.grass[2], T.grass[3], T.grass[0]];
  for (let i = 0; i < 9; i++) {
    const x = px + 1 + Math.floor(r() * 14);
    const h = 3 + Math.floor(r() * 4);
    const y = py + 4 + Math.floor(r() * 10);
    for (let j = 0; j < h; j++) P.p(x + (j > h - 2 && r() > 0.5 ? 1 : 0), y - j, j === h - 1 ? blade[2] : j < 2 ? blade[1] : blade[0]);
  }
  if (theme === 'marsh' && r() > 0.4) {
    const x = px + 4 + Math.floor(r() * 8);
    for (let j = 0; j < 8; j++) P.p(x, py + 12 - j, '#5a6034');
    P.rect(x - 1, py + 3, 3, 3, '#6a4a2a');
  }
}

function edgeBlend(e: Env, colors: string[], isSame: (c: string) => boolean) {
  const { P, T, tx, ty, px, py, r, at } = e;
  const g = T.grass;
  const sides: [number, number, (i: number, d: number) => [number, number]][] = [
    [0, -1, (i, d) => [px + i, py + d]],
    [0, 1, (i, d) => [px + i, py + 15 - d]],
    [-1, 0, (i, d) => [px + d, py + i]],
    [1, 0, (i, d) => [px + 15 - d, py + i]],
  ];
  for (const [dx, dy, pos] of sides) {
    const n = at(tx + dx, ty + dy);
    if (isSame(n) || !SOFT.has(n)) continue;
    for (let i = 0; i < 16; i++) {
      const depth = r() < 0.5 ? 1 : r() < 0.6 ? 2 : 0;
      for (let d = 0; d < depth; d++) {
        const [x, y] = pos(i, d);
        P.rect(x, y, 1, 1, d === 0 ? g[0] : g[1]);
      }
      if (depth > 0 && r() < 0.15) {
        const [x, y] = pos(i, depth);
        P.rect(x, y, 1, 1, colors[1]);
      }
    }
  }
}

function drawPath(e: Env, c: string[]) {
  const { P, px, py, r } = e;
  P.rect(px, py, TILE, TILE, c[0]);
  for (let i = 0; i < 7; i++) {
    const x = px + 1 + Math.floor(r() * 14);
    const y = py + 1 + Math.floor(r() * 14);
    P.rect(x, y, 1, 1, r() > 0.5 ? c[1] : c[2]);
  }
  for (let i = 0; i < 2; i++) {
    const x = px + 2 + Math.floor(r() * 11);
    const y = py + 2 + Math.floor(r() * 11);
    P.rect(x, y, 2, 1, c[2]);
    P.rect(x, y + 1, 2, 1, c[1]);
  }
  const self = e.at(e.tx, e.ty);
  edgeBlend(e, c, (n) => n === self || PATHLIKE.has(n) || n === ';' || n === ':');
}

function drawFloor(e: Env) {
  const { P, T, px, py, r, theme } = e;
  const [base, dark, light, deep] = T.floor;
  if (theme === 'mine') {
    // Wooden planks.
    P.rect(px, py, TILE, TILE, base);
    for (let i = 0; i < 4; i++) {
      const y = py + i * 4;
      P.rect(px, y + 3, TILE, 1, deep);
      P.rect(px, y, TILE, 1, light);
      const seam = px + ((e.tx * 5 + i * 7) % 12) + 2;
      P.rect(seam, y, 1, 3, dark);
      if (r() > 0.5) P.rect(px + 1 + Math.floor(r() * 13), y + 1, 2, 1, dark);
    }
    return;
  }
  if (theme === 'village' || theme === 'forest') {
    // Cobbles.
    P.rect(px, py, TILE, TILE, deep);
    const off = (e.ty % 2) * 4;
    for (let row = 0; row < 2; row++) {
      for (let col = -1; col < 2; col++) {
        const x = px + col * 8 + (row % 2 ? off : 4 - off);
        const y = py + row * 8;
        const sx = Math.max(x, px);
        const ex = Math.min(x + 7, px + 16);
        if (ex <= sx) continue;
        const tone = r() > 0.5 ? base : dark;
        P.rect(sx, y, ex - sx, 7, tone);
        P.rect(sx, y, ex - sx, 1, light);
        if (theme === 'forest' && r() > 0.6) P.rect(sx + 1, y + 4, 2, 2, T.grass[1]);
      }
    }
    return;
  }
  // Square tiles (chapel, rift).
  P.rect(px, py, TILE, TILE, base);
  P.rect(px, py, TILE, 1, light);
  P.rect(px, py, 1, TILE, light);
  P.rect(px + 8, py, 1, TILE, dark);
  P.rect(px, py + 8, TILE, 1, dark);
  P.rect(px + 15, py, 1, TILE, deep);
  P.rect(px, py + 15, TILE, 1, deep);
  for (let i = 0; i < 3; i++) P.rect(px + 1 + Math.floor(r() * 14), py + 1 + Math.floor(r() * 14), 1, 1, r() > 0.5 ? dark : light);
  if (theme === 'rift' && r() > 0.7) {
    const x = px + 2 + Math.floor(r() * 10);
    P.rect(x, py + 4, 1, 3, '#7a50b0');
    P.rect(x + 1, py + 7, 1, 2, '#7a50b0');
  }
}

function drawWater(e: Env) {
  const { P, T, tx, ty, px, py, r, at, theme } = e;
  const [base, deep, light, foam] = T.water;
  P.rect(px, py, TILE, TILE, base);
  for (let i = 0; i < 3; i++) {
    const x = px + 1 + Math.floor(r() * 11);
    const y = py + 2 + Math.floor(r() * 12);
    P.rect(x, y, 3 + Math.floor(r() * 2), 1, theme === 'rift' ? pick(r, ['#2a1a48', '#3a2a60']) : light);
    if (theme !== 'rift') P.rect(x + 1, y + 1, 2, 1, deep);
  }
  if (theme === 'rift' && r() > 0.6) P.rect(px + Math.floor(r() * 15), py + Math.floor(r() * 15), 1, 1, foam);
  const isWater = (c: string) => c === '~' || c === '=' || c === 'H' || c === 'X';
  if (!isWater(at(tx, ty - 1))) {
    P.rect(px, py, TILE, 2, deep);
    P.rect(px, py + 2, TILE, 1, foam);
    for (let i = 0; i < 16; i += 3) if (r() > 0.4) P.rect(px + i, py + 3, 2, 1, light);
  }
  if (!isWater(at(tx, ty + 1))) P.rect(px, py + 15, TILE, 1, light);
  if (!isWater(at(tx - 1, ty))) P.rect(px, py, 1, TILE, deep);
  if (!isWater(at(tx + 1, ty))) P.rect(px + 15, py, 1, TILE, deep);
}

function drawChasm(e: Env) {
  const { P, T, tx, ty, px, py, r, at } = e;
  P.rect(px, py, TILE, TILE, '#0a0810');
  for (let i = 0; i < 2; i++) P.rect(px + Math.floor(r() * 15), py + 6 + Math.floor(r() * 9), 1, 1, '#1c1828');
  if (at(tx, ty - 1) !== 'X') {
    P.rect(px, py, TILE, 5, T.wall[1]);
    P.rect(px, py, TILE, 1, T.wall[2]);
    for (let i = 0; i < 16; i += 2) P.rect(px + i, py + 3 + (r() > 0.5 ? 1 : 0), 1, 2, T.wall[3]);
    P.rect(px, py + 5, TILE, 1, '#000000');
  }
  if (at(tx - 1, ty) !== 'X') P.rect(px, py, 1, TILE, T.wall[3]);
  if (at(tx + 1, ty) !== 'X') P.rect(px + 15, py, 1, TILE, T.wall[3]);
}

function drawWall(e: Env) {
  const { P, T, tx, ty, px, py, r, at, theme } = e;
  const [top, face, hi, deep] = T.wall;
  const below = at(tx, ty + 1);
  const wallBelow = below === '#' || below === 'N';
  if (wallBelow) {
    P.rect(px, py, TILE, TILE, top);
    for (let i = 0; i < 6; i++) P.rect(px + Math.floor(r() * 15), py + Math.floor(r() * 15), 2, 1, r() > 0.5 ? hi : face);
    // Edges where the wall meets open ground on the sides.
    if (at(tx - 1, ty) !== '#') P.rect(px, py, 1, TILE, deep);
    if (at(tx + 1, ty) !== '#') P.rect(px + 15, py, 1, TILE, deep);
    if (at(tx, ty - 1) !== '#') P.rect(px, py, TILE, 1, hi);
    return;
  }
  // Top lip, then a front face.
  P.rect(px, py, TILE, 5, top);
  P.rect(px, py + 4, TILE, 1, hi);
  P.rect(px, py + 5, TILE, 11, face);
  if (theme === 'mine' || theme === 'rift') {
    for (let i = 0; i < 5; i++) {
      const x = px + Math.floor(r() * 14);
      const y = py + 6 + Math.floor(r() * 8);
      P.rect(x, y, 2, 3, deep);
      P.rect(x, y, 1, 1, hi);
    }
    if (theme === 'rift' && r() > 0.6) P.rect(px + 3 + Math.floor(r() * 10), py + 7, 1, 5, '#a070e0');
  } else {
    // Bricks.
    for (let row = 0; row < 3; row++) {
      const y = py + 6 + row * 3;
      P.rect(px, y + 2, TILE, 1, deep);
      const off = (row + ty) % 2 ? 0 : 4;
      for (let x = off; x < 16; x += 8) P.rect(px + x, y, 1, 2, deep);
    }
    if (theme === 'forest' || theme === 'marsh') {
      for (let i = 0; i < 4; i++) P.rect(px + Math.floor(r() * 15), py + 5 + Math.floor(r() * 10), 2, 1, theme === 'forest' ? '#4a7a3a' : '#5a7060');
    }
  }
  P.rect(px, py + 15, TILE, 1, deep);
  if (at(tx - 1, ty) !== '#') P.rect(px, py, 1, TILE, deep);
  if (at(tx + 1, ty) !== '#') P.rect(px + 15, py, 1, TILE, deep);
  // A little overhang shading the ground above.
  if (at(tx, ty - 1) !== '#' && at(tx, ty - 1) !== 'N') P.over(px, py - 1, TILE, 1, 'rgba(0,0,0,0.18)');
}

function blob(e: Env, cx: number, cy: number, rx: number, ry: number, cols: string[], noise = 0.2) {
  const { P, r } = e;
  const [base, dark, light, outline] = cols;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      const wob = (r() - 0.5) * noise;
      if (d > 1 + wob) continue;
      let c = base;
      if (d > 0.82 + wob * 0.5) c = outline;
      else if (dx + dy > 0.55 + wob) c = dark;
      else if (dx + dy < -0.6 + wob) c = light;
      else if (r() < 0.08) c = r() > 0.5 ? light : dark;
      P.p(x, y, c);
    }
  }
}

function drawTree(e: Env) {
  const { P, T, px, py, r, theme, at, tx, ty } = e;
  if (theme === 'rift') {
    // Dead, twisted tree.
    P.rect(px + 6, py + 6, 4, 10, T.trunk[0]);
    P.rect(px + 9, py + 6, 1, 10, T.trunk[1]);
    const branch = (x0: number, y0: number, dx: number) => {
      for (let i = 0; i < 6; i++) P.p(px + x0 + dx * i, py + y0 - i, T.canopy[i % 2 ? 0 : 2]);
    };
    branch(7, 6, -1);
    branch(8, 5, 1);
    branch(8, 2, 0);
    P.p(px + 2, py - 1, T.canopy[2]);
    P.p(px + 13, py - 1, T.canopy[2]);
    P.rect(px + 4, py + 14, 8, 2, 'rgba(0,0,0,0.25)');
    return;
  }
  // Shadow, trunk, canopy.
  P.rect(px + 2, py + 13, 12, 3, 'rgba(0,0,0,0.22)');
  P.rect(px + 6, py + 9, 4, 6, T.trunk[0]);
  P.rect(px + 9, py + 9, 1, 6, T.trunk[1]);
  P.rect(px + 6, py + 14, 4, 1, T.trunk[1]);
  const dense = at(tx, ty - 1) === 'T';
  const ry = dense ? 8 : 7.5;
  blob(e, px + 8, py + 3 + (r() - 0.5), 8.2, ry, T.canopy, 0.25);
  if (theme === 'marsh') {
    for (let i = 0; i < 4; i++) {
      const x = px + 2 + Math.floor(r() * 12);
      for (let j = 0; j < 3 + Math.floor(r() * 3); j++) P.p(x, py + 9 + j, T.canopy[1]);
    }
  }
  if (theme === 'village' && r() > 0.75) {
    P.p(px + 5, py + 1, '#e04a4a');
    P.p(px + 10, py + 4, '#e04a4a');
  }
}

function drawRock(e: Env) {
  const { P, T, px, py } = e;
  P.rect(px + 2, py + 12, 13, 3, 'rgba(0,0,0,0.25)');
  blob(e, px + 8, py + 8, 7, 6.5, T.rock, 0.15);
}

const ROOFS = [
  ['#a84a3a', '#7a3028', '#c8644a'],
  ['#7a5a8a', '#563a66', '#9a7aaa'],
  ['#4a6a8a', '#334a66', '#6a8aaa'],
  ['#8a6a3a', '#664a28', '#a88a50'],
];

/** Give each connected group of `ch` tiles an index, for per-building colours. */
function labelRegions(map: ParsedMap, ch: string): Int32Array {
  const labels = new Int32Array(map.w * map.h).fill(-1);
  let next = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== -1 || map.terrain[i] !== ch) continue;
    const stack = [i];
    labels[i] = next;
    while (stack.length) {
      const j = stack.pop()!;
      const x = j % map.w;
      const y = Math.floor(j / map.w);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const k = ny * map.w + nx;
        if (labels[k] === -1 && map.terrain[k] === ch) {
          labels[k] = next;
          stack.push(k);
        }
      }
    }
    next++;
  }
  return labels;
}

function drawRoof(e: Env, region: number) {
  const { P, tx, ty, px, py, at } = e;
  const above = at(tx, ty - 1);
  const below = at(tx, ty + 1);
  const [base, dark, light] = ROOFS[Math.max(0, region) % ROOFS.length];
  P.rect(px, py, TILE, TILE, base);
  for (let row = 0; row < 4; row++) {
    const y = py + row * 4;
    P.rect(px, y + 3, TILE, 1, dark);
    const off = row % 2 ? 0 : 3;
    for (let x = off; x < 16; x += 6) P.rect(px + x, y, 1, 3, dark);
    P.rect(px, y, TILE, 1, light);
  }
  if (above !== 'R') {
    P.rect(px, py, TILE, 2, '#3a2a2a');
    P.rect(px, py + 2, TILE, 1, light);
  }
  if (below !== 'R') P.rect(px, py + 14, TILE, 2, '#2a1e1e');
  if (at(tx - 1, ty) !== 'R') P.rect(px, py, 1, TILE, '#2a1e1e');
  if (at(tx + 1, ty) !== 'R') P.rect(px + 15, py, 1, TILE, '#2a1e1e');
}

function drawHouseWall(e: Env, door: boolean) {
  const { P, tx, ty, px, py, at } = e;
  P.rect(px, py, TILE, TILE, '#e0d0b0');
  P.rect(px, py, TILE, 2, '#5a3a24');
  P.rect(px, py + 14, TILE, 2, '#5a3a24');
  const left = at(tx - 1, ty);
  const right = at(tx + 1, ty);
  if (left !== 'W' && left !== 'D') P.rect(px, py, 2, TILE, '#5a3a24');
  if (right !== 'W' && right !== 'D') P.rect(px + 14, py, 2, TILE, '#5a3a24');
  if (door) {
    P.rect(px + 3, py + 3, 10, 13, '#3a2416');
    P.rect(px + 4, py + 4, 8, 12, '#7a4a28');
    P.rect(px + 4, py + 4, 8, 1, '#9a6a3a');
    P.rect(px + 8, py + 4, 1, 12, '#5a3418');
    P.rect(px + 10, py + 10, 1, 1, '#f2c14e');
    return;
  }
  if ((tx * 7 + ty) % 3 === 0) {
    P.rect(px + 4, py + 4, 8, 7, '#3a2416');
    P.rect(px + 5, py + 5, 6, 5, '#ffd27a');
    P.rect(px + 5, py + 5, 3, 2, '#fff0b8');
    P.rect(px + 8, py + 5, 1, 5, '#3a2416');
    P.rect(px + 5, py + 7, 6, 1, '#3a2416');
    P.rect(px + 3, py + 11, 10, 1, '#5a3a24');
  } else {
    P.rect(px + 7, py + 2, 2, 12, '#7a5434');
    P.rect(px + 2, py + 7, 12, 1, '#7a5434');
  }
}

function drawFence(e: Env) {
  const { P, tx, ty, px, py, at } = e;
  const wood = '#8a5a3b';
  const dark = '#5f3b26';
  const hi = '#a87a52';
  const f = (x: number, y: number) => at(x, y) === 'F';
  P.rect(px + 6, py + 4, 4, 11, wood);
  P.rect(px + 6, py + 4, 4, 1, hi);
  P.rect(px + 9, py + 4, 1, 11, dark);
  P.rect(px + 6, py + 14, 4, 1, dark);
  if (f(tx - 1, ty)) {
    P.rect(px, py + 6, 6, 2, wood);
    P.rect(px, py + 10, 6, 2, wood);
    P.rect(px, py + 7, 6, 1, dark);
    P.rect(px, py + 11, 6, 1, dark);
  }
  if (f(tx + 1, ty)) {
    P.rect(px + 10, py + 6, 6, 2, wood);
    P.rect(px + 10, py + 10, 6, 2, wood);
    P.rect(px + 10, py + 7, 6, 1, dark);
    P.rect(px + 10, py + 11, 6, 1, dark);
  }
  if (f(tx, ty - 1)) P.rect(px + 7, py, 2, 4, wood);
  if (f(tx, ty + 1)) P.rect(px + 7, py + 15, 2, 1, wood);
}

function drawCrystal(e: Env) {
  const { P, T, px, py } = e;
  const [base, dark, light] = T.crystal;
  P.rect(px + 2, py + 13, 12, 3, 'rgba(0,0,0,0.3)');
  const shard = (x: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) {
      const ww = Math.max(1, Math.round(w * Math.min(1, (j + 1) / 3)));
      for (let i = 0; i < ww; i++) P.p(px + x + i - Math.floor(ww / 2), py + 14 - (h - j), i === 0 ? light : i === ww - 1 ? dark : base);
    }
  };
  shard(5, 4, 13);
  shard(10, 3, 9);
  shard(3, 2, 6);
  shard(12, 2, 5);
}

function drawPillar(e: Env) {
  const { P, T, px, py } = e;
  const [top, face, hi, deep] = T.wall;
  P.rect(px + 2, py + 13, 13, 3, 'rgba(0,0,0,0.25)');
  P.rect(px + 3, py - 8, 10, 4, top);
  P.over(px + 3, py - 8, 10, 4, top);
  P.over(px + 3, py - 8, 10, 1, hi);
  P.over(px + 4, py - 4, 8, 4, face);
  P.over(px + 4, py - 4, 2, 4, hi);
  P.over(px + 11, py - 4, 1, 4, deep);
  P.rect(px + 4, py, 8, 13, face);
  P.rect(px + 4, py, 2, 13, hi);
  P.rect(px + 11, py, 1, 13, deep);
  P.rect(px + 3, py + 12, 10, 3, top);
  P.rect(px + 3, py + 14, 10, 1, deep);
}

function drawBarrel(e: Env) {
  const { P, px, py, theme } = e;
  P.rect(px + 2, py + 13, 12, 3, 'rgba(0,0,0,0.25)');
  if (theme === 'mine' || theme === 'marsh') {
    // Crate.
    P.rect(px + 2, py + 3, 12, 12, '#8a6038');
    P.rect(px + 2, py + 3, 12, 1, '#b08050');
    P.rect(px + 2, py + 14, 12, 1, '#4a2e18');
    P.rect(px + 2, py + 3, 1, 12, '#4a2e18');
    P.rect(px + 13, py + 3, 1, 12, '#4a2e18');
    for (let i = 0; i < 10; i++) P.rect(px + 3 + i, py + 4 + i, 1, 1, '#5a3a20');
    return;
  }
  P.rect(px + 3, py + 2, 10, 13, '#8a5a32');
  P.rect(px + 4, py + 1, 8, 1, '#8a5a32');
  P.rect(px + 4, py + 2, 8, 2, '#5a3a20');
  P.rect(px + 3, py + 6, 10, 1, '#6a6a72');
  P.rect(px + 3, py + 11, 10, 1, '#6a6a72');
  P.rect(px + 4, py + 4, 2, 10, '#a8784a');
  P.rect(px + 12, py + 3, 1, 12, '#4a2e18');
}

function drawLamp(e: Env) {
  const { P, px, py } = e;
  P.rect(px + 4, py + 13, 8, 2, 'rgba(0,0,0,0.25)');
  P.rect(px + 7, py + 2, 2, 12, '#3a3440');
  P.rect(px + 6, py + 13, 4, 2, '#3a3440');
  P.over(px + 7, py - 2, 2, 4, '#3a3440');
  P.over(px + 5, py - 9, 6, 1, '#3a3440');
  P.over(px + 5, py - 8, 6, 6, '#ffd56b');
  P.over(px + 6, py - 7, 4, 4, '#fff3b0');
  P.over(px + 5, py - 8, 1, 6, '#3a3440');
  P.over(px + 10, py - 8, 1, 6, '#3a3440');
  P.over(px + 5, py - 3, 6, 1, '#3a3440');
}

function drawGrave(e: Env) {
  const { P, T, px, py, r } = e;
  const [base, dark, light] = T.rock;
  P.rect(px + 3, py + 13, 11, 3, 'rgba(0,0,0,0.25)');
  P.rect(px + 4, py + 3, 8, 11, base);
  P.rect(px + 5, py + 2, 6, 1, base);
  P.rect(px + 4, py + 3, 1, 11, light);
  P.rect(px + 11, py + 3, 1, 11, dark);
  P.rect(px + 7, py + 5, 2, 5, dark);
  P.rect(px + 6, py + 6, 4, 1, dark);
  if (r() > 0.5) P.rect(px + 4, py + 11, 3, 2, '#4a6a3a');
}

function drawWell(e: Env) {
  const { P, px, py } = e;
  P.rect(px + 1, py + 12, 15, 4, 'rgba(0,0,0,0.25)');
  P.rect(px + 1, py + 4, 14, 10, '#8a8796');
  P.rect(px + 1, py + 4, 14, 2, '#b0aec0');
  P.rect(px + 3, py + 6, 10, 4, '#1a2a4a');
  P.rect(px + 4, py + 7, 4, 1, '#3f7fcf');
  for (let i = 0; i < 14; i += 4) P.rect(px + 1 + i, py + 11, 1, 3, '#5a5866');
  P.over(px + 1, py - 4, 2, 8, '#5f3b26');
  P.over(px + 13, py - 4, 2, 8, '#5f3b26');
  P.over(px, py - 6, 16, 3, '#8a3a2a');
  P.over(px, py - 6, 16, 1, '#b05a3a');
}

function drawStatue(e: Env) {
  const { P, px, py } = e;
  const s = ['#9a98a8', '#6a6878', '#c4c2d0'];
  P.rect(px + 2, py + 12, 13, 4, 'rgba(0,0,0,0.25)');
  P.rect(px + 2, py + 10, 12, 5, s[1]);
  P.rect(px + 2, py + 10, 12, 1, s[2]);
  P.rect(px + 5, py + 1, 6, 9, s[0]);
  P.rect(px + 5, py + 1, 2, 9, s[2]);
  P.over(px + 5, py - 6, 6, 7, s[0]);
  P.over(px + 6, py - 9, 4, 4, s[0]);
  P.over(px + 6, py - 9, 1, 4, s[2]);
  P.over(px + 3, py - 4, 2, 6, s[1]);
  P.over(px + 11, py - 4, 2, 6, s[1]);
  P.over(px + 7, py - 12, 2, 3, '#ffd56b');
}

function drawStall(e: Env) {
  const { P, px, py, tx } = e;
  P.rect(px, py + 13, 16, 3, 'rgba(0,0,0,0.25)');
  P.rect(px, py + 6, 16, 9, '#8a5a32');
  P.rect(px, py + 6, 16, 2, '#a87a4a');
  P.rect(px, py + 14, 16, 1, '#4a2e18');
  const goods = ['#d64545', '#f2c14e', '#6dbb4f', '#b8862b'];
  for (let i = 0; i < 4; i++) P.rect(px + 1 + i * 4, py + 4, 3, 2, goods[(i + tx) % 4]);
  P.over(px, py - 6, 16, 5, tx % 2 ? '#d64545' : '#f4efe4');
  for (let i = 0; i < 16; i += 4) P.over(px + i, py - 6, 2, 5, tx % 2 ? '#f4efe4' : '#d64545');
  P.over(px, py - 1, 16, 1, '#5a3a24');
}

function drawBush(e: Env) {
  const { P, T, px, py } = e;
  P.rect(px + 2, py + 12, 13, 3, 'rgba(0,0,0,0.22)');
  blob(e, px + 8, py + 8, 7, 6, T.canopy, 0.3);
}

function drawCrops(e: Env) {
  const { P, px, py, r } = e;
  P.rect(px, py, TILE, TILE, '#7a5a3a');
  for (let row = 0; row < 4; row++) P.rect(px, py + row * 4 + 3, TILE, 1, '#5a4028');
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = px + col * 4 + 1;
      const y = py + row * 4;
      P.rect(x, y + 1, 2, 2, r() > 0.3 ? '#6dbb4f' : '#a8c050');
      P.rect(x + 1, y, 1, 1, '#8ad06a');
    }
  }
}

function drawMushrooms(e: Env) {
  const { P, px, py, r } = e;
  for (let i = 0; i < 3; i++) {
    const x = px + 2 + Math.floor(r() * 10);
    const y = py + 6 + Math.floor(r() * 7);
    P.rect(x + 1, y, 1, 3, '#e8e4d0');
    P.rect(x, y - 1, 3, 1, '#5fd0c4');
    P.rect(x + 1, y - 2, 1, 1, '#c8fff8');
  }
}

function drawCrack(e: Env) {
  const { P, px, py, r } = e;
  let x = px + 4 + Math.floor(r() * 8);
  for (let y = py + 1; y < py + 15; y++) {
    P.rect(x, y, 1, 1, '#a070e0');
    if (r() > 0.6) P.rect(x + 1, y, 1, 1, '#5a3a8a');
    x += r() > 0.66 ? 1 : r() > 0.5 ? -1 : 0;
  }
}

function drawSeal(e: Env) {
  const { P, px, py, tx, ty, at } = e;
  P.rect(px, py, TILE, TILE, '#3a3448');
  P.rect(px, py, TILE, 1, '#5a5070');
  P.rect(px, py + 15, TILE, 1, '#1a1622');
  if (at(tx - 1, ty) !== 'N') P.rect(px, py, 2, TILE, '#1a1622');
  if (at(tx + 1, ty) !== 'N') P.rect(px + 14, py, 2, TILE, '#1a1622');
  // Runes.
  P.rect(px + 7, py + 3, 2, 10, '#6a4a9a');
  P.rect(px + 4, py + 6, 8, 1, '#6a4a9a');
  P.rect(px + 5, py + 10, 6, 1, '#6a4a9a');
}

function drawRails(e: Env) {
  const { P, tx, ty, px, py, at } = e;
  const horiz = at(tx - 1, ty) === 'Y' || at(tx + 1, ty) === 'Y';
  const tie = '#5a3a24';
  const rail = '#8892a0';
  if (horiz) {
    for (let x = 1; x < 16; x += 4) P.rect(px + x, py + 4, 2, 9, tie);
    P.rect(px, py + 5, 16, 1, rail);
    P.rect(px, py + 11, 16, 1, rail);
  } else {
    for (let y = 1; y < 16; y += 4) P.rect(px + 4, py + y, 9, 2, tie);
    P.rect(px + 5, py, 1, 16, rail);
    P.rect(px + 11, py, 1, 16, rail);
  }
}

function drawBridge(e: Env, horiz: boolean) {
  const { P, tx, ty, px, py, at } = e;
  const plank = '#a0703f';
  const dark = '#6a4422';
  const light = '#c08a50';
  if (horiz) {
    P.rect(px, py + 2, 16, 12, plank);
    for (let x = 0; x < 16; x += 4) {
      P.rect(px + x, py + 2, 1, 12, dark);
      P.rect(px + x + 1, py + 2, 1, 12, light);
    }
    P.rect(px, py + 1, 16, 2, '#5a3a20');
    P.rect(px, py + 13, 16, 2, '#5a3a20');
    if (at(tx - 1, ty) !== '=' || tx % 3 === 0) P.rect(px + 1, py, 2, 3, '#4a2e18');
  } else {
    P.rect(px + 2, py, 12, 16, plank);
    for (let y = 0; y < 16; y += 4) {
      P.rect(px + 2, py + y, 12, 1, dark);
      P.rect(px + 2, py + y + 1, 12, 1, light);
    }
    P.rect(px + 1, py, 2, 16, '#5a3a20');
    P.rect(px + 13, py, 2, 16, '#5a3a20');
    if (at(tx, ty - 1) !== 'H' || ty % 3 === 0) P.rect(px + 1, py + 1, 2, 2, '#4a2e18');
  }
}

/** Colour of a tile on the map screen. */
export function minimapColor(ch: string, theme: ThemeId): string {
  const T = THEMES[theme];
  switch (ch) {
    case '~':
      return T.water[0];
    case '=':
    case 'H':
      return '#a0703f';
    case 'X':
      return '#0a0810';
    case ':':
      return T.path[0];
    case ';':
      return T.sand[0];
    case '_':
    case 'Y':
      return T.floor[0];
    case '#':
    case 'N':
      return T.wall[3];
    case 'T':
    case 'U':
      return T.canopy[1];
    case 'R':
      return '#8a3a2a';
    case 'W':
    case 'D':
      return '#c0b090';
    case 'C':
      return T.crystal[0];
    case '^':
    case 'P':
    case 'Q':
    case 'G':
    case 'B':
    case 'O':
    case 'K':
    case 'L':
    case 'F':
      return T.rock[1];
    default:
      return T.grass[0];
  }
}
