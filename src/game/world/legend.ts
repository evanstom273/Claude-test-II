/** Terrain characters used in ASCII maps, and what they do. */

export type Solidity = 'wall' | 'liquid' | 'gap' | null;

export const TERRAIN: Record<string, { solid: Solidity; name: string }> = {
  '.': { solid: null, name: 'ground' },
  ',': { solid: null, name: 'ground-detail' },
  '"': { solid: null, name: 'tall-grass' },
  ':': { solid: null, name: 'path' },
  ';': { solid: null, name: 'sand' },
  _: { solid: null, name: 'floor' },
  '=': { solid: null, name: 'bridge-h' },
  H: { solid: null, name: 'bridge-v' },
  Y: { solid: null, name: 'rails' },
  V: { solid: null, name: 'crops' },
  M: { solid: null, name: 'mushrooms' },
  Z: { solid: null, name: 'crack' },
  '#': { solid: 'wall', name: 'wall' },
  T: { solid: 'wall', name: 'tree' },
  '^': { solid: 'wall', name: 'rock' },
  R: { solid: 'wall', name: 'roof' },
  W: { solid: 'wall', name: 'house-wall' },
  D: { solid: 'wall', name: 'door' },
  F: { solid: 'wall', name: 'fence' },
  C: { solid: 'wall', name: 'crystal' },
  P: { solid: 'wall', name: 'pillar' },
  B: { solid: 'wall', name: 'barrel' },
  L: { solid: 'wall', name: 'lamp' },
  G: { solid: 'wall', name: 'grave' },
  O: { solid: 'wall', name: 'well' },
  Q: { solid: 'wall', name: 'statue' },
  K: { solid: 'wall', name: 'stall' },
  U: { solid: 'wall', name: 'bush' },
  N: { solid: 'wall', name: 'seal' },
  '~': { solid: 'liquid', name: 'water' },
  X: { solid: 'gap', name: 'chasm' },
};

/** Lower-case letters place enemies. Maps can remap them to variants. */
export const ENEMY_CHARS: Record<string, string> = {
  s: 'slime',
  w: 'wolf',
  b: 'bat',
  t: 'thornling',
  k: 'skeleton',
  c: 'crawler',
  g: 'wisp',
  h: 'shade',
  r: 'crab',
  d: 'drowned',
};

export function isTerrain(ch: string): boolean {
  return ch in TERRAIN;
}

export function isWalkableTerrain(ch: string): boolean {
  return ch in TERRAIN && TERRAIN[ch].solid === null;
}
