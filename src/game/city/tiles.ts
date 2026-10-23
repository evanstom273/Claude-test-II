import type { GangId } from '../../data/cast';

export const TILE = 16;
export const CHUNK = 32; // tiles per chunk side

/** Ground kinds, one byte per tile. */
export const T = {
  WATER: 0,
  GRASS: 1,
  PAVE: 2,
  ROAD: 3,
  DIRT: 4,
  SAND: 5,
  PIER: 6,
  WALL: 7,
  FLOOR: 8,
  DOOR: 9,
  PARKING: 10,
  PLAZA: 11,
  CONCRETE: 12,
  FENCE: 13,
} as const;
export type TileKind = (typeof T)[keyof typeof T];

/** Blocking flags. */
export const B = {
  PED: 1,
  CAR: 2,
  SIGHT: 4,
} as const;

/** Lane flags on road tiles: the direction traffic flows. */
export const LANE = {
  E: 1,
  W: 2,
  S: 4,
  N: 8,
  JUNCTION: 16,
} as const;

export type District = 'downtown' | 'strip' | 'residential' | 'industrial' | 'docks' | 'park' | 'coast';
export const DISTRICTS: District[] = ['downtown', 'strip', 'residential', 'industrial', 'docks', 'park', 'coast'];

export type BuildingKind =
  | 'house'
  | 'flats'
  | 'office'
  | 'bank'
  | 'police'
  | 'hospital'
  | 'bar'
  | 'club'
  | 'shop_food'
  | 'shop_guns'
  | 'shop_clothes'
  | 'chippy'
  | 'warehouse'
  | 'gang_hq'
  | 'safehouse'
  | 'garage'
  | 'respray';

export type Side = 'n' | 's' | 'e' | 'w';

export interface Building {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BuildingKind;
  district: District;
  name: string;
  /** Front door tile and the side of the building it's on. */
  door: { x: number; y: number; side: Side };
  /** Index into the wall and floor style tables. */
  wall: number;
  floor: number;
  gang?: GangId;
  /** Where the shopkeeper, barman or guard stands (tile). */
  post?: { x: number; y: number };
}

export type PropKind =
  | 'lamp'
  | 'tree'
  | 'bush'
  | 'bin'
  | 'bench'
  | 'hydrant'
  | 'payphone'
  | 'door'
  | 'counter'
  | 'register'
  | 'shelf'
  | 'fridge'
  | 'table'
  | 'chair'
  | 'bed'
  | 'sofa'
  | 'tv'
  | 'safe'
  | 'plant'
  | 'desk'
  | 'crate'
  | 'container'
  | 'pooltable'
  | 'stool'
  | 'jukebox'
  | 'rack'
  | 'gunrack'
  | 'cell'
  | 'hospbed'
  | 'dumpster'
  | 'neon'
  | 'sign'
  | 'bollard'
  | 'wardrobe'
  | 'mirror'
  | 'booth'
  | 'cooler';

export interface Prop {
  id: number;
  kind: PropKind;
  /** Tile it stands on. */
  tx: number;
  ty: number;
  /** Width/height in tiles for multi-tile props. */
  tw: number;
  th: number;
  /** Blocking flags from B. */
  block: number;
  building?: number;
  /** Free-form: sign text, container colour, door orientation... */
  variant?: number;
  text?: string;
  /** Neon/sign colour. */
  color?: string;
}

export interface Block {
  i: number;
  j: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  district: District;
  gang?: GangId;
}

export interface ParkingSpot {
  x: number;
  y: number;
  angle: number;
}

export interface CityMap {
  seed: number;
  W: number;
  H: number;
  kind: Uint8Array;
  /** Per-tile style: building wall/floor index, road markings etc. */
  aux: Uint8Array;
  /** Building id + 1 for walls, floors and doors; 0 outside. */
  bld: Uint16Array;
  block: Uint8Array;
  lane: Uint8Array;
  district: Uint8Array;
  /** Gang id index + 1 per tile, 0 for no turf. */
  turf: Uint8Array;
  buildings: Building[];
  blocks: Block[];
  props: Prop[];
  propsByChunk: Map<number, Prop[]>;
  roadsX: number[];
  roadsY: number[];
  parking: ParkingSpot[];
  payphones: Prop[];
  spawn: { x: number; y: number };
}

export const idx = (c: CityMap, x: number, y: number) => y * c.W + x;
export const inBounds = (c: CityMap, x: number, y: number) => x >= 0 && y >= 0 && x < c.W && y < c.H;

export function kindAt(c: CityMap, tx: number, ty: number): number {
  return inBounds(c, tx, ty) ? c.kind[ty * c.W + tx] : T.WATER;
}

export function blockAt(c: CityMap, tx: number, ty: number): number {
  return inBounds(c, tx, ty) ? c.block[ty * c.W + tx] : B.PED | B.CAR | B.SIGHT;
}

/** Is the world point (px) blocked for the given flag? */
export function blockedPx(c: CityMap, x: number, y: number, flag: number): boolean {
  return (blockAt(c, Math.floor(x / TILE), Math.floor(y / TILE)) & flag) !== 0;
}

export function districtAt(c: CityMap, tx: number, ty: number): District {
  return DISTRICTS[inBounds(c, tx, ty) ? c.district[ty * c.W + tx] : 6];
}

export function chunkKey(cx: number, cy: number) {
  return cy * 1000 + cx;
}

/** Line of sight between two world points, stepping through tiles. */
export function lineOfSight(c: CityMap, x0: number, y0: number, x1: number, y1: number, flag: number = B.SIGHT): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blockedPx(c, x0 + dx * t, y0 + dy * t, flag)) return false;
  }
  return true;
}

/** Walk along a ray and return the distance to the first blocked tile (or max). */
export function rayHit(c: CityMap, x0: number, y0: number, ang: number, max: number, flag: number): number {
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  for (let d = 2; d < max; d += 2) if (blockedPx(c, x0 + cx * d, y0 + cy * d, flag)) return d;
  return max;
}
