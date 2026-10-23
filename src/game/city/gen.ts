import type { GangId } from '../../data/cast';
import { rng } from '../art/pixels';
import { furnish } from './furnish';
import { buildingName, resetNames } from './names';
import {
  B,
  CHUNK,
  DISTRICTS,
  LANE,
  T,
  chunkKey,
  type Block,
  type Building,
  type BuildingKind,
  type CityMap,
  type District,
  type Prop,
  type PropKind,
  type Side,
} from './tiles';

/*
 * The city of Grimsport, generated from a seed: an island with a grid of
 * two-lane roads, blocks sorted into districts, and buildings with rooms and
 * furniture inside. Everything is plain data; painting happens elsewhere.
 */

export const CITY_SIZE = 208;
const ROADS = 8;

export const GANG_NAMES: Record<GangId, string> = { vipers: 'Vipers', crowns: 'Velvet Crowns', rats: 'Dock Rats' };

/** Wall and floor style indices; the painter has a colour set for each. */
export const WALL = { redBrick: 0, brownBrick: 1, concrete: 2, render: 3, metal: 4, glass: 5, yellowBrick: 6, green: 7, purple: 8, navy: 9 } as const;
export const FLOOR = { wood: 0, checker: 1, carpetRed: 2, carpetBlue: 3, concrete: 4, lino: 5, tiles: 6, dance: 7, darkWood: 8 } as const;

const STYLE: Record<BuildingKind, { wall: number[]; floor: number }> = {
  house: { wall: [WALL.redBrick, WALL.brownBrick, WALL.render, WALL.yellowBrick], floor: FLOOR.wood },
  flats: { wall: [WALL.brownBrick, WALL.concrete, WALL.yellowBrick], floor: FLOOR.carpetBlue },
  safehouse: { wall: [WALL.redBrick], floor: FLOOR.wood },
  office: { wall: [WALL.glass, WALL.concrete, WALL.render], floor: FLOOR.carpetBlue },
  bank: { wall: [WALL.render], floor: FLOOR.checker },
  police: { wall: [WALL.navy], floor: FLOOR.lino },
  hospital: { wall: [WALL.render], floor: FLOOR.lino },
  bar: { wall: [WALL.brownBrick, WALL.green, WALL.redBrick], floor: FLOOR.darkWood },
  club: { wall: [WALL.purple], floor: FLOOR.dance },
  shop_food: { wall: [WALL.green, WALL.render], floor: FLOOR.tiles },
  chippy: { wall: [WALL.render, WALL.yellowBrick], floor: FLOOR.checker },
  shop_guns: { wall: [WALL.metal], floor: FLOOR.concrete },
  shop_clothes: { wall: [WALL.render, WALL.purple], floor: FLOOR.carpetRed },
  warehouse: { wall: [WALL.metal, WALL.concrete], floor: FLOOR.concrete },
  gang_hq: { wall: [WALL.metal, WALL.brownBrick], floor: FLOOR.carpetRed },
  garage: { wall: [WALL.metal], floor: FLOOR.concrete },
  respray: { wall: [WALL.metal], floor: FLOOR.concrete },
};

/** Special buildings each district hands out first; after that, the filler. */
const QUEUE: Record<District, { first: BuildingKind[]; filler: BuildingKind[] }> = {
  downtown: { first: ['bank', 'police', 'hospital', 'shop_clothes', 'shop_food', 'chippy'], filler: ['office', 'office', 'flats', 'shop_food'] },
  strip: { first: ['club', 'gang_hq', 'bar', 'shop_guns', 'chippy', 'bar', 'shop_clothes', 'shop_food', 'bar'], filler: ['bar', 'flats', 'shop_food', 'office'] },
  residential: { first: ['safehouse', 'shop_food', 'bar', 'chippy', 'shop_food', 'bar'], filler: ['house', 'house', 'house', 'flats'] },
  industrial: { first: ['gang_hq', 'garage', 'respray', 'shop_guns'], filler: ['warehouse'] },
  docks: { first: ['gang_hq', 'bar', 'garage'], filler: ['warehouse'] },
  park: { first: [], filler: [] },
  coast: { first: [], filler: [] },
};

