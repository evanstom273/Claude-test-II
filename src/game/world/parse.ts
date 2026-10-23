import type { MapDef, MarkerDef } from '../../data/maps/types';
import { ENEMY_CHARS, isTerrain, isWalkableTerrain, TERRAIN } from './legend';

export interface TilePos {
  x: number;
  y: number;
}

export interface PlacedMarker {
  ch: string;
  def: MarkerDef;
  x: number;
  y: number;
}

export interface ParsedMap {
  def: MapDef;
  w: number;
  h: number;
  /** Resolved terrain character for every tile, row-major. */
  terrain: string[];
  spawns: Record<string, TilePos>;
  /** Multi-tile markers (exits, arenas, seals, shrines) grouped by character. */
  regions: Record<string, { def: MarkerDef; tiles: TilePos[] }>;
  /** Single-tile markers (NPCs, chests, signs...). */
  objects: PlacedMarker[];
  brambles: TilePos[];
  enemies: { kind: string; x: number; y: number }[];
}

const REGION_TYPES = new Set(['exit', 'arena', 'seal', 'shrine']);

export function parseMap(def: MapDef): ParsedMap {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const raw = def.rows.map((r) => [...r]);
  for (const [i, r] of raw.entries()) {
    if (r.length !== w) throw new Error(`${def.id}: row ${i} has width ${r.length}, expected ${w}`);
  }

  const terrain: string[] = new Array(w * h).fill('.');
  const spawns: Record<string, TilePos> = {};
  const regions: ParsedMap['regions'] = {};
  const objects: PlacedMarker[] = [];
  const brambles: TilePos[] = [];
  const enemies: ParsedMap['enemies'] = [];
  const needsUnder: TilePos[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = raw[y][x];
      if (isTerrain(ch)) {
        terrain[y * w + x] = ch;
        continue;
      }
      needsUnder.push({ x, y });
      if (ch === '%') {
        brambles.push({ x, y });
        continue;
      }
      if (ch in ENEMY_CHARS) {
        enemies.push({ kind: def.enemyVariants?.[ch] ?? ENEMY_CHARS[ch], x, y });
        continue;
      }
      const m = def.markers[ch];
      if (!m) throw new Error(`${def.id}: unknown map character '${ch}' at ${x},${y}`);
      if (m.type === 'spawn') spawns[m.name] = { x, y };
      else if (REGION_TYPES.has(m.type)) {
        (regions[ch] ??= { def: m, tiles: [] }).tiles.push({ x, y });
      } else objects.push({ ch, def: m, x, y });
    }
  }

  // Markers sit on top of whatever walkable ground surrounds them.
  for (const { x, y } of needsUnder) {
    let under = '.';
    const near = [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    for (const [dx, dy] of near) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const c = raw[ny][nx];
      if (isWalkableTerrain(c)) {
        under = c === '"' || c === 'M' || c === 'V' || c === 'Z' ? '.' : c;
        break;
      }
    }
    terrain[y * w + x] = under;
  }

  for (const [ch, m] of Object.entries(def.markers)) {
    if (m.type === 'spawn' && !spawns[m.name]) throw new Error(`${def.id}: spawn marker '${ch}' (${m.name}) not placed`);
  }

  return { def, w, h, terrain, spawns, regions, objects, brambles, enemies };
}

export function tileAt(map: ParsedMap, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return '#';
  return map.terrain[y * map.w + x];
}

export function solidAt(map: ParsedMap, x: number, y: number) {
  return TERRAIN[tileAt(map, x, y)]?.solid ?? 'wall';
}
