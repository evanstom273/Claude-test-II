import { layer, type Palette } from './pixels';

/*
 * The humanoid template used by the player, villagers and some monsters.
 * Frames are 16x16. Side frames face right; left is mirrored at draw time.
 */

const HEAD_DOWN = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khsssssshk...',
  '...ksessssesk...',
  '...kssssssssk...',
  '....kSssssSk....',
];

const HEAD_UP = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khHhhhhHhk...',
  '...kHHhhhhHHk...',
  '....kSHHHHSk....',
];

const HEAD_SIDE = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhhk..',
  '...khhhhsssssk..',
  '...khhhssssesk..',
  '...kHhhssssssk..',
  '....kHSssssk....',
];

const BODY_DOWN = [
  '...kcccccccck...',
  '...kCccccccCk...',
  '...kCccccccCk...',
  '...ksllglllsk...',
];

const BODY_UP = [
  '...kcccccccck...',
  '...kCccccccCk...',
  '...kCccccccCk...',
  '...ksllllllsk...',
];

const BODY_SIDE = [
  '....kcccccck....',
  '....kccCccck....',
  '....kccCccck....',
  '....kllslllk....',
];

const LEGS_DOWN = {
  idle: ['....kppppppk....', '....kbbkkbbk....', '.....kk..kk.....'],
  a: ['....kppppppk....', '...kbbk.kbbk....', '....kk...kk.....'],
  b: ['....kppppppk....', '....kbbk.kbbk...', '.....kk...kk....'],
};

const LEGS_SIDE = {
  idle: ['.....kppppk.....', '.....kbbbbbk....', '.....kkkkkk.....'],
  a: ['....kppppppk....', '...kbbk..kbbk...', '...kkk....kkk...'],
  b: ['.....kpppk......', '.....kbbbbk.....', '.....kkkkk......'],
};

function fix(rows: string[]): string[] {
  // Normalise every row to exactly 16 characters.
  return rows.map((r) => (r.length >= 16 ? r.slice(0, 16) : r + '.'.repeat(16 - r.length)));
}

export type Dir = 'down' | 'up' | 'side';
export type Pose = 'idle' | 'a' | 'b';

export function humanFrame(dir: Dir, pose: Pose): string[] {
  const head = dir === 'down' ? HEAD_DOWN : dir === 'up' ? HEAD_UP : HEAD_SIDE;
  const body = dir === 'down' ? BODY_DOWN : dir === 'up' ? BODY_UP : BODY_SIDE;
  const legs = dir === 'side' ? LEGS_SIDE[pose] : LEGS_DOWN[pose];
  return fix([...head, ...body, ...legs]);
}

/** Accessories drawn over the template, per direction. */
export interface Accessory {
  down?: string[];
  up?: string[];
  side?: string[];
}

export function withAccessory(rows: string[], acc: Accessory | undefined, dir: Dir): string[] {
  const top = acc?.[dir];
  return top ? layer(rows, fix(top)) : rows;
}

// ---- Accessories ------------------------------------------------------------

/** Long robe covering the legs. */
const ROBE_LEGS = ['', '', '', '', '', '', '', '', '', '', '', '', '', '...kcccccccck...', '...kCccccccCk...', '....kkkkkkkk....'];
export const ROBE: Accessory = { down: ROBE_LEGS, up: ROBE_LEGS, side: ['', '', '', '', '', '', '', '', '', '', '', '', '', '....kcccccck....', '....kCccccCk....', '....kkkkkkkk....'] };

export const BEARD: Accessory = {
  down: ['', '', '', '', '', '', '', '....hhhhhhhh....', '.....hhhhhh.....', '......khhk......'],
  side: ['', '', '', '', '', '', '', '........hhhhh...', '.......hhhhk....', '........hhk.....'],
};

export const APRON: Accessory = {
  down: ['', '', '', '', '', '', '', '', '', '.....llllll.....', '.....llllll.....', '.....llllll.....', '.....llllll.....', '.....llllll.....'],
  side: ['', '', '', '', '', '', '', '', '', '.........ll.....', '.........ll.....', '.........ll.....', '.........ll.....', '.........ll.....'],
};

export const STRAW_HAT: Accessory = {
  down: ['......kkkk......', '....kyyyyyyk....', '..kkyyyyyyyykk..', '.kyyGGGGGGGGyyk.', '..kkkkkkkkkkkk..'],
  up: ['......kkkk......', '....kyyyyyyk....', '..kkyyyyyyyykk..', '.kyyGGGGGGGGyyk.', '..kkkkkkkkkkkk..'],
  side: ['......kkkk......', '....kyyyyyyk....', '..kkyyyyyyyykk..', '.kyyGGGGGGGGyyk.', '..kkkkkkkkkkkk..'],
};

