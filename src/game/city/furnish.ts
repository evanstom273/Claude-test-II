import { B, T, type Building, type CityMap, type Prop, type PropKind } from './tiles';

type AddProp = (kind: PropKind, tx: number, ty: number, block: number, extra?: Partial<Prop>) => Prop;

const SOLID = B.PED | B.CAR;

/**
 * Fill a building with furniture suited to what it is. Furniture hugs the walls
 * so rooms stay walkable, and nothing goes in front of a door or doorway.
 */
export function furnish(c: CityMap, b: Building, r: () => number, addProp: AddProp) {
  const W = c.W;
  const at = (x: number, y: number) => c.kind[y * W + x];
  const mine = (x: number, y: number) => c.bld[y * W + x] === b.id + 1;
  const isFloor = (x: number, y: number) => mine(x, y) && at(x, y) === T.FLOOR;
  const isWall = (x: number, y: number) => at(x, y) === T.WALL || at(x, y) === T.DOOR;
  const taken = new Set<number>();
  /** Tiles furniture blocks people on. */
  const solid = new Set<number>();
  const key = (x: number, y: number) => y * W + x;

  // Keep the way in clear: around the door and any internal doorway.
  const reserve = (x: number, y: number, rad: number) => {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) taken.add(key(x + dx, y + dy));
  };
  reserve(b.door.x, b.door.y, 2);
  for (let y = b.y + 1; y < b.y + b.h - 1; y++)
    for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      if (!isFloor(x, y)) continue;
      const doorway = (isWall(x - 1, y) && isWall(x + 1, y)) || (isWall(x, y - 1) && isWall(x, y + 1));
      if (doorway) reserve(x, y, 1);
    }

  const floor: [number, number][] = [];
  for (let y = b.y + 1; y < b.y + b.h - 1; y++) for (let x = b.x + 1; x < b.x + b.w - 1; x++) if (isFloor(x, y)) floor.push([x, y]);
  const free = (x: number, y: number) => isFloor(x, y) && !taken.has(key(x, y));
  const wallSide = (x: number, y: number) => (isWall(x, y - 1) ? 'n' : isWall(x, y + 1) ? 's' : isWall(x - 1, y) ? 'w' : isWall(x + 1, y) ? 'e' : null);
  const againstWall = () => floor.filter(([x, y]) => free(x, y) && wallSide(x, y) !== null);
  const shuffle = <T,>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const put = (kind: PropKind, x: number, y: number, block = SOLID, extra: Partial<Prop> = {}) => {
    const tw = extra.tw ?? 1;
    const th = extra.th ?? 1;
    for (let yy = y; yy < y + th; yy++) for (let xx = x; xx < x + tw; xx++) if (!free(xx, yy)) return null;
    for (let yy = y; yy < y + th; yy++)
      for (let xx = x; xx < x + tw; xx++) {
        taken.add(key(xx, yy));
        if (block & B.PED) solid.add(key(xx, yy));
      }
    return addProp(kind, x, y, block, { building: b.id, ...extra });
  };
  /** Place up to n of a thing against walls. */
  const scatter = (kind: PropKind, n: number, block = SOLID, extra: Partial<Prop> = {}) => {
    let placed = 0;
    for (const [x, y] of shuffle(againstWall())) {
      if (placed >= n) break;
      if (put(kind, x, y, block, extra)) placed++;
    }
  };
  /** Anywhere free, keeping a tile from other furniture. */
  const middle = (kind: PropKind, n: number, block = SOLID, extra: Partial<Prop> = {}) => {
    let placed = 0;
    for (const [x, y] of shuffle(floor.filter(([x, y]) => free(x, y) && wallSide(x, y) === null))) {
      if (placed >= n) break;
      let crowded = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && taken.has(key(x + dx, y + dy)) && isFloor(x + dx, y + dy)) crowded = true;
      if (crowded) continue;
      if (put(kind, x, y, block, extra)) placed++;
    }
  };

  /**
   * A shop counter: a short run of counter tiles one step in from the door wall,
   * with a till and the shopkeeper's post behind it.
   */
  const counter = (len: number, kind: PropKind = 'counter') => {
    const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[b.door.side];
    const along = b.door.side === 'n' || b.door.side === 's' ? [1, 0] : [0, 1];
    // Counter runs across the room two tiles in from the door.
    const cx = b.door.x + inward[0] * 3;
    const cy = b.door.y + inward[1] * 3;
    const start = -Math.floor(len / 2) + (r() < 0.5 ? 1 : -1) * 2;
    const tiles: [number, number][] = [];
    for (let k = 0; k < len; k++) {
      const x = cx + along[0] * (start + k);
      const y = cy + along[1] * (start + k);
      if (isFloor(x, y) && !taken.has(key(x, y))) tiles.push([x, y]);
    }
    if (!tiles.length) return;
    const [tx, ty] = tiles[0];
    const post = { x: tx + inward[0], y: ty + inward[1] };
    if (!isFloor(post.x, post.y)) return;
    // The shopkeeper has to be able to get out from behind it (and you in):
    // trim the far end of the counter until there's a way round, then keep that way clear.
    let route = walkway(post, new Set(tiles.map(([x, y]) => key(x, y))));
    while (!route && tiles.length > 1) {
      tiles.pop();
      route = walkway(post, new Set(tiles.map(([x, y]) => key(x, y))));
    }
    if (!route) return;
    tiles.forEach(([x, y], i) => put(i === 0 ? 'register' : kind, x, y, SOLID));
    b.post = post;
    taken.add(key(post.x, post.y));
    for (const k of route) taken.add(k);
  };

  /** Tiles from a point to just inside the front door, walking round `extra` and anything solid. */
  function walkway(from: { x: number; y: number }, extra: Set<number>): number[] | null {
    const v = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[b.door.side];
    const goal = key(b.door.x + v[0], b.door.y + v[1]);
    const startK = key(from.x, from.y);
    const prev = new Map<number, number>([[startK, -1]]);
    const queue = [startK];
    while (queue.length) {
      const k = queue.shift()!;
      if (k === goal) {
        const out: number[] = [];
        for (let i = k; i !== -1; i = prev.get(i)!) out.push(i);
        return out;
      }
      const x = k % W;
      const y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = key(x + dx, y + dy);
        if (prev.has(nk) || !isFloor(x + dx, y + dy) || solid.has(nk) || extra.has(nk)) continue;
        prev.set(nk, k);
        queue.push(nk);
      }
    }
    return null;
  }

  switch (b.kind) {
    case 'house':
    case 'flats':
    case 'safehouse':
      scatter('bed', b.kind === 'flats' ? 2 : 1);
      scatter('sofa', 1);
      scatter('tv', 1);
      scatter('fridge', 1);
      scatter('plant', 1, 0);
      scatter('wardrobe', b.kind === 'safehouse' ? 1 : r() < 0.5 ? 1 : 0);
      middle('table', 1);
      if (b.kind !== 'safehouse' && r() < 0.3) scatter('safe', 1);
      break;
    case 'office':
      middle('desk', Math.max(2, Math.floor(floor.length / 8)));
      scatter('plant', 2, 0);
      scatter('cooler', 1);
      scatter('rack', 2);
      if (r() < 0.35) scatter('safe', 1);
      break;
    case 'bank':
      counter(5);
      scatter('safe', 3);
      scatter('plant', 2, 0);
      middle('desk', 1);
      break;
    case 'police':
      counter(3, 'desk');
      scatter('cell', 3, B.PED | B.CAR | B.SIGHT);
      scatter('gunrack', 1);
      middle('desk', 2);
      break;
    case 'hospital':
      counter(3, 'desk');
      scatter('hospbed', Math.max(2, Math.floor(floor.length / 7)));
      scatter('plant', 2, 0);
      break;
    case 'bar':
      counter(5);
      middle('table', 2);
      scatter('stool', 3, 0);
      middle('pooltable', 1, SOLID, { tw: 2 });
      scatter('jukebox', 1);
      break;
    case 'club':
      counter(4);
      scatter('booth', 3);
      scatter('jukebox', 2);
      break;
    case 'shop_food':
      counter(3);
      scatter('fridge', 3);
      middle('shelf', 2);
      break;
    case 'chippy':
      counter(4);
      middle('table', 2);
      scatter('chair', 3, 0);
      break;
    case 'shop_guns':
      counter(3);
      scatter('gunrack', 4);
      break;
    case 'shop_clothes':
      counter(3);
      middle('rack', 3);
      scatter('mirror', 2);
      break;
    case 'warehouse':
      middle('crate', Math.floor(floor.length / 6), SOLID | B.SIGHT, { variant: Math.floor(r() * 4) });
      scatter('shelf', 3);
      break;
    case 'gang_hq':
      scatter('sofa', 2);
      scatter('safe', 1);
      scatter('tv', 1);
      middle('table', 1);
      middle('pooltable', 1, SOLID, { tw: 2 });
      scatter('crate', 2);
      // Somebody's always minding the shop.
      {
        const spot = floor.find(([x, y]) => free(x, y));
        if (spot) b.post = { x: spot[0], y: spot[1] };
      }
      break;
    case 'garage':
    case 'respray':
      scatter('rack', 2);
      scatter('crate', 1);
      break;
  }
}
