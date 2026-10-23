import { generateCity } from './gen';
import type { CityMap } from './tiles';

const cache = new Map<number, CityMap>();

/** The city for a seed, generated once and reused (the title screen and the game share it). */
export function getCity(seed: number): CityMap {
  let c = cache.get(seed);
  if (!c) {
    c = generateCity(seed);
    cache.set(seed, c);
  }
  return c;
}
