import { packABGR } from '../art/color';
import { CHUNK, LANE, T, TILE, type CityMap } from './tiles';

/*
 * The ground painter. Every tile is painted straight into a pixel buffer by
 * rules that look at its neighbours: kerbs where pavement meets road, lane
 * markings and zebra crossings, foam where water meets land, brick faces on the
 * south side of walls, shadows on floors under walls. Seeded per tile, so the
 * same city always looks the same.
 */

const P = (hex: string) => packABGR(hex);

const ROAD = [P('#3b3a44'), P('#36353f'), P('#41404a'), P('#2f2e38')];
const LINE = P('#d6d2c8');
const KERB_HI = P('#b8b4bc');
const KERB_LO = P('#5a5862');
const PAVE = [P('#8d8995'), P('#86828e'), P('#938f9a')];
const MORTAR = P('#77737f');
const PLAZA = [P('#a49e9c'), P('#9a9492')];
const PLAZA_LINE = P('#8a8482');
const GRASS = [P('#4f8a3c'), P('#4a8438'), P('#558f40')];
const GRASS_DARK = P('#3d7230');
const GRASS_LIGHT = P('#6aa84a');
const FLOWERS = [P('#e86a8a'), P('#f2d84f'), P('#f4efe4')];
const DIRT = [P('#8a6a4a'), P('#7f6044'), P('#937252')];
const SAND = [P('#dcc890'), P('#d4c088'), P('#e2ce98')];
const WATER = [P('#2a4f86'), P('#28497e'), P('#2e558c')];
const WATER_HI = P('#5a86c0');
const FOAM = P('#d8e8f4');
const SHORE = P('#1e3a66');
const PIER = [P('#8a6440'), P('#7f5c3a')];
const PIER_LINE = P('#5a3e26');
const CONCRETE = [P('#8e8e94'), P('#88888e'), P('#94949a')];
const CONCRETE_LINE = P('#7a7a80');
const STAIN = P('#7e7e84');
const BAY = P('#c8c4bc');

interface WallSet {
  cap: number;
  capHi: number;
  face: number;
  mortar: number;
  inner: number;
  brick: boolean;
}
const wallSet = (cap: string, capHi: string, face: string, mortar: string, inner: string, brick = true): WallSet => ({
  cap: P(cap),
  capHi: P(capHi),
  face: P(face),
  mortar: P(mortar),
  inner: P(inner),
  brick,
});
/** Indexed by WALL.* in gen.ts. */
const WALLS: WallSet[] = [
  wallSet('#5a2a2a', '#7a3a34', '#a24a3a', '#7a3a2e', '#c8b8a8'),
  wallSet('#4a3428', '#644838', '#8a5a40', '#6a4430', '#c8b8a0'),
  wallSet('#4a4a52', '#626270', '#8a8a94', '#74747e', '#b8b8c0', false),
  wallSet('#6a6460', '#86807a', '#d8d0c4', '#bcb4a8', '#e0d8cc', false),
  wallSet('#2e3438', '#46505a', '#5a6a74', '#46545e', '#9aa4aa', false),
  wallSet('#2a3a4a', '#3a5068', '#5a86b0', '#3a5a7a', '#c0ccd8', false),
  wallSet('#6a5a2a', '#86743a', '#c8a85a', '#a88a44', '#e0d0a8'),
  wallSet('#2a4a34', '#3a6248', '#4a8a5a', '#3a6a48', '#c8d8c8', false),
  wallSet('#3a2048', '#523064', '#6a3a8a', '#4e2a68', '#a88ac0', false),
  wallSet('#1e2a44', '#2e3e60', '#3a5080', '#2e3e66', '#a8b4c8', false),
];
const WINDOW = P('#3a5068');
const WINDOW_HI = P('#8ab4d8');

/** Indexed by FLOOR.* in gen.ts: [base, alt, line]. */
const FLOORS: number[][] = [
  [P('#9a6a44'), P('#8a5e3c'), P('#6a4628')],
  [P('#e8e4dc'), P('#2a2a32'), P('#c0bcb4')],
  [P('#8a2e3a'), P('#7e2834'), P('#6a2030')],
  [P('#2e4a7a'), P('#2a4470'), P('#22385c')],
  [P('#7a7a80'), P('#74747a'), P('#68686e')],
  [P('#9ab8a0'), P('#90ae96'), P('#7a9a80')],
  [P('#d0c0a0'), P('#c4b494'), P('#a89878')],
  [P('#ff4fa8'), P('#4fe8ff'), P('#2a1a3a')],
  [P('#5a3a28'), P('#4e3222'), P('#3a2418')],
];
const DANCE = [P('#d84a98'), P('#4ac8e8'), P('#8a5ad8'), P('#e8c84a')];

