import { HERO_PALETTE, heroFrame } from './hero';
import { humanFrame, withAccessory, PAL, ROBE, BEARD, APRON, STRAW_HAT, WIDE_HAT, HOOD, HELMET, CAP, BUN, type Accessory, type Dir, type Pose } from './humanoid';
import { SLIME, BAT, WOLF, THORNLING, SKELETON, CRAWLER, WISP, SHADE, CRAB, THORNMOTHER, COLOSSUS, ABBESS, HOLLOW_KING, MONSTER_PALETTES } from './monsters';
import * as O from './objects';
import type { Palette } from './pixels';

export interface FrameDef {
  key: string;
  rows: string[];
  palette: Palette;
}

export interface AnimDef {
  key: string;
  frames: string[];
  fps: number;
  repeat?: number;
}

const frames: FrameDef[] = [];
const anims: AnimDef[] = [];

function add(key: string, rows: string[], palette: Palette = {}) {
  frames.push({ key, rows, palette });
}

// ---- Humanoids -----------------------------------------------------------------

export const CHARACTERS: Record<string, { palette: Palette; acc: Accessory[] }> = {
  maren: { palette: PAL.maren, acc: [BUN, ROBE] },
  bram: { palette: PAL.bram, acc: [BEARD, APRON] },
  ivo: { palette: PAL.ivo, acc: [WIDE_HAT] },
  tamsin: { palette: PAL.tamsin, acc: [HOOD, ROBE] },
  wendell: { palette: PAL.wendell, acc: [STRAW_HAT] },
  pip: { palette: PAL.pip, acc: [CAP] },
  holt: { palette: PAL.holt, acc: [HELMET] },
  edda: { palette: PAL.edda, acc: [BUN] },
  ferrin: { palette: PAL.ferrin, acc: [BEARD, CAP] },
  drowned: { palette: PAL.drowned, acc: [] },
};

const DIRS: Dir[] = ['down', 'up', 'side'];
const POSES: Pose[] = ['idle', 'a', 'b'];

function addWalker(id: string, frame: (dir: Dir, pose: Pose) => string[], palette: Palette) {
  for (const dir of DIRS) {
    for (const pose of POSES) add(`${id}_${dir}_${pose}`, frame(dir, pose), palette);
    anims.push({ key: `${id}_walk_${dir}`, frames: [`${id}_${dir}_a`, `${id}_${dir}_idle`, `${id}_${dir}_b`, `${id}_${dir}_idle`], fps: 9 });
    anims.push({ key: `${id}_idle_${dir}`, frames: [`${id}_${dir}_idle`], fps: 1 });
  }
}

for (const [id, ch] of Object.entries(CHARACTERS)) {
  addWalker(id, (dir, pose) => ch.acc.reduce((rows, acc) => withAccessory(rows, acc, dir), humanFrame(dir, pose)), ch.palette);
}

// The player is drawn at 32x32 from shapes and lighting rules (see hero.ts) and shown at half scale.
addWalker('player', heroFrame, HERO_PALETTE);

// ---- Monsters --------------------------------------------------------------------

const MONSTER_ART: Record<string, string[][]> = {
  slime: SLIME,
  cave_slime: SLIME,
  bog_slime: SLIME,
  bat: BAT,
  cave_bat: BAT,
  wolf: WOLF,
  gloam_wolf: WOLF,
  thornling: THORNLING,
  skeleton: SKELETON,
  crawler: CRAWLER,
  wisp: WISP,
  shade: SHADE,
  crab: CRAB,
  thornmother: THORNMOTHER,
  colossus: COLOSSUS,
  abbess: ABBESS,
  hollow_king: HOLLOW_KING,
};

for (const [kind, art] of Object.entries(MONSTER_ART)) {
  const pal = (MONSTER_PALETTES as Record<string, Palette>)[kind] ?? {};
  art.forEach((rows, i) => add(`${kind}_${i}`, rows, pal));
  anims.push({ key: `${kind}_move`, frames: art.map((_, i) => `${kind}_${i}`), fps: kind === 'bat' || kind === 'cave_bat' ? 8 : 4 });
}

// Drowned are humanoids, but animate like monsters too.
anims.push({ key: 'drowned_move', frames: ['drowned_down_a', 'drowned_down_idle', 'drowned_down_b', 'drowned_down_idle'], fps: 4 });

// ---- Objects ---------------------------------------------------------------------

