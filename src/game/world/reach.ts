import { TERRAIN } from './legend';
import { tileAt, type ParsedMap, type TilePos } from './parse';

export interface ReachOptions {
  bolt: boolean;
  dash: boolean;
  /** Key items already held. Keys found in reachable chests are added automatically. */
  keys?: string[];
}

export interface ReachResult {
  reachable: Set<string>;
  /** Ids of objects (chests, NPCs, signs...) that can be reached and interacted with. */
  objects: Set<string>;
  keys: Set<string>;
}

const key = (x: number, y: number) => `${x},${y}`;

function objectId(o: ParsedMap['objects'][number]): string {
  const d = o.def;
  switch (d.type) {
    case 'npc':
      return `npc:${d.id}`;
    case 'chest':
      return `chest:${d.id}`;
    case 'sign':
      return `sign:${d.id}`;
    case 'glowcap':
      return `glowcap:${d.id}`;
    case 'gate':
      return `gate:${d.id}`;
    case 'boss':
      return `boss:${d.boss}`;
    default:
      return d.type;
  }
}

/**
 * Flood-fill a map from a spawn point, respecting brambles, locked gates and
 * dashable gaps. Used by tests to prove each area is reachable when it should be.
 */
export function reach(map: ParsedMap, from: TilePos, opts: ReachOptions): ReachResult {
  const keys = new Set(opts.keys ?? []);
  const bramble = new Set(map.brambles.map((b) => key(b.x, b.y)));
  const solidObjects = new Map<string, ParsedMap['objects'][number]>();
  for (const o of map.objects) {
    if (o.def.type === 'chest' || o.def.type === 'npc' || o.def.type === 'sign' || o.def.type === 'gate' || o.def.type === 'hearth') {
      solidObjects.set(key(o.x, o.y), o);
    }
  }

  const walkable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    const k = key(x, y);
    if (bramble.has(k) && !opts.bolt) return false;
    const obj = solidObjects.get(k);
    if (obj) {
      if (obj.def.type === 'gate') return keys.has(obj.def.key);
      return false;
    }
    return TERRAIN[tileAt(map, x, y)]?.solid === null;
  };
  const isGap = (x: number, y: number) => tileAt(map, x, y) === 'X';

  const reachable = new Set<string>();
  const objects = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    const queue: TilePos[] = [from];
    reachable.add(key(from.x, from.y));
    const seen = new Set<string>([key(from.x, from.y)]);
    while (queue.length) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = key(nx, ny);
        const obj = solidObjects.get(nk);
        if (obj) {
          const id = objectId(obj);
          if (!objects.has(id)) {
            objects.add(id);
            if (obj.def.type === 'chest' && obj.def.item?.startsWith('key_') && !keys.has(obj.def.item)) {
              keys.add(obj.def.item);
              changed = true;
            }
          }
        }
        const targets: TilePos[] = [];
        if (walkable(nx, ny)) targets.push({ x: nx, y: ny });
        else if (opts.dash && isGap(nx, ny)) {
          // A dash clears up to two gap tiles in a straight line.
          for (let len = 1; len <= 2; len++) {
            const lx = x + dx * (len + 1);
            const ly = y + dy * (len + 1);
            const allGap = Array.from({ length: len }, (_, i) => isGap(x + dx * (i + 1), y + dy * (i + 1))).every(Boolean);
            if (allGap && walkable(lx, ly)) targets.push({ x: lx, y: ly });
          }
        }
        for (const t of targets) {
          const tk = key(t.x, t.y);
          if (seen.has(tk)) continue;
          seen.add(tk);
          reachable.add(tk);
          queue.push(t);
        }
      }
    }
    // Non-solid markers count as reached when standing on them.
    for (const o of map.objects) {
      if (!solidObjects.has(key(o.x, o.y)) && reachable.has(key(o.x, o.y))) objects.add(objectId(o));
    }
  }
  return { reachable, objects, keys };
}