function tileRng(seed: number, x: number, y: number) {
  let a = (seed ^ Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Darken a packed colour by blending with black. */
function shade(c: number, t: number) {
  const r = c & 255;
  const g = (c >> 8) & 255;
  const b = (c >> 16) & 255;
  const k = 1 - t;
  return ((255 << 24) | (Math.round(b * k) << 16) | (Math.round(g * k) << 8) | Math.round(r * k)) >>> 0;
}

export class PixelBuffer {
  data: Uint32Array;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }
  px(x: number, y: number, c: number) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) this.data.fill(c, yy * this.w + Math.max(0, x), yy * this.w + Math.min(this.w, x + w));
  }
  /** Darken a rectangle. */
  dim(x: number, y: number, w: number, h: number, t: number) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) this.data[yy * this.w + xx] = shade(this.data[yy * this.w + xx], t);
  }
}

export function paintTile(c: CityMap, tx: number, ty: number, buf: PixelBuffer, ox: number, oy: number) {
  const W = c.W;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < c.W && y < c.H;
  const k = (x: number, y: number) => (inb(x, y) ? c.kind[y * W + x] : T.WATER);
  const kind = k(tx, ty);
  const aux = inb(tx, ty) ? c.aux[ty * W + tx] : 0;
  const r = tileRng(c.seed, tx, ty);
  const noise = (cols: number[], density = 1) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = r();
        buf.px(ox + x, oy + y, v < density * 0.12 ? cols[1] : v > 1 - density * 0.1 ? cols[2] ?? cols[0] : cols[0]);
      }
  };
  const isRoad = (x: number, y: number) => k(x, y) === T.ROAD;

  switch (kind) {
    case T.ROAD: {
      noise(ROAD);
      if (r() < 0.25) buf.rect(ox + Math.floor(r() * 10), oy + Math.floor(r() * 10), 3 + Math.floor(r() * 3), 2, ROAD[3]);
      const lane = c.lane[ty * W + tx];
      const junction = (lane & LANE.JUNCTION) !== 0;
      const horiz = !junction && (lane & (LANE.E | LANE.W)) !== 0;
      const vert = !junction && (lane & (LANE.N | LANE.S)) !== 0;
      const laneAt = (x: number, y: number) => (inb(x, y) ? c.lane[y * W + x] : 0);
      if (horiz && lane & LANE.E && laneAt(tx, ty + 1) & LANE.W && !(laneAt(tx, ty + 1) & LANE.JUNCTION)) {
        for (let x = 0; x < TILE; x++) if ((tx * TILE + x) % 10 < 5) buf.px(ox + x, oy + 15, LINE);
      }
      if (vert && lane & LANE.N && laneAt(tx + 1, ty) & LANE.S && !(laneAt(tx + 1, ty) & LANE.JUNCTION)) {
        for (let y = 0; y < TILE; y++) if ((ty * TILE + y) % 10 < 5) buf.px(ox + 15, oy + y, LINE);
      }
      // Zebra crossings beside junctions.
      if (horiz && ((laneAt(tx - 1, ty) & LANE.JUNCTION) !== 0 || (laneAt(tx + 1, ty) & LANE.JUNCTION) !== 0)) {
        for (let y = 0; y < TILE; y++) if ((y + (lane & LANE.W ? 2 : 0)) % 4 < 2) buf.rect(ox + 3, oy + y, 10, 1, LINE);
      }
      if (vert && ((laneAt(tx, ty - 1) & LANE.JUNCTION) !== 0 || (laneAt(tx, ty + 1) & LANE.JUNCTION) !== 0)) {
        for (let x = 0; x < TILE; x++) if ((x + (lane & LANE.S ? 2 : 0)) % 4 < 2) buf.rect(ox + x, oy + 3, 1, 10, LINE);
      }
      // A dark gutter where the road meets the kerb.
      if (!isRoad(tx, ty - 1)) buf.rect(ox, oy, TILE, 1, KERB_LO);
      if (!isRoad(tx - 1, ty)) buf.rect(ox, oy, 1, TILE, KERB_LO);
      break;
    }
    case T.PAVE: {
      const shift = ty % 2 ? 4 : 0;
      const slab = [PAVE[Math.floor(r() * 3)], PAVE[Math.floor(r() * 3)], PAVE[Math.floor(r() * 3)], PAVE[Math.floor(r() * 3)]];
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const sx = Math.floor(((x + shift) % TILE) / 8);
          const sy = Math.floor(y / 8);
          const mortar = (x + shift) % 8 === 0 || y % 8 === 0;
          buf.px(ox + x, oy + y, mortar ? MORTAR : slab[sy * 2 + sx]);
        }
      if (r() < 0.15) buf.px(ox + 2 + Math.floor(r() * 12), oy + 2 + Math.floor(r() * 12), MORTAR);
      // Kerbs: a light stone edge and a dark drop to the road.
      if (isRoad(tx, ty + 1)) {
        buf.rect(ox, oy + 13, TILE, 2, KERB_HI);
        buf.rect(ox, oy + 15, TILE, 1, KERB_LO);
      }
      if (isRoad(tx, ty - 1)) buf.rect(ox, oy, TILE, 2, KERB_HI);
      if (isRoad(tx + 1, ty)) {
        buf.rect(ox + 13, oy, 2, TILE, KERB_HI);
        buf.rect(ox + 15, oy, 1, TILE, KERB_LO);
      }
      if (isRoad(tx - 1, ty)) buf.rect(ox, oy, 2, TILE, KERB_HI);
      break;
    }
    case T.PLAZA: {
      const a = (tx + ty) % 2;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const q = (Math.floor(x / 8) + Math.floor(y / 8) + a) % 2;
          buf.px(ox + x, oy + y, x % 8 === 0 || y % 8 === 0 ? PLAZA_LINE : PLAZA[q]);
        }
      break;
    }
    case T.GRASS:
    case T.FENCE: {
      const onConcrete = kind === T.FENCE && (k(tx - 1, ty) === T.CONCRETE || k(tx + 1, ty) === T.CONCRETE || k(tx, ty - 1) === T.CONCRETE || k(tx, ty + 1) === T.CONCRETE);
      if (onConcrete) noise(CONCRETE);
      else {
        noise(GRASS, 1.4);
        for (let n = 0; n < 5; n++) {
          const x = ox + Math.floor(r() * 15);
          const y = oy + 1 + Math.floor(r() * 14);
          buf.px(x, y, GRASS_DARK);
          buf.px(x + 1, y - 1, GRASS_LIGHT);
        }
        if (kind === T.GRASS && r() < 0.08) buf.px(ox + 3 + Math.floor(r() * 10), oy + 3 + Math.floor(r() * 10), FLOWERS[Math.floor(r() * 3)]);
      }
      if (kind === T.FENCE) paintFence(c, tx, ty, buf, ox, oy, onConcrete);
      break;
    }
    case T.DIRT:
      noise(DIRT, 1.5);
      break;
    case T.SAND: {
      noise(SAND, 1.2);
      if (k(tx, ty + 1) === T.WATER || k(tx + 1, ty) === T.WATER || k(tx - 1, ty) === T.WATER) buf.dim(ox, oy, TILE, TILE, 0.12);
      break;
    }
    case T.WATER: {
      noise(WATER);
      for (let n = 0; n < 2; n++) {
        const x = ox + Math.floor(r() * 12);
        const y = oy + Math.floor(r() * 15);
        buf.rect(x, y, 3, 1, WATER_HI);
      }
      const land = (x: number, y: number) => k(x, y) !== T.WATER;
      if (land(tx, ty - 1)) {
        buf.rect(ox, oy, TILE, 2, SHORE);
        buf.rect(ox, oy + 2, TILE, 1, FOAM);
      }
      if (land(tx, ty + 1)) buf.rect(ox, oy + 14, TILE, 2, FOAM);
      if (land(tx - 1, ty)) buf.rect(ox, oy, 2, TILE, FOAM);
      if (land(tx + 1, ty)) buf.rect(ox + 14, oy, 2, TILE, FOAM);
      break;
    }
    case T.PIER: {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) buf.px(ox + x, oy + y, y % 4 === 3 ? PIER_LINE : PIER[(Math.floor(y / 4) + tx) % 2]);
      for (let y = 1; y < TILE; y += 4) {
        buf.px(ox + 2, oy + y, PIER_LINE);
        buf.px(ox + 13, oy + y, PIER_LINE);
      }
      if (k(tx, ty + 1) === T.WATER) buf.rect(ox, oy + 14, TILE, 2, PIER_LINE);
      break;
    }
    case T.CONCRETE: {
      noise(CONCRETE);
      if (tx % 3 === 0) buf.rect(ox, oy, 1, TILE, CONCRETE_LINE);
      if (ty % 3 === 0) buf.rect(ox, oy, TILE, 1, CONCRETE_LINE);
      if (r() < 0.2) buf.rect(ox + Math.floor(r() * 10), oy + Math.floor(r() * 10), 4, 3, STAIN);
      break;
    }
    case T.PARKING: {
      noise(ROAD);
      if (k(tx - 1, ty) !== T.PARKING || tx % 2 === 0) buf.rect(ox, oy, 1, TILE, BAY);
      if (k(tx, ty - 1) !== T.PARKING) buf.rect(ox, oy, TILE, 1, BAY);
      break;
    }
    case T.WALL:
      paintWall(c, tx, ty, buf, ox, oy, aux, r);
      break;
    case T.FLOOR:
    case T.DOOR: {
      const fl = kind === T.DOOR ? floorOf(c, tx, ty) : aux;
      paintFloor(fl, tx, ty, buf, ox, oy, r);
      // Walls cast a short shadow onto the floor below them.
      if (k(tx, ty - 1) === T.WALL) buf.dim(ox, oy, TILE, 4, 0.28);
      if (k(tx - 1, ty) === T.WALL) buf.dim(ox, oy, 2, TILE, 0.18);
      break;
    }
  }
}