export function generateCity(seed: number): CityMap {
  resetNames();
  const W = CITY_SIZE;
  const H = CITY_SIZE;
  const r = rng(seed);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const N = W * H;
  const c: CityMap = {
    seed,
    W,
    H,
    kind: new Uint8Array(N),
    aux: new Uint8Array(N),
    bld: new Uint16Array(N),
    block: new Uint8Array(N),
    lane: new Uint8Array(N),
    district: new Uint8Array(N).fill(DISTRICTS.indexOf('coast')),
    turf: new Uint8Array(N),
    buildings: [],
    blocks: [],
    props: [],
    propsByChunk: new Map(),
    roadsX: [],
    roadsY: [],
    parking: [],
    payphones: [],
    spawn: { x: 0, y: 0 },
  };
  const K = (x: number, y: number) => y * W + x;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const setK = (x: number, y: number, k: number, aux = 0) => {
    if (!ok(x, y)) return;
    c.kind[K(x, y)] = k;
    c.aux[K(x, y)] = aux;
  };
  const getK = (x: number, y: number) => (ok(x, y) ? c.kind[K(x, y)] : T.WATER);
  const fill = (x0: number, y0: number, x1: number, y1: number, k: number, aux = 0) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setK(x, y, k, aux);
  };
  let propId = 0;
  const addProp = (kind: PropKind, tx: number, ty: number, block: number, extra: Partial<Prop> = {}): Prop => {
    const p: Prop = { id: propId++, kind, tx, ty, tw: 1, th: 1, block, ...extra };
    c.props.push(p);
    return p;
  };

  // ---- Roads -----------------------------------------------------------------------
  const lo = 18;
  const hi = W - 20;
  const spacing = (hi - lo) / (ROADS - 1);
  for (let i = 0; i < ROADS; i++) {
    const jx = i === 0 || i === ROADS - 1 ? 0 : ri(-2, 2);
    const jy = i === 0 || i === ROADS - 1 ? 0 : ri(-2, 2);
    c.roadsX.push(Math.round(lo + i * spacing + jx));
    c.roadsY.push(Math.round(lo + i * spacing + jy));
  }
  const xs = c.roadsX;
  const ys = c.roadsY;
  const minX = xs[0];
  const maxX = xs[ROADS - 1] + 1;
  const minY = ys[0];
  const maxY = ys[ROADS - 1] + 1;

  // ---- Coast ------------------------------------------------------------------------
  // Land reaches a few tiles past the ring road, with a ragged shoreline.
  let wobble = 0;
  for (let y = 0; y < H; y++) {
    wobble = Math.max(-1, Math.min(2, wobble + ri(-1, 1)));
    for (let x = 0; x < W; x++) {
      const west = minX - 6 - wobble;
      const east = maxX + 12;
      const north = minY - 6;
      const south = maxY + 7;
      if (x >= west && x <= east && y >= north - (x % 7 === 0 ? 1 : 0) && y <= south + (x % 5 === 0 ? 1 : 0)) {
        // Default coast ground by side.
        let k: number = T.GRASS;
        if (x > maxX) k = T.CONCRETE;
        else if (y > maxY) k = T.SAND;
        else if (x < minX) k = y % 9 < 6 ? T.SAND : T.GRASS;
        setK(x, y, k);
      }
    }
  }
  // Promenade pavement around the ring.
  fill(minX - 2, minY - 2, maxX + 2, minY - 1, T.PAVE);
  fill(minX - 2, maxY + 1, maxX + 2, maxY + 2, T.PAVE);
  fill(minX - 2, minY - 2, minX - 1, maxY + 2, T.PAVE);
  fill(maxX + 1, minY - 2, maxX + 2, maxY + 2, T.PAVE);

  // Piers on the docks side.
  for (let y = minY + 6; y < maxY - 6; y += ri(16, 22)) {
    const len = ri(6, 9);
    fill(maxX + 13, y, maxX + 12 + len, y + 2, T.PIER);
    addProp('bollard', maxX + 12 + len, y, B.CAR | B.PED);
  }

  for (const x of xs)
    for (let y = minY; y <= maxY; y++) {
      setK(x, y, T.ROAD);
      setK(x + 1, y, T.ROAD);
      c.lane[K(x, y)] |= LANE.N;
      c.lane[K(x + 1, y)] |= LANE.S;
    }
  for (const y of ys)
    for (let x = minX; x <= maxX; x++) {
      setK(x, y, T.ROAD);
      setK(x, y + 1, T.ROAD);
      c.lane[K(x, y)] |= LANE.E;
      c.lane[K(x, y + 1)] |= LANE.W;
    }
  for (const x of xs) for (const y of ys) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) c.lane[K(x + dx, y + dy)] |= LANE.JUNCTION | LANE.N | LANE.S | LANE.E | LANE.W;

  // ---- Blocks and districts ------------------------------------------------------------
  const parkBlocks = new Set([`1,5`, `4,1`]);
  for (let j = 0; j < ROADS - 1; j++)
    for (let i = 0; i < ROADS - 1; i++) {
      let d: District = 'residential';
      if (i === ROADS - 2) d = 'docks';
      else if (i >= 4 && j <= 2) d = 'industrial';
      else if (j === 4 && i >= 1 && i <= 5) d = 'strip';
      else if (i >= 2 && i <= 4 && j >= 1 && j <= 3) d = 'downtown';
      if (parkBlocks.has(`${i},${j}`)) d = 'park';
      let gang: GangId | undefined;
      if (d === 'docks') gang = 'rats';
      else if (d === 'industrial' || (d === 'residential' && i >= 4 && j >= 5)) gang = 'vipers';
      else if (d === 'strip' || (d === 'downtown' && j === 3)) gang = 'crowns';
      c.blocks.push({ i, j, x0: xs[i] + 2, y0: ys[j] + 2, x1: xs[i + 1] - 1, y1: ys[j + 1] - 1, district: d, gang });
    }
  // Coast tiles east of the docks blocks belong to the Dock Rats too.
  for (let y = minY - 6; y <= maxY + 7; y++) for (let x = maxX + 1; x <= maxX + 22; x++) if (ok(x, y)) c.turf[K(x, y)] = 3;

  const queues = new Map<District, BuildingKind[]>();
  for (const d of Object.keys(QUEUE) as District[]) queues.set(d, [...QUEUE[d].first]);
  const nextKind = (d: District): BuildingKind => {
    const q = queues.get(d)!;
    if (q.length) return q.shift()!;
    const f = QUEUE[d].filler;
    return f[Math.floor(r() * f.length)];
  };

  // ---- Buildings ---------------------------------------------------------------------------
  const addBuilding = (x: number, y: number, w: number, h: number, kind: BuildingKind, district: District, side: Side, gang?: GangId): Building => {
    const id = c.buildings.length;
    const style = STYLE[kind];
    const wallStyle = style.wall[Math.floor(r() * style.wall.length)];
    const b: Building = { id, x, y, w, h, kind, district, name: buildingName(kind, gang ? GANG_NAMES[gang] : undefined), door: { x: 0, y: 0, side }, wall: wallStyle, floor: style.floor, gang };
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const edge = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
        setK(xx, yy, edge ? T.WALL : T.FLOOR, edge ? wallStyle : style.floor);
        c.bld[K(xx, yy)] = id + 1;
      }
    // Front door roughly central on the front side.
    const along = side === 'n' || side === 's' ? w : h;
    const off = Math.max(1, Math.min(along - 2, Math.floor(along / 2) + ri(-1, 1)));
    const dx = side === 'n' || side === 's' ? x + off : side === 'w' ? x : x + w - 1;
    const dy = side === 'w' || side === 'e' ? y + off : side === 'n' ? y : y + h - 1;
    b.door = { x: dx, y: dy, side };
    if (kind === 'garage' || kind === 'respray') {
      // A wide opening you can drive through.
      for (let k = -1; k <= 1; k++) {
        const ox = side === 'n' || side === 's' ? dx + k : dx;
        const oy = side === 'w' || side === 'e' ? dy + k : dy;
        if (ox > x && ox < x + w - 1 && oy > y && oy < y + h - 1) continue;
        setK(ox, oy, T.FLOOR, style.floor);
      }
    } else {
      setK(dx, dy, T.DOOR, wallStyle);
      addProp('door', dx, dy, B.CAR, { building: id, variant: side === 'n' || side === 's' ? 0 : 1 });
    }
    // Split big buildings into rooms with open doorways.
    if (kind !== 'warehouse' && kind !== 'garage' && kind !== 'respray' && kind !== 'club') {
      if (w >= 11) {
        const wx = x + Math.floor(w / 2) + ri(-1, 1);
        const gap = ri(y + 1, y + h - 2);
        for (let yy = y + 1; yy < y + h - 1; yy++) if (yy !== gap && !(Math.abs(yy - dy) <= 1 && Math.abs(wx - dx) <= 1)) setK(wx, yy, T.WALL, wallStyle);
      }
      if (h >= 10) {
        const wy = y + Math.floor(h / 2) + ri(-1, 1);
        const gap = ri(x + 1, x + w - 2);
        for (let xx = x + 1; xx < x + w - 1; xx++) if (xx !== gap && getK(xx, wy) === T.FLOOR && !(Math.abs(xx - dx) <= 1 && Math.abs(wy - dy) <= 1)) setK(xx, wy, T.WALL, wallStyle);
      }
    }
    c.buildings.push(b);
    return b;
  };

  /** Lay a path of pavement from a door out to the street. */
  const pathOut = (b: Building, stopAt: (x: number, y: number) => boolean) => {
    const v = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[b.door.side];
    let x = b.door.x + v[0];
    let y = b.door.y + v[1];
    for (let n = 0; n < 6 && ok(x, y) && !stopAt(x, y); n++) {
      setK(x, y, T.PAVE);
      x += v[0];
      y += v[1];
    }
  };

  const sideToward = (lx0: number, ly0: number, lx1: number, ly1: number, b: Block): Side => {
    const dN = ly0 - (b.y0 + 1);
    const dS = b.y1 - 1 - ly1;
    const dW = lx0 - (b.x0 + 1);
    const dE = b.x1 - 1 - lx1;
    const m = Math.min(dN, dS, dW, dE);
    return m === dN ? 'n' : m === dS ? 's' : m === dW ? 'w' : 'e';
  };

  // Process blocks nearest the centre first, so the special buildings land centrally.
  const centre = W / 2;
  const ordered = [...c.blocks].sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - centre, (a.y0 + a.y1) / 2 - centre) - Math.hypot((b.x0 + b.x1) / 2 - centre, (b.y0 + b.y1) / 2 - centre));

  for (const b of ordered) {
    const di = DISTRICTS.indexOf(b.district);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        c.district[K(x, y)] = di;
        if (b.gang) c.turf[K(x, y)] = ['vipers', 'crowns', 'rats'].indexOf(b.gang) + 1;
      }
    // Pavement ring.
    fill(b.x0, b.y0, b.x1, b.y1, T.PAVE);
    const ix0 = b.x0 + 1;
    const iy0 = b.y0 + 1;
    const ix1 = b.x1 - 1;
    const iy1 = b.y1 - 1;
    const iw = ix1 - ix0 + 1;
    const ih = iy1 - iy0 + 1;

    if (b.district === 'park') {
      fill(ix0, iy0, ix1, iy1, T.GRASS);
      const mx = Math.floor((ix0 + ix1) / 2);
      const my = Math.floor((iy0 + iy1) / 2);
      fill(mx, iy0, mx + 1, iy1, T.PLAZA);
      fill(ix0, my, ix1, my + 1, T.PLAZA);
      // A pond in one quarter.
      const px = ri(0, 1) ? ix0 + 3 : mx + 4;
      const py = ri(0, 1) ? iy0 + 3 : my + 4;
      for (let y = py; y < py + 5; y++) for (let x = px; x < px + 6; x++) if (Math.hypot((x - px - 2.5) / 3, (y - py - 2) / 2.5) < 1) setK(x, y, T.WATER);
      for (let n = 0; n < 34; n++) {
        const x = ri(ix0, ix1);
        const y = ri(iy0, iy1);
        if (getK(x, y) === T.GRASS && getK(x, y + 1) !== T.WATER && !c.props.some((p) => p.tx === x && p.ty === y)) addProp(r() < 0.75 ? 'tree' : 'bush', x, y, r() < 0.75 ? B.PED | B.CAR : 0);
      }
      for (let y = iy0 + 2; y < iy1; y += 5) {
        addProp('bench', mx - 1, y, 0);
        addProp('lamp', mx + 2, y + 2, B.CAR);
      }
      for (let x = ix0 + 2; x < ix1; x += 6) addProp('lamp', x, my - 1, B.CAR);
      continue;
    }

    if (b.district === 'residential' || b.district === 'strip') {
      // Two rows of lots, the north row facing north and the south row facing south.
      fill(ix0, iy0, ix1, iy1, b.district === 'residential' ? T.GRASS : T.PLAZA);
      const rows = ih >= 12 ? 2 : 1;
      const rowH = rows === 2 ? Math.floor(ih / 2) : ih;
      for (let row = 0; row < rows; row++) {
        const ry0 = iy0 + row * rowH;
        const ry1 = row === rows - 1 ? iy1 : ry0 + rowH - 1;
        const facing: Side = row === 0 ? 'n' : 's';
        let x = ix0;
        while (x <= ix1) {
          let lw = b.district === 'strip' ? ri(6, 8) : ri(6, 8);
          if (ix1 - (x + lw) + 1 < 6) lw = ix1 - x + 1;
          const lx0 = x;
          const lx1 = x + lw - 1;
          x += lw;
          const kind = nextKind(b.district);
          const big = kind === 'flats' || kind === 'club' || kind === 'gang_hq';
          if (b.district === 'residential' && (kind === 'house' || kind === 'safehouse' || kind === 'flats')) {
            const bh = Math.min(rowH - 3, kind === 'flats' ? 9 : ri(6, 7));
            const by = facing === 'n' ? ry0 + 2 : ry1 - 1 - bh;
            const bw = lw - 2;
            const bld = addBuilding(lx0 + 1, by, bw, bh, kind, b.district, facing, b.gang);
            pathOut(bld, (_px, py) => py < iy0 || py > iy1);
            // Fences along the front and between gardens.
            const frontY = facing === 'n' ? ry0 : ry1;
            for (let fx = lx0; fx <= lx1; fx++) if (getK(fx, frontY) === T.GRASS) setK(fx, frontY, T.FENCE);
            for (let fy = ry0; fy <= ry1; fy++) if (lx0 > ix0 && getK(lx0, fy) === T.GRASS) setK(lx0, fy, T.FENCE);
            if (r() < 0.7) {
              const ty = facing === 'n' ? ry1 - 1 : ry0 + 1;
              const tx = ri(lx0 + 1, lx1 - 1);
              if (getK(tx, ty) === T.GRASS) addProp('tree', tx, ty, B.PED | B.CAR);
            }
          } else {
            // Shopfronts sit right on the pavement.
            const bh = Math.min(rowH - 1, big ? 9 : ri(6, 8));
            const by = facing === 'n' ? ry0 : ry1 - bh + 1;
            const bld = addBuilding(lx0, by, lw - (lx1 === ix1 ? 0 : 1), bh, kind, b.district, facing, kind === 'gang_hq' ? b.gang : undefined);
            if (kind !== 'house' && kind !== 'office' && kind !== 'warehouse') {
              const sy = facing === 'n' ? by - 1 : by + bh;
              const sx = Math.min(bld.x + bld.w - 2, bld.door.x + 1);
              const lit = kind !== 'flats' && (b.district === 'strip' || kind === 'bar' || kind === 'club');
              const neon = NEON[ri(0, NEON.length - 1)];
              addProp(lit ? 'neon' : 'sign', sx, sy, 0, { building: bld.id, text: bld.name, color: kind === 'flats' ? '#f4efe4' : neon });
            }
          }
        }
        // A back fence between the two rows of gardens.
        if (rows === 2 && row === 0 && b.district === 'residential') for (let fx = ix0; fx <= ix1; fx++) if (getK(fx, ry1) === T.GRASS) setK(fx, ry1, T.FENCE);
      }
    } else if (b.district === 'downtown') {
      fill(ix0, iy0, ix1, iy1, T.PLAZA);
      const splitX = iw >= 16;
      const splitY = ih >= 16;
      const lots: [number, number, number, number][] = [];
      const mx = Math.floor((ix0 + ix1) / 2);
      const my = Math.floor((iy0 + iy1) / 2);
      const xsplits = splitX ? [[ix0, mx - 1], [mx + 1, ix1]] : [[ix0, ix1]];
      const ysplits = splitY ? [[iy0, my - 1], [my + 1, iy1]] : [[iy0, iy1]];
      for (const [ax, bx] of xsplits) for (const [ay, by] of ysplits) lots.push([ax, ay, bx, by]);
      for (const [lx0, ly0, lx1, ly1] of lots) {
        if (r() < 0.12 && queues.get('downtown')!.length === 0) {
          // A little plaza with a tree and benches.
          addProp('tree', Math.floor((lx0 + lx1) / 2), Math.floor((ly0 + ly1) / 2), B.PED | B.CAR);
          addProp('bench', lx0 + 1, ly0 + 1, 0);
          addProp('lamp', lx1 - 1, ly1 - 1, B.CAR);
          continue;
        }
        const kind = nextKind('downtown');
        const bx0 = lx0 + 1;
        const by0 = ly0 + 1;
        const bw = lx1 - lx0 - 1;
        const bh = ly1 - ly0 - 1;
        const side = sideToward(bx0, by0, bx0 + bw - 1, by0 + bh - 1, b);
        const bld = addBuilding(bx0, by0, bw, bh, kind, 'downtown', side, kind === 'gang_hq' ? b.gang : undefined);
        if (kind !== 'office') {
          const v = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side];
          addProp('sign', bld.door.x + v[0] + (side === 'n' || side === 's' ? 1 : 0), bld.door.y + v[1] + (side === 'w' || side === 'e' ? 1 : 0), 0, { building: bld.id, text: bld.name, color: '#f4efe4' });
        }
      }
    } else {
      // Industrial and docks: one or two big sheds in a concrete yard.
      fill(ix0, iy0, ix1, iy1, T.CONCRETE);
      const two = iw >= 18;
      const halves: [number, number][] = two ? [[ix0, ix0 + Math.floor(iw / 2) - 1], [ix0 + Math.floor(iw / 2), ix1]] : [[ix0, ix1]];
      halves.forEach(([hx0, hx1], hiIdx) => {
        const kind = nextKind(b.district);
        const bw = Math.min(hx1 - hx0 - 1, kind === 'warehouse' ? ri(8, 11) : ri(7, 9));
        const bh = Math.min(ih - 6, kind === 'warehouse' ? ri(9, 12) : ri(7, 9));
        const bx = hx0 + 1 + Math.floor((hx1 - hx0 - 1 - bw) / 2);
        const by = r() < 0.5 ? iy0 + 1 : iy1 - bh;
        const side: Side = by === iy0 + 1 ? 's' : 'n';
        addBuilding(bx, by, bw, bh, kind, b.district, side, kind === 'gang_hq' ? b.gang : undefined);
        // Parking bays in the open part of the yard.
        const py0 = side === 's' ? by + bh + 2 : iy0 + 1;
        const py1 = side === 's' ? iy1 - 1 : by - 3;
        for (let x = hx0 + 1; x + 1 <= hx1 - 1; x += 2) {
          if (py1 - py0 < 1) break;
          if (r() < 0.55) {
            fill(x, py0, x + 1, py0 + 1, T.PARKING);
            c.parking.push({ x: (x + 1) * 16, y: (py0 + 1) * 16, angle: Math.PI / 2 });
          } else if (r() < 0.4) addProp(b.district === 'docks' ? 'container' : 'crate', x, py0, B.PED | B.CAR | B.SIGHT, { tw: b.district === 'docks' ? 2 : 1, th: 1, variant: ri(0, 3) });
        }
        if (hiIdx === 0) addProp('dumpster', hx0 + 1, side === 's' ? by + bh + 1 : by - 2, B.PED | B.CAR);
      });
      // Chain-link fence round the yard, open at the gates.
      for (let x = ix0; x <= ix1; x++)
        for (const y of [iy0, iy1])
          if (getK(x, y) === T.CONCRETE && (x - ix0) % 9 > 2 && !isNearDoor(c, x, y)) setK(x, y, T.FENCE);
    }
  }

  // ---- Street furniture -----------------------------------------------------------------------
  for (const b of c.blocks) {
    const every = b.district === 'downtown' || b.district === 'strip' ? 5 : 7;
    for (let x = b.x0; x <= b.x1; x += every) {
      if (getK(x, b.y0) === T.PAVE) addProp('lamp', x, b.y0, B.CAR);
      if (getK(x, b.y1) === T.PAVE) addProp('lamp', x, b.y1, B.CAR);
    }
    for (let y = b.y0 + every; y < b.y1; y += every) {
      if (getK(b.x0, y) === T.PAVE) addProp('lamp', b.x0, y, B.CAR);
      if (getK(b.x1, y) === T.PAVE) addProp('lamp', b.x1, y, B.CAR);
    }
    for (let n = 0; n < 3; n++) {
      const onX = r() < 0.5;
      const x = onX ? ri(b.x0 + 1, b.x1 - 1) : r() < 0.5 ? b.x0 : b.x1;
      const y = onX ? (r() < 0.5 ? b.y0 : b.y1) : ri(b.y0 + 1, b.y1 - 1);
      if (getK(x, y) === T.PAVE && !c.props.some((p) => p.tx === x && p.ty === y)) addProp(['bin', 'hydrant', 'bench'][ri(0, 2)] as PropKind, x, y, B.CAR);
    }
  }
  // Payphones, spread out across the city.
  for (const b of c.blocks) {
    if (b.district === 'park' || r() < 0.55) continue;
    for (let tries = 0; tries < 10; tries++) {
      const x = ri(b.x0 + 2, b.x1 - 2);
      const y = r() < 0.5 ? b.y0 : b.y1;
      if (getK(x, y) !== T.PAVE || c.props.some((p) => Math.abs(p.tx - x) <= 1 && p.ty === y)) continue;
      c.payphones.push(addProp('payphone', x, y, B.CAR));
      break;
    }
  }
  // Trees and benches along the coast.
  for (let y = minY; y < maxY; y += 4) {
    const x = minX - 4;
    if (getK(x, y) === T.GRASS) addProp('tree', x, y, B.PED | B.CAR);
  }
  for (let x = minX + 4; x < maxX; x += 12) addProp('bench', x, maxY + 2, 0);

  // ---- Interiors --------------------------------------------------------------------------------------
  for (const b of c.buildings) furnish(c, b, r, addProp);

  // ---- Blocking ---------------------------------------------------------------------------------------
  for (let i = 0; i < N; i++) {
    const k = c.kind[i];
    c.block[i] =
      k === T.WATER ? B.PED | B.CAR : k === T.WALL ? B.PED | B.CAR | B.SIGHT : k === T.FENCE ? B.PED | B.CAR : k === T.DOOR ? B.CAR : 0;
  }
  for (const p of c.props) {
    for (let y = p.ty; y < p.ty + p.th; y++) for (let x = p.tx; x < p.tx + p.tw; x++) if (ok(x, y)) c.block[K(x, y)] |= p.block;
    const key = chunkKey(Math.floor(p.tx / CHUNK), Math.floor(p.ty / CHUNK));
    let list = c.propsByChunk.get(key);
    if (!list) c.propsByChunk.set(key, (list = []));
    list.push(p);
  }

  const home = c.buildings.find((b) => b.kind === 'safehouse') ?? c.buildings[0];
  const v = { n: [0, -2], s: [0, 2], w: [-2, 0], e: [2, 0] }[home.door.side];
  c.spawn = { x: (home.door.x + v[0]) * 16 + 8, y: (home.door.y + v[1]) * 16 + 12 };
  return c;
}

const NEON = ['#ff4fa8', '#4fe8ff', '#ffd84f', '#8a6aff', '#5aff8a'];

function isNearDoor(c: CityMap, x: number, y: number) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (c.kind[(y + dy) * c.W + x + dx] === T.DOOR) return true;
  return false;
}