export const WIDE_HAT: Accessory = {
  down: ['......kkkk......', '.....kVVVVk.....', '....kVvvvvVk....', '..kkVVVVVVVVkk..', '.kVVVVVVVVVVVVk.', '..kkkkkkkkkkkk..'],
  up: ['......kkkk......', '.....kVVVVk.....', '....kVvvvvVk....', '..kkVVVVVVVVkk..', '.kVVVVVVVVVVVVk.', '..kkkkkkkkkkkk..'],
  side: ['......kkkk......', '.....kVVVVk.....', '....kVvvvvVk....', '..kkVVVVVVVVkk..', '.kVVVVVVVVVVVVk.', '..kkkkkkkkkkkk..'],
};

export const HOOD: Accessory = {
  down: ['.....kkkkkk.....', '....kccccccK....', '...kccccccccK...', '...kcCCCCCCck...', '...kcC....Cck...', '...kc......ck...', '...kc......ck...', '...kC......Ck...'],
  up: ['.....kkkkkk.....', '....kccccccK....', '...kccccccccK...', '...kcccccccck...', '...kcccccccck...', '...kcccccccck...', '...kCccccccCk...', '...kCCccccCCk...'],
  side: ['.....kkkkkk.....', '....kccccccK....', '...kccccccccK...', '...kccccCCCCck..', '...kcccC.....k..', '...kccC.......k.', '...kccC......k..', '...kCcC.....k...'],
};

export const HELMET: Accessory = {
  down: ['.....kkkkkk.....', '....kmmmmmmk....', '...kmmmmmmmmk...', '...kMMMMMMMMk...', '...kMk....kMk...'],
  up: ['.....kkkkkk.....', '....kmmmmmmk....', '...kmmmmmmmmk...', '...kMMMMMMMMk...', '...kMMMMMMMMk...', '...kMMMMMMMMk...'],
  side: ['.....kkkkkk.....', '....kmmmmmmk....', '...kmmmmmmmmk...', '...kMMMMMMMMMk..', '...kMMMk.........'],
};

export const CAP: Accessory = {
  down: ['................', '.....kkkkkk.....', '....knnnnnnk....', '...knnnnnnnnk...', '...kNNNNNNNNk...', '...kkkkkkkkkk...'],
  up: ['................', '.....kkkkkk.....', '....knnnnnnk....', '...knnnnnnnnk...', '...kNNNNNNNNk...', '...kNNNNNNNNk...'],
  side: ['................', '.....kkkkkk.....', '....knnnnnnk....', '...knnnnnnnnk...', '...kNNNNNNNNkkk.', '...kkkkkkkkkkkk.'],
};

export const BUN: Accessory = {
  down: ['.....kkkkkk.....', '....khhhhhhk....'],
  up: ['......kkkk......', '.....khhhhk.....', '....kkhHHhkk....'],
  side: ['', '', '.kkk............', 'khhhk...........', 'khHhk...........', '.kkk............'],
};

// ---- Palettes ---------------------------------------------------------------

export const PAL = {
  player: { c: '#b8433b', C: '#842c2a', h: '#7a4a2a', H: '#55321c' },
  maren: { c: '#3d5a8a', C: '#2a3f66', h: '#d8d4cc', H: '#a8a39a', s: '#e8b48f', S: '#c48a68' },
  bram: { c: '#5b6b7a', C: '#404d59', h: '#2a2024', H: '#1a1418', s: '#b07a52', S: '#8a5a3a' },
  ivo: { c: '#4f8a4a', C: '#356634', h: '#c78a3a', H: '#9a6828' },
  tamsin: { c: '#7a4f8a', C: '#563766', h: '#ece8e0', H: '#c0bab0', s: '#efc0a0', S: '#c99a7a' },
  wendell: { c: '#4a6fb0', C: '#33508a', h: '#a86a38', H: '#7a4a24', s: '#e8a87c', S: '#c08060' },
  pip: { c: '#e0a53a', C: '#b07e22', h: '#e0c060', H: '#b09030' },
  holt: { c: '#8892a0', C: '#5f6875', h: '#5a3a2a', H: '#3d2618', p: '#4a4a5a', P: '#30303c' },
  edda: { c: '#b06a8a', C: '#844c66', h: '#3a2a2a', H: '#241818' },
  ferrin: { c: '#3a7a80', C: '#285a5e', h: '#e0e0d8', H: '#b0b0a8', s: '#d8a07a', S: '#b07c5c' },
  drowned: {
    s: '#7fa08a', S: '#5a7a66', e: '#c8ffd8', h: '#2f4a3a', H: '#1e3328', c: '#3a4a52', C: '#28343a', l: '#3a3a30', p: '#2a3438', P: '#1c2428', b: '#2a2a28', B: '#1a1a18',
  },
} satisfies Record<string, Palette>;