function floorOf(c: CityMap, tx: number, ty: number) {
  // A door takes the floor of the room it opens into.
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const i = (ty + dy) * c.W + tx + dx;
    if (c.kind[i] === T.FLOOR && c.bld[i] === c.bld[ty * c.W + tx]) return c.aux[i];
  }
  return 0;
}

function paintFloor(style: number, tx: number, ty: number, buf: PixelBuffer, ox: number, oy: number, r: () => number) {
  const [base, alt, line] = FLOORS[style] ?? FLOORS[0];
  switch (style) {
    case 0:
    case 8: // planks
      for (let y = 0; y < TILE; y++) {
        const row = Math.floor(y / 4);
        const joint = (row * 7 + tx * 5) % 16;
        for (let x = 0; x < TILE; x++) buf.px(ox + x, oy + y, y % 4 === 3 || x === joint ? line : (row + tx) % 2 ? base : alt);
      }
      break;
    case 1: // checker
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) buf.px(ox + x, oy + y, (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? alt : base);
      break;
    case 6: // tiles
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) buf.px(ox + x, oy + y, x % 8 === 0 || y % 8 === 0 ? line : base);
      break;
    case 7: // dance floor
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const q = (Math.floor(x / 8) + Math.floor(y / 8) * 2 + tx + ty * 3) % 4;
          buf.px(ox + x, oy + y, x % 8 === 0 || y % 8 === 0 ? line : DANCE[q]);
        }
      break;
    default:
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) buf.px(ox + x, oy + y, r() < 0.15 ? alt : base);
      if (style === 4 && tx % 2 === 0) buf.rect(ox, oy, 1, TILE, line);
  }
}

