export type Behavior = 'hopper' | 'flyer' | 'charger' | 'turret' | 'thrower' | 'phaser' | 'brute' | 'blinker' | 'skitter';

export interface EnemyDef {
  kind: string;
  name: string;
  /** Animation key prefix (`${anim}_move`). */
  anim: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: [number, number];
  speed: number;
  behavior: Behavior;
  aggro: number;
  /** Flies over water and gaps. */
  flying?: boolean;
  /** Drifts through walls. */
  ghost?: boolean;
  /** 0 = full knockback, 1 = immovable. */
  poise?: number;
  /** Projectile frame for ranged attackers. */
  shot?: string;
  shotAtk?: number;
  /** Does the sprite face left/right only (true) or never flip (false)? */
  flips?: boolean;
}

const list: EnemyDef[] = [
  { kind: 'slime', name: 'Slime', anim: 'slime', hp: 12, atk: 5, def: 0, xp: 4, gold: [1, 3], speed: 90, behavior: 'hopper', aggro: 100 },
  { kind: 'cave_slime', name: 'Cave Slime', anim: 'cave_slime', hp: 28, atk: 10, def: 2, xp: 9, gold: [2, 5], speed: 100, behavior: 'hopper', aggro: 110 },
  { kind: 'bog_slime', name: 'Bog Slime', anim: 'bog_slime', hp: 42, atk: 14, def: 3, xp: 15, gold: [3, 7], speed: 100, behavior: 'hopper', aggro: 110 },
  { kind: 'bat', name: 'Bat', anim: 'bat', hp: 9, atk: 5, def: 0, xp: 5, gold: [1, 2], speed: 70, behavior: 'flyer', aggro: 110, flying: true, flips: false },
  { kind: 'cave_bat', name: 'Cave Bat', anim: 'cave_bat', hp: 20, atk: 9, def: 1, xp: 9, gold: [1, 4], speed: 80, behavior: 'flyer', aggro: 120, flying: true, flips: false },
  { kind: 'wolf', name: 'Wolf', anim: 'wolf', hp: 24, atk: 8, def: 1, xp: 12, gold: [2, 5], speed: 55, behavior: 'charger', aggro: 120, flips: true },
  { kind: 'gloam_wolf', name: 'Gloam Wolf', anim: 'gloam_wolf', hp: 64, atk: 21, def: 6, xp: 40, gold: [6, 12], speed: 65, behavior: 'charger', aggro: 140, flips: true },
  { kind: 'thornling', name: 'Thornling', anim: 'thornling', hp: 18, atk: 6, def: 1, xp: 8, gold: [1, 4], speed: 0, behavior: 'turret', aggro: 120, poise: 1, shot: 'thorn', shotAtk: 6, flips: false },
  { kind: 'skeleton', name: 'Skeleton', anim: 'skeleton', hp: 36, atk: 11, def: 3, xp: 18, gold: [4, 9], speed: 38, behavior: 'thrower', aggro: 130, shot: 'bone', shotAtk: 10, flips: true },
  { kind: 'crawler', name: 'Crawler', anim: 'crawler', hp: 30, atk: 10, def: 5, xp: 16, gold: [3, 7], speed: 48, behavior: 'charger', aggro: 110, poise: 0.4, flips: false },
  { kind: 'wisp', name: 'Drowned Wisp', anim: 'wisp', hp: 32, atk: 13, def: 2, xp: 20, gold: [3, 8], speed: 30, behavior: 'phaser', aggro: 130, flying: true, ghost: true, shot: 'orb_tide', shotAtk: 12, flips: false },
  { kind: 'drowned', name: 'Drowned', anim: 'drowned', hp: 56, atk: 15, def: 4, xp: 24, gold: [5, 10], speed: 28, behavior: 'brute', aggro: 120, poise: 0.5, flips: true },
  { kind: 'crab', name: 'Saltcrab', anim: 'crab', hp: 30, atk: 12, def: 6, xp: 16, gold: [3, 8], speed: 60, behavior: 'skitter', aggro: 110, poise: 0.3, flips: false },
  { kind: 'shade', name: 'Shade', anim: 'shade', hp: 62, atk: 19, def: 5, xp: 38, gold: [8, 15], speed: 40, behavior: 'blinker', aggro: 150, flying: true, flips: true },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(list.map((e) => [e.kind, e]));

export interface BossDef {
  id: string;
  name: string;
  title: string;
  anim: string;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  music: string;
  ember?: string;
}

export const BOSSES: Record<string, BossDef> = {
  thornmother: { id: 'thornmother', name: 'The Thornmother', title: 'Root of the Gloam-thorn', anim: 'thornmother', hp: 260, atk: 12, def: 3, xp: 80, gold: 60, music: 'boss', ember: 'verdant_ember' },
  colossus: { id: 'colossus', name: 'The Rustbound Colossus', title: 'Warden of the Great Vein', anim: 'colossus', hp: 480, atk: 20, def: 6, xp: 200, gold: 150, music: 'boss', ember: 'stone_ember' },
  abbess: { id: 'abbess', name: 'The Drowned Abbess', title: 'She Who Sings Beneath', anim: 'abbess', hp: 560, atk: 18, def: 6, xp: 350, gold: 250, music: 'boss', ember: 'tide_ember' },
  hollow_king: { id: 'hollow_king', name: 'The Hollow King', title: 'Crown of the Gloam', anim: 'hollow_king', hp: 1000, atk: 26, def: 8, xp: 0, gold: 0, music: 'boss' },
};