add('chest_closed', O.CHEST_CLOSED);
add('chest_open', O.CHEST_OPEN);
add('bramble', O.BRAMBLE);
add('gate', O.GATE);
add('sign', O.SIGN);
add('brazier', O.BRAZIER);
add('glowcap', O.GLOWCAP);
O.CAT.forEach((rows, i) => add(`cat_${i}`, rows));
anims.push({ key: 'cat_idle', frames: ['cat_0', 'cat_1'], fps: 2 });
for (const [k, pal] of Object.entries(O.GEM_PALETTES)) add(`gem_${k}`, O.GEM, pal);
O.COIN.forEach((rows, i) => add(`coin_${i}`, rows));
anims.push({ key: 'coin_spin', frames: ['coin_0', 'coin_1'], fps: 6 });
add('heart', O.HEART);
add('mana', O.MANA);
add('thorn', O.THORN);
add('bone', O.BONE);
for (const [k, pal] of Object.entries(O.ORB_PALETTES)) add(`orb_${k}`, O.ORB, pal);
add('bubble', O.BUBBLE);

// ---- Icons -----------------------------------------------------------------------

const SWORDS: Record<string, Palette> = {
  rusty: { m: '#a87a5a', M: '#7a5038', w: '#d0a888' },
  iron: {},
  thorn: { m: '#8a6a3a', M: '#5a4224', w: '#b0e070', g: '#5fae4a', G: '#3a7a35' },
  steel: { m: '#dde6ee', M: '#9aa8b8', w: '#ffffff', g: '#8892a0', G: '#5c5c6b' },
  ember: { m: '#f2a33a', M: '#c0602a', w: '#fff3b0', g: '#d64545', G: '#8f2b3a' },
};
for (const [k, pal] of Object.entries(SWORDS)) add(`icon_sword_${k}`, O.ICON_SWORD, pal);

add('icon_armor_tunic', O.ICON_SHIRT, { c: '#c8b090', C: '#9a8466', g: '#7a6a50' });
add('icon_armor_leather', O.ICON_SHIRT, { c: '#8a5a3b', C: '#5f3b26', g: '#f2c14e' });
add('icon_armor_chain', O.ICON_SHIRT, { c: '#a8b0b8', C: '#6f7880', g: '#d0d8e0' });
add('icon_armor_tide', O.ICON_PLATE, { m: '#5fd0c4', M: '#2e8a80', g: '#eaffff' });
add('icon_armor_plate', O.ICON_PLATE, { g: '#a070e0' });

add('icon_charm_feather', O.ICON_FEATHER);
add('icon_charm_coin', O.ICON_COIN);
add('icon_charm_glimmer', O.ICON_LANTERN);
add('icon_charm_vigor', O.ICON_PENDANT);
add('icon_charm_sage', O.ICON_PENDANT, { r: '#5fd0c4', R: '#2e8a80', f: '#eaffff' });
add('icon_charm_tide', O.ICON_PEARL);

add('icon_potion_red', O.ICON_POTION);
add('icon_potion_big', O.ICON_FLASK);
add('icon_potion_blue', O.ICON_POTION, { r: '#4a7bd0', R: '#2c4f94', f: '#d8f0ff' });
add('icon_potion_gold', O.ICON_POTION, { r: '#f2c14e', R: '#b8862b', f: '#fff3b0' });

add('icon_glowcap', O.GLOWCAP);
add('icon_starsilver', O.ICON_ORE);
add('icon_ring', O.ICON_RING);
add('icon_key_moss', O.ICON_KEY, { g: '#8ac060', G: '#4f7a35' });
add('icon_key_rust', O.ICON_KEY, { g: '#c08050', G: '#7a4a2a' });
add('icon_key_sea', O.ICON_KEY, { g: '#7fc8c0', G: '#3a7a74' });
add('icon_ember_green', O.GEM, O.GEM_PALETTES.verdant);
add('icon_ember_stone', O.GEM, O.GEM_PALETTES.stone);
add('icon_ember_blue', O.GEM, O.GEM_PALETTES.tide);

add('icon_bolt', O.ICON_BOLT);
add('icon_dash', O.ICON_DASH);
add('icon_radiance', O.ICON_RADIANCE);

export const FRAMES: FrameDef[] = frames;
export const ANIMS: AnimDef[] = anims;
export const FRAME_MAP: Record<string, FrameDef> = Object.fromEntries(frames.map((f) => [f.key, f]));