function paintWall(c: CityMap, tx: number, ty: number, buf: PixelBuffer, ox: number, oy: number, style: number, r: () => number) {
  const s = WALLS[style] ?? WALLS[0];
  const W = c.W;
  const below = ty + 1 < c.H ? c.kind[(ty + 1) * W + tx] : T.WATER;
  const showsFace = below !== T.WALL && below !== T.DOOR;
  const mineBelow = ty + 1 < c.H && c.bld[(ty + 1) * W + tx] === c.bld[ty * W + tx];
  // The top of the wall.
  const capH = showsFace ? 7 : TILE;
  buf.rect(ox, oy, TILE, capH, s.cap);
  buf.rect(ox, oy, TILE, 1, s.capHi);
  if (ty > 0 && c.kind[(ty - 1) * W + tx] === T.WALL) buf.rect(ox, oy, TILE, 1, s.cap);
  if (!showsFace) {
    for (let n = 0; n < 3; n++) buf.px(ox + Math.floor(r() * 16), oy + Math.floor(r() * 16), s.capHi);
    return;
  }
  // The face of the wall.
  const faceY = oy + capH;
  const faceH = TILE - capH;
  if (mineBelow) {
    // Inside: plain painted plaster with a skirting board.
    buf.rect(ox, faceY, TILE, faceH, s.inner);
    buf.rect(ox, oy + TILE - 2, TILE, 2, shade(s.inner, 0.35));
    buf.rect(ox, faceY, TILE, 1, shade(s.inner, 0.15));
    return;
  }
  buf.rect(ox, faceY, TILE, faceH, s.face);
  if (s.brick) {
    for (let y = 0; y < faceH; y++) {
      const row = Math.floor(y / 3);
      for (let x = 0; x < TILE; x++) if (y % 3 === 2 || (x + (row % 2) * 4) % 8 === 0) buf.px(ox + x, faceY + y, s.mortar);
    }
  } else {
    for (let x = 0; x < TILE; x += 8) buf.rect(ox + x, faceY, 1, faceH, s.mortar);
  }
  // Windows on exterior faces.
  if ((tx * 7 + ty * 3) % 3 === 0) {
    buf.rect(ox + 4, faceY + 1, 8, faceH - 3, WINDOW);
    buf.rect(ox + 5, faceY + 2, 2, 2, WINDOW_HI);
    buf.rect(ox + 4, faceY + faceH - 2, 8, 1, s.capHi);
  }
  buf.rect(ox, oy + TILE - 1, TILE, 1, shade(s.face, 0.4));
}

