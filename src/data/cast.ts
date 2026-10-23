import type { Colours, Hair, Hat, Style, Top } from '../game/art/people';
import { rng } from '../game/art/pixels';

/*
 * Who lives in the city. Civilians are rolled from a fixed seed so the same
 * faces turn up every game; factions have their own uniforms.
 */

export type Faction = 'civ' | 'cop' | 'vipers' | 'crowns' | 'rats' | 'shop' | 'player';
export type GangId = 'vipers' | 'crowns' | 'rats';
export const GANGS: GangId[] = ['vipers', 'crowns', 'rats'];

export interface Look {
  id: string;
  faction: Faction;
  style: Style;
  colours: Colours;
}

export const SKIN = ['#f6d3b5', '#ecb991', '#d49c74', '#b57a52', '#8e5b3c', '#6a422c'];
const HAIR = ['#2a1d18', '#2a1d18', '#4a2e1e', '#7a4a2a', '#b07a3a', '#d9b26a', '#e3d6b8', '#8a8a92', '#b8492f', '#3d4a8a', '#c25a8a'];
const CLOTHES = ['#c23b3b', '#3a6ab0', '#3f8f6a', '#d9a03a', '#7a4ab0', '#2d2d38', '#e8e4dc', '#8a8a96', '#b05a2a', '#2a7a8a', '#d26a9a', '#5a6a3a', '#9a2a4a', '#4a4a6a'];
const LEGS = ['#3a4a6a', '#2d2d38', '#5a4a3a', '#6a6a72', '#3a3a4a', '#8a7a5a', '#2a3a5a'];
const SHOES = ['#2a2020', '#4a2e1e', '#e8e4dc', '#3a3a4a', '#8a3a2a'];

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}
function weighted<T extends string>(r: () => number, table: Record<T, number>): T {
  const total = Object.values<number>(table).reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (const [k, w] of Object.entries<number>(table)) {
    x -= w;
    if (x <= 0) return k as T;
  }
  return Object.keys(table)[0] as T;
}

function civilian(i: number): Look {
  const r = rng(9001 + i * 7919);
  const hair = weighted<Hair>(r, { short: 36, long: 24, bald: 9, bun: 15, mohawk: 3 });
  const hat = weighted<Hat>(r, { none: 64, cap: 14, beanie: 13, fedora: 4, bandana: 0, police: 0 });
  const top = weighted<Top>(r, { tee: 32, jacket: 20, hoodie: 20, suit: 9, vest: 10, uniform: 0, apron: 0, hivis: 0 });
  const style: Style = { hair, hat, top, beard: r() < 0.18, shades: r() < 0.1 };
  const topColour = pick(r, CLOTHES);
  return {
    id: `civ${i}`,
    faction: 'civ',
    style,
    colours: {
      skin: pick(r, SKIN),
      hair: pick(r, HAIR),
      top: topColour,
      legs: pick(r, LEGS),
      shoes: pick(r, SHOES),
      accent: top === 'suit' ? pick(r, ['#c23b3b', '#3a6ab0', '#d9a03a', '#2d2d38']) : pick(r, CLOTHES.filter((c) => c !== topColour)),
      hat: pick(r, CLOTHES),
    },
  };
}

export const CIVILIANS: Look[] = Array.from({ length: 26 }, (_, i) => civilian(i));

function variants(base: Omit<Look, 'id' | 'colours' | 'style'> & { colours: Omit<Colours, 'skin' | 'hair'>; style: Omit<Style, 'hair' | 'beard'> }, prefix: string, hairs: Hair[], seed: number): Look[] {
  return hairs.map((hair, i) => {
    const r = rng(seed + i * 131);
    return {
      id: `${prefix}${i}`,
      faction: base.faction,
      style: { ...base.style, hair, beard: hair !== 'long' && hair !== 'bun' && r() < 0.3 },
      colours: { ...base.colours, skin: pick(r, SKIN), hair: pick(r, HAIR.slice(0, 8)) },
    };
  });
}

