import type { GameData } from './types';

/** The city is the same for everyone: one seed, one Grimsport. */
export const CITY_SEED = 20261023;

export function newGameData(): GameData {
  return {
    version: 1,
    seed: CITY_SEED,
    cash: 60,
    health: 100,
    maxHealth: 100,
    weapons: {},
    current: 'fists',
    items: { burger: 1 },
    outfit: 0,
    outfits: [0],
    respect: { vipers: 0, crowns: 0, rats: 0 },
    clock: 21 * 60,
    day: 1,
    job: null,
    stats: { playtimeMs: 0, jobsDone: 0, kills: 0, carsStolen: 0, cashEarned: 0, wasted: 0, busted: 0, maxWanted: 0 },
    pos: null,
  };
}

/** Fill in anything an older save is missing. */
export function migrateSave(d: GameData): GameData {
  const base = newGameData();
  return { ...base, ...d, stats: { ...base.stats, ...d.stats }, respect: { ...base.respect, ...d.respect } };
}