function paintFence(c: CityMap, tx: number, ty: number, buf: PixelBuffer, ox: number, oy: number, chain: boolean) {
  const W = c.W;
  const isF = (x: number, y: number) => x >= 0 && y >= 0 && x < c.W && y < c.H && c.kind[y * W + x] === T.FENCE;
  const horiz = isF(tx - 1, ty) || isF(tx + 1, ty) || !(isF(tx, ty - 1) || isF(tx, ty + 1));
  const post = P(chain ? '#5a5a62' : '#6a4a2e');
  const rail = P(chain ? '#9a9aa2' : '#a8784a');
  const dark = P(chain ? '#3a3a42' : '#4a321e');
  if (horiz) {
    if (chain) {
      for (let y = 4; y < 14; y++) for (let x = 0; x < TILE; x++) if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) buf.px(ox + x, oy + y, rail);
      buf.rect(ox, oy + 3, TILE, 1, post);
      buf.rect(ox, oy + 14, TILE, 1, dark);
      buf.rect(ox, oy + 3, 1, 12, post);
    } else {
      for (let x = 1; x < TILE; x += 4) {
        buf.rect(ox + x, oy + 5, 2, 9, rail);
        buf.px(ox + x, oy + 4, rail);
        buf.rect(ox + x + 1, oy + 6, 1, 8, dark);
      }
      buf.rect(ox, oy + 8, TILE, 1, dark);
      buf.dim(ox, oy + 14, TILE, 1, 0.3);
    }
  } else {
    buf.rect(ox + 6, oy, 3, TILE, chain ? rail : rail);
    buf.rect(ox + 8, oy, 1, TILE, dark);
    for (let y = 0; y < TILE; y += 8) buf.rect(ox + 5, oy + y, 5, 2, post);
  }
}

/** Paint one chunk into an ImageData-ready buffer. */
export function paintChunk(c: CityMap, cx: number, cy: number): PixelBuffer {
  const size = CHUNK * TILE;
  const buf = new PixelBuffer(size, size);
  for (let ty = 0; ty < CHUNK; ty++)
    for (let tx = 0; tx < CHUNK; tx++) {
      const wx = cx * CHUNK + tx;
      const wy = cy * CHUNK + ty;
      paintTile(c, wx, wy, buf, tx * TILE, ty * TILE);
    }
  return buf;
}

export function bufferToCanvas(buf: PixelBuffer): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.w;
  canvas.height = buf.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(buf.w, buf.h);
  new Uint32Array(img.data.buffer).set(buf.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** One pixel per tile, for the minimap and the city map. */
export function paintMinimap(c: CityMap): HTMLCanvasElement {
  const buf = new PixelBuffer(c.W, c.H);
  const col: Record<number, number> = {
    [T.WATER]: P('#1e3a66'),
    [T.GRASS]: P('#3f7a32'),
    [T.PAVE]: P('#7a7682'),
    [T.ROAD]: P('#2e2d36'),
    [T.DIRT]: P('#6a5038'),
    [T.SAND]: P('#c8b47a'),
    [T.PIER]: P('#7a5838'),
    [T.WALL]: P('#c8bca8'),
    [T.FLOOR]: P('#9a8e7e'),
    [T.DOOR]: P('#e8dcc8'),
    [T.PARKING]: P('#3a3944'),
    [T.PLAZA]: P('#8a8482'),
    [T.CONCRETE]: P('#6a6a70'),
    [T.FENCE]: P('#5a5a5a'),
  };
  for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) buf.px(x, y, col[c.kind[y * c.W + x]] ?? 0);
  return bufferToCanvas(buf);
}