export const COPS = variants(
  { faction: 'cop', style: { hat: 'police', top: 'uniform' }, colours: { top: '#2f4a7a', legs: '#22283a', shoes: '#1e1e26', accent: '#f2c14e', hat: '#22325a', belt: '#2a2020' } },
  'cop',
  ['short', 'bun', 'bald', 'short'],
  5100,
);

export const GANG_LOOKS: Record<GangId, Look[]> = {
  vipers: variants(
    { faction: 'vipers', style: { hat: 'bandana', top: 'hoodie' }, colours: { top: '#2f7a3a', legs: '#2d2d38', shoes: '#e8e4dc', accent: '#7ad25a' } },
    'viper',
    ['short', 'long', 'mohawk', 'bun'],
    6100,
  ),
  crowns: variants(
    { faction: 'crowns', style: { hat: 'fedora', top: 'suit', shades: true }, colours: { top: '#5a2f7a', legs: '#3a2048', shoes: '#1e1e26', accent: '#e0b04a', hat: '#2d1e3a' } },
    'crown',
    ['short', 'bald', 'long', 'short'],
    6200,
  ),
  rats: variants(
    { faction: 'rats', style: { hat: 'beanie', top: 'hivis' }, colours: { top: '#5a5a66', legs: '#3a4a6a', shoes: '#4a2e1e', accent: '#f2b23a', hat: '#d2582a' } },
    'rat',
    ['short', 'bald', 'long', 'short'],
    6300,
  ),
};

export const SHOPKEEPERS = variants(
  { faction: 'shop', style: { hat: 'none', top: 'apron' }, colours: { top: '#e8e4dc', legs: '#3a3a4a', shoes: '#2a2020', accent: '#3a7a5a' } },
  'shop',
  ['short', 'bun', 'bald'],
  7100,
);

/** Outfits the player can wear; the first is the default. Bought at clothes shops. */
export const PLAYER_OUTFITS: Look[] = [
  { id: 'player0', faction: 'player', style: { hair: 'short', hat: 'none', top: 'jacket' }, colours: { skin: '#ecb991', hair: '#3a2418', top: '#2d2d38', legs: '#3a4a6a', shoes: '#2a2020', accent: '#c23b3b' } },
  { id: 'player1', faction: 'player', style: { hair: 'short', hat: 'cap', top: 'hoodie' }, colours: { skin: '#ecb991', hair: '#3a2418', top: '#c23b3b', legs: '#2d2d38', shoes: '#e8e4dc', accent: '#e8e4dc', hat: '#2d2d38' } },
  { id: 'player2', faction: 'player', style: { hair: 'short', hat: 'none', top: 'suit', shades: true }, colours: { skin: '#ecb991', hair: '#3a2418', top: '#2a2a34', legs: '#2a2a34', shoes: '#1e1e26', accent: '#c23b3b' } },
  { id: 'player3', faction: 'player', style: { hair: 'short', hat: 'beanie', top: 'tee' }, colours: { skin: '#ecb991', hair: '#3a2418', top: '#3a6ab0', legs: '#5a4a3a', shoes: '#4a2e1e', accent: '#e8e4dc', hat: '#d9a03a' } },
  { id: 'player4', faction: 'player', style: { hair: 'short', hat: 'fedora', top: 'jacket' }, colours: { skin: '#ecb991', hair: '#3a2418', top: '#8a6a4a', legs: '#3a3a4a', shoes: '#4a2e1e', accent: '#e8e4dc', hat: '#4a3a2a' } },
];

export const ALL_LOOKS: Look[] = [...CIVILIANS, ...COPS, ...GANG_LOOKS.vipers, ...GANG_LOOKS.crowns, ...GANG_LOOKS.rats, ...SHOPKEEPERS, ...PLAYER_OUTFITS];
