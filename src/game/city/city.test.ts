import { describe, expect, it } from 'vitest';
import { generateCity } from './gen';
import { B, LANE, T, TILE, type CityMap } from './tiles';
import { roadPath } from '../systems/route';
import { CITY_SEED } from '../../state/newGame';

const city = generateCity(CITY_SEED);

/** Every tile a person can walk to from (sx, sy). */
function walkable(c: CityMap, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(c.W * c.H);
  const stack = [sy * c.W + sx];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % c.W;
    const y = (i - x) / c.W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= c.W || ny >= c.H) continue;
      const n = ny * c.W + nx;
      if (seen[n] || c.block[n] & B.PED || c.kind[n] === T.WATER) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

describe('city generation', () => {
  it('is the same city every time for the same seed', () => {
    const again = generateCity(CITY_SEED);
    expect(again.buildings.length).toBe(city.buildings.length);
    expect(again.props.length).toBe(city.props.length);
    expect(again.kind.every((k, i) => k === city.kind[i])).toBe(true);
    expect(again.block.every((k, i) => k === city.block[i])).toBe(true);
  });

  it('has every kind of place the game needs', () => {
    const kinds = new Set(city.buildings.map((b) => b.kind));
    for (const k of ['safehouse', 'shop_guns', 'shop_food', 'shop_clothes', 'chippy', 'bar', 'hospital', 'police', 'garage', 'respray', 'gang_hq'] as const) expect(kinds, k).toContain(k);
    expect(city.buildings.filter((b) => b.kind === 'gang_hq').map((b) => b.gang).sort()).toEqual(['crowns', 'rats', 'vipers']);
    expect(city.payphones.length).toBeGreaterThan(10);
    expect(city.parking.length).toBeGreaterThan(10);
  });

  it('lets you walk from the spawn point to every front door and on to the counter', () => {
    const sx = Math.floor(city.spawn.x / TILE);
    const sy = Math.floor(city.spawn.y / TILE);
    expect(city.block[sy * city.W + sx] & B.PED).toBe(0);
    const reach = walkable(city, sx, sy);
    const stuck: string[] = [];
    for (const b of city.buildings) {
      if (!reach[b.door.y * city.W + b.door.x]) stuck.push(`${b.name} door`);
      if (b.post && !reach[b.post.y * city.W + b.post.x]) stuck.push(`${b.name} counter`);
    }
    expect(stuck).toEqual([]);
  });

  it('has lanes that always lead somewhere', () => {
    const DX = { [LANE.E]: 1, [LANE.W]: -1, [LANE.S]: 0, [LANE.N]: 0 };
    const DY = { [LANE.E]: 0, [LANE.W]: 0, [LANE.S]: 1, [LANE.N]: -1 };
    const dead: string[] = [];
    for (let y = 0; y < city.H; y++)
      for (let x = 0; x < city.W; x++) {
        const l = city.lane[y * city.W + x];
        if (!l || l & LANE.JUNCTION) continue;
        for (const f of [LANE.E, LANE.W, LANE.S, LANE.N]) {
          if (!(l & f)) continue;
          const nx = x + DX[f];
          const ny = y + DY[f];
          const next = nx >= 0 && ny >= 0 && nx < city.W && ny < city.H ? city.lane[ny * city.W + nx] : 0;
          if (!(next & f) && !(next & LANE.JUNCTION)) dead.push(`${x},${y}`);
        }
      }
    // A lane may end at the edge of the map (the coast road loops round), but not in the middle of town.
    expect(dead.length).toBeLessThan(8);
  });

  it('finds a driving route between far-apart roads', () => {
    const roads: number[] = [];
    for (let i = 0; i < city.W * city.H; i++) if (city.kind[i] === T.ROAD && !(city.block[i] & B.CAR)) roads.push(i);
    const a = roads[0];
    const b = roads[roads.length - 1];
    const path = roadPath(city, (a % city.W) * TILE + 8, Math.floor(a / city.W) * TILE + 8, (b % city.W) * TILE + 8, Math.floor(b / city.W) * TILE + 8);
    expect(path).not.toBeNull();
    const end = path![path!.length - 1];
    expect(Math.floor(end.x / TILE) + Math.floor(end.y / TILE) * city.W).toBe(b);
    for (const p of path!) expect(city.block[Math.floor(p.y / TILE) * city.W + Math.floor(p.x / TILE)] & B.CAR).toBe(0);
  });
});
