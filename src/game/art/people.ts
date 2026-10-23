import { mix, ramp } from './color';
import type { Palette } from './pixels';
import {
  above,
  below,
  capsule,
  cleanup,
  cylinder,
  ellipse,
  flat,
  intersect,
  mirror,
  outline,
  polyline,
  rrect,
  shift,
  sphere,
  superellipse,
  union,
  type Light,
  type Shape,
} from './shapes';

/*
 * Everyone in the city, drawn at 32x32 from shapes and lighting rules (the same
 * method as Hearthlight's hero, made parametric). A Style picks the shapes:
 * hair, hat and outfit. Colours are a separate palette, so one style can be
 * reused for any number of people. Shapes live on a 64-unit grid, two units per
 * pixel, so edges can sit on half pixels.
 */

export const PERSON_SIZE = 32;
const UNITS = 64 / PERSON_SIZE;
const CX = 32;

export type Dir = 'down' | 'up' | 'side';
export type Pose = 'idle' | 'a' | 'b';
export const DIRS: Dir[] = ['down', 'up', 'side'];
export const POSES: Pose[] = ['idle', 'a', 'b'];

export type Hair = 'short' | 'long' | 'bald' | 'bun' | 'mohawk';
export type Hat = 'none' | 'cap' | 'beanie' | 'police' | 'fedora' | 'bandana';
export type Top = 'tee' | 'jacket' | 'suit' | 'hoodie' | 'vest' | 'uniform' | 'apron' | 'hivis';

export interface Style {
  hair: Hair;
  hat: Hat;
  top: Top;
  beard?: boolean;
  shades?: boolean;
}

export interface Colours {
  skin: string;
  hair: string;
  top: string;
  legs: string;
  shoes: string;
  /** Shirt under a jacket, tie, apron, hi-vis vest, bandana. */
  accent: string;
  hat?: string;
  belt?: string;
}

/** Palette characters per material: highlight, base, shade, deep. */
const ROLES = {
  hair: 'qhHQ',
  skin: 'zsSZ',
  top: 'dcCD',
  legs: 'opPO',
  shoes: 'ubBU',
  belt: 'jlLJ',
  accent: 'ygGY',
  hat: 'inNI',
  white: 'fFtT',
  gold: '1234',
} as const;
type Role = keyof typeof ROLES;

export function personPalette(c: Colours): Palette {
  const p: Palette = { '.': null, k: '#1a1423', e: '#1e1724', w: '#f4efe4' };
  const set = (role: Role, tones: readonly string[]) => [...ROLES[role]].forEach((ch, i) => (p[ch] = tones[i]));
  set('hair', ramp(c.hair));
  set('skin', ramp(c.skin));
  set('top', ramp(c.top));
  set('legs', ramp(c.legs));
  set('shoes', ramp(c.shoes));
  set('belt', ramp(c.belt ?? '#6b4630'));
  set('accent', ramp(c.accent));
  set('hat', ramp(c.hat ?? c.top));
  set('white', ['#ffffff', '#e9e5dd', '#bdb7ae', '#8f897f']);
  set('gold', ['#fff0a0', '#f2c14e', '#b8862b', '#7a5418']);
  p.m = mix(ramp(c.skin)[3], '#5a1e22', 0.5);
  p.r = mix(c.skin, '#e2554f', 0.32);
  return p;
}

// ---- Walk cycle ---------------------------------------------------------------------

interface FrontGait {
  bob: number;
  left: [number, number];
  right: [number, number];
}
interface SideGait {
  bob: number;
  near: number;
  far: number;
  arm: number;
}
const FRONT_GAIT: Record<Pose, FrontGait> = {
  idle: { bob: 0, left: [0, 0], right: [0, 0] },
  a: { bob: 2, left: [-1, -3], right: [0, 0] },
  b: { bob: 2, left: [0, 0], right: [1, -3] },
};
const SIDE_GAIT: Record<Pose, SideGait> = {
  idle: { bob: 0, near: 33, far: 33, arm: 0 },
  a: { bob: 2, near: 39, far: 25, arm: -5 },
  b: { bob: 2, near: 26, far: 38, arm: 5 },
};

// ---- Shapes -------------------------------------------------------------------------

interface Part {
  name: string;
  role: Role;
  shape: Shape;
  light: Light;
  hi?: number;
  mid?: number;
}

const head = superellipse(CX, 20.5, 17.6, 16, 2.4);
const frontFringe = polyline([
  [13, 29], [15.5, 28.5], [17.5, 27], [20.5, 21], [24.5, 23.5], [28, 20], [32.5, 24.5],
  [36, 20.5], [39.5, 23.5], [42.5, 21], [46, 27], [48.5, 28.5], [51, 29],
]);
const baldLine = polyline([[13, 15], [51, 15]]);
const napeLine = polyline([[12, 30], [19, 30], [21, 31], [23.5, 35], [26, 37.5], [38, 37.5], [40.5, 35], [43, 31], [45, 30], [52, 30]]);
const sideFringe = polyline([[28, 33], [30, 22], [33.5, 24.5], [37, 20.5], [40.5, 23.5], [44, 21], [47, 22.5], [50, 21]]);
const sideHead = union(superellipse(31, 20.5, 17, 16, 2.4), superellipse(36, 28.5, 12, 8.5, 2.3), ellipse(48.5, 27.5, 1.6, 2));
const sideHairShape: Shape = (x, y) => sideHead(x, y) && (x < 25 || (x < 30.5 && y < 30.5) || y < sideFringe(x));
const sideBaldShape: Shape = (x, y) => sideHead(x, y) && (x < 25 || y < 14);

const boot = union(rrect(19.5, 56.5, 29, 59, 0), rrect(19, 56.5, 29, 62.5, 2), ellipse(24, 60.5, 5.6, 2.2));
const sideBoot = (fx: number) => union(rrect(fx - 5, 56.5, fx + 3, 59, 0), rrect(fx - 5, 56.5, fx + 4, 62.5, 2), ellipse(fx + 2, 60.5, 4.5, 2.2));
const armL = union(rrect(15.5, 36.5, 21.5, 47.5, 3), ellipse(19.5, 39.5, 4.5, 3.5));
const handL = ellipse(18.4, 49.2, 3.3, 3);
const torso = rrect(20, 35.5, 44, 50, 2);

/** Where the sleeve ends and bare arm begins. */
function sleeveY(top: Top) {
  if (top === 'vest') return 0;
  if (top === 'tee' || top === 'apron') return 42.5;
  return 99;
}
const hasBelt = (top: Top) => top === 'tee' || top === 'jacket' || top === 'vest' || top === 'uniform' || top === 'hivis';
const hairRole = (s: Style): Role => (s.hair === 'bald' || s.hair === 'mohawk' ? 'skin' : 'hair');

function hatParts(s: Style, side: boolean): Part[] {
  const crownLight = sphere(side ? 30 : CX, 12, 19, 12);
  const sx = side ? -1 : 0;
  switch (s.hat) {
    case 'cap':
      return side
        ? [
            { name: 'hat', role: 'hat', shape: intersect(superellipse(31, 19, 18, 16.5, 2.4), above(15.5)), light: crownLight },
            { name: 'hatBrim', role: 'hat', shape: rrect(36, 13, 56, 17.5, 2), light: flat(0.4) },
          ]
        : [
            { name: 'hat', role: 'hat', shape: intersect(superellipse(32, 19, 18.5, 16.5, 2.4), above(15.5)), light: crownLight },
            { name: 'hatBrim', role: 'hat', shape: rrect(13, 13.5, 51, 18.5, 2), light: flat(0.42) },
          ];
    case 'beanie': {
      const dome = superellipse(side ? 31 : 32, 19.5, side ? 18 : 18.6, 17, 2.2);
      return [
        { name: 'hat', role: 'hat', shape: intersect(dome, above(13)), light: crownLight },
        { name: 'hatBand', role: 'hat', shape: intersect(superellipse(side ? 31 : 32, 19.5, side ? 18.4 : 18.9, 17.2, 2.2), rrect(0, 13, 64, 18.5, 0)), light: flat(0.42) },
      ];
    }
    case 'police':
      return side
        ? [
            { name: 'hat', role: 'hat', shape: rrect(13, 3, 49, 13, 3), light: crownLight },
            { name: 'hatBand', role: 'hat', shape: rrect(14, 12.5, 48, 17, 1), light: flat(0.3) },
            { name: 'hatBrim', role: 'hat', shape: rrect(40, 15, 56, 18.5, 2), light: flat(0.1) },
          ]
        : [
            { name: 'hat', role: 'hat', shape: rrect(12.5, 3, 51.5, 13, 3), light: crownLight },
            { name: 'hatBand', role: 'hat', shape: rrect(13.5, 12.5, 50.5, 17, 1), light: flat(0.3) },
            { name: 'hatBrim', role: 'hat', shape: rrect(17, 16, 47, 19.5, 2), light: flat(0.1) },
          ];
    case 'fedora':
      return [
        { name: 'hatBrim', role: 'hat', shape: ellipse(32 + sx, 15.5, side ? 24 : 25, side ? 4 : 5), light: flat(0.45) },
        { name: 'hat', role: 'hat', shape: rrect(18 + sx, 3, 46 + sx, 15, 5), light: crownLight },
        { name: 'hatBand', role: 'accent', shape: rrect(18 + sx, 10.5, 46 + sx, 14, 0), light: flat(0.6) },
      ];
    case 'bandana':
      return [
        {
          name: 'hatBand',
          role: 'accent',
          shape: intersect(superellipse(side ? 31 : 32, 20.5, side ? 17.6 : 18.2, 16.6, 2.4), rrect(0, 12.5, 64, 18.5, 0)),
          light: side ? cylinder(31, 18) : cylinder(32, 19),
        },
        ...(side ? [{ name: 'hatKnot', role: 'accent' as Role, shape: rrect(10, 15, 16, 24, 2), light: flat(0.4) }] : []),
      ];
    default:
      return [];
  }
}

function frontParts(s: Style, back: boolean, g: FrontGait): Part[] {
  const b = g.bob;
  const [lx, ly] = g.left;
  const [rx, ry] = g.right;
  const up = (p: Part): Part => ({ ...p, shape: shift(p.shape, 0, b), light: shift(p.light, 0, b) });
  const sy = sleeveY(s.top);
  const parts: Part[] = [
    {
      name: 'trousers',
      role: 'legs',
      shape: union(rrect(20.5, 51 + b, 43.5, 54.5, 1), rrect(20.5 + lx, 53, 29.6 + lx, 58 + ly, 1), rrect(34.4 + rx, 53, 43.5 + rx, 58 + ry, 1)),
      light: (x, y) => cylinder(x < CX ? 25 + lx : 39 + rx, 6, 0.1)(x, y),
    },
    { name: 'bootL', role: 'shoes', shape: shift(boot, lx, ly), light: sphere(23.5 + lx, 58.5 + ly, 7, 6) },
    { name: 'bootR', role: 'shoes', shape: shift(mirror(boot), rx, ry), light: sphere(40.5 + rx, 58.5 + ry, 7, 6) },
  ];
  const upper: Part[] = [{ name: 'torso', role: 'top', shape: torso, light: cylinder(CX, 14), hi: 2, mid: 0.35 }];
  if (hasBelt(s.top)) upper.push({ name: 'belt', role: 'belt', shape: rrect(19.5, 47, 44.5, 51.5, 0.5), light: (x, y) => (y < 48 ? 0.9 : cylinder(CX, 15)(x, y)) });
  if (!back) {
    if (s.top === 'jacket') upper.push({ name: 'inner', role: 'accent', shape: rrect(28, 36, 36, 47.5, 1), light: flat(0.7) });
    if (s.top === 'suit') {
      upper.push({ name: 'inner', role: 'white', shape: rrect(28.5, 36, 35.5, 46, 1), light: flat(0.7) });
      upper.push({ name: 'tie', role: 'accent', shape: union(rrect(30.5, 37, 33.5, 44, 1), ellipse(32, 44.5, 1.8, 2)), light: flat(0.6) });
    }
    if (s.top === 'apron') upper.push({ name: 'apron', role: 'accent', shape: rrect(21.5, 39, 42.5, 57, 2), light: cylinder(CX, 14), hi: 2, mid: 0.3 });
  } else if (s.top === 'apron') {
    upper.push({ name: 'apron', role: 'accent', shape: rrect(20, 44.5, 44, 47.5, 0.5), light: flat(0.6) });
  }
  if (s.top === 'hivis') upper.push({ name: 'vest', role: 'accent', shape: rrect(20.5, 36, 43.5, 48.5, 2), light: cylinder(CX, 14), hi: 2, mid: 0.3 });
  if (s.top === 'hoodie') {
    upper.push(
      back
        ? { name: 'hood', role: 'top', shape: rrect(21, 34, 43, 44, 5), light: sphere(CX, 36, 12, 8) }
        : { name: 'hood', role: 'top', shape: union(ellipse(23, 37, 6, 3), ellipse(41, 37, 6, 3)), light: flat(0.45) },
    );
  }
  // Sleeves in the top's colour, bare forearms below.
  upper.push(
    { name: 'armL', role: 'top', shape: intersect(armL, above(sy)), light: cylinder(18.5, 4.5), hi: 0.9, mid: 0.5 },
    { name: 'armR', role: 'top', shape: intersect(mirror(armL), above(sy)), light: cylinder(45.5, 4.5), hi: 2, mid: 0.62 },
    { name: 'foreL', role: 'skin', shape: intersect(armL, below(sy)), light: cylinder(18.5, 4.5), hi: 0.9, mid: 0.5 },
    { name: 'foreR', role: 'skin', shape: intersect(mirror(armL), below(sy)), light: cylinder(45.5, 4.5), hi: 2, mid: 0.62 },
  );
  if (s.hair === 'long') {
    upper.push(
      back
        ? { name: 'longhair', role: 'hair', shape: rrect(16, 20, 48, 46, 6), light: sphere(CX, 28, 18, 18), hi: 2, mid: 0.4 }
        : { name: 'longhair', role: 'hair', shape: union(rrect(12.5, 18, 20, 44, 3.5), rrect(44, 18, 51.5, 44, 3.5)), light: cylinder(CX, 22), hi: 2, mid: 0.4 },
    );
  }
  upper.push(
    { name: 'handL', role: 'skin', shape: handL, light: sphere(18.4, 49, 3.6, 3.4) },
    { name: 'handR', role: 'skin', shape: mirror(handL), light: sphere(45.6, 49, 3.6, 3.4) },
  );

  const hr = hairRole(s);
  const hairLight = sphere(CX, 15, 19, 17);
  if (s.hair === 'bun' && !back) upper.push({ name: 'bun', role: 'hair', shape: ellipse(32, 6, 7, 5), light: sphere(30, 4, 8, 6), hi: 2 });
  if (back) {
    if (s.hair === 'bald' || s.hair === 'mohawk') {
      upper.push({ name: 'scalp', role: 'skin', shape: head, light: hairLight, hi: 0.9, mid: 0.4 });
    } else {
      upper.push(
        { name: 'neck', role: 'skin', shape: (x, y) => head(x, y) && y >= napeLine(x), light: flat(0.3) },
        { name: 'hair', role: hr, shape: (x, y) => head(x, y) && y < napeLine(x), light: hairLight, hi: 2, mid: 0.48 },
      );
    }
    if (s.hair === 'bun') upper.push({ name: 'bun', role: 'hair', shape: ellipse(32, 11, 7.5, 6.5), light: sphere(30, 8, 8, 7), hi: 2 });
  } else {
    // A face is mostly a flat front, so it gets a simple rule instead of a sphere: shade down the far cheek and jaw.
    const face: Light = (x, y) => ((x - CX) / 15 + (0.5 * (y - 27)) / 9 > 0.75 || y > 35 ? 0 : 0.7);
    const line = s.hair === 'bald' || s.hair === 'mohawk' ? baldLine : frontFringe;
    upper.push(
      { name: 'face', role: 'skin', shape: (x, y) => head(x, y) && y >= line(x), light: face, hi: 2 },
      s.hair === 'bald' || s.hair === 'mohawk'
        ? { name: 'scalp', role: 'skin', shape: (x, y) => head(x, y) && y < line(x), light: hairLight, hi: 0.9, mid: 0.4 }
        : { name: 'hair', role: hr, shape: (x, y) => head(x, y) && y < line(x), light: hairLight, hi: 2, mid: 0.48 },
    );
    if (s.beard) upper.push({ name: 'beard', role: 'hair', shape: (x, y) => head(x, y) && y >= 31 && Math.abs(x - 32) < 12.5, light: (x) => (x > 38 ? 0.3 : 0.6) });
  }
  if (s.hair === 'mohawk') upper.push({ name: 'crest', role: 'hair', shape: union(intersect(head, rrect(27.5, 0, 36.5, 22, 3)), rrect(28, 2.5, 36, 9, 3.5)), light: cylinder(CX, 6), hi: 2 });
  upper.push(...hatParts(s, false));
  parts.push(...upper.map(up));
  return parts;
}

function sideParts(s: Style, g: SideGait): Part[] {
  const { bob: b, near, far } = g;
  const up = (p: Part): Part => ({ ...p, shape: shift(p.shape, 0, b), light: shift(p.light, 0, b) });
  const wrist = 31 + g.arm;
  const hand = 31 + g.arm * 1.15;
  const sy = sleeveY(s.top);
  const arm = capsule(31, 39, wrist, 46, 3.6);
  const parts: Part[] = [
    { name: 'legF', role: 'legs', shape: capsule(31, 52 + b, far, 56, 4.4), light: flat(0.3) },
    { name: 'bootF', role: 'shoes', shape: sideBoot(far), light: (x, y) => sphere(far - 1, 58.5, 8, 6)(x, y) - 0.25 },
    { name: 'legN', role: 'legs', shape: capsule(33, 52 + b, near, 56, 4.4), light: cylinder(near, 6, 0.1) },
    { name: 'bootN', role: 'shoes', shape: sideBoot(near), light: sphere(near - 1, 58.5, 8, 6) },
  ];
  const upper: Part[] = [{ name: 'torso', role: 'top', shape: rrect(22, 35.5, 42, 50, 3), light: cylinder(CX, 12), hi: 2, mid: 0.35 }];
  if (hasBelt(s.top)) upper.push({ name: 'belt', role: 'belt', shape: rrect(21.5, 47, 42.5, 51.5, 0.5), light: (x, y) => (y < 48 ? 0.9 : cylinder(CX, 13)(x, y)) });
  if (s.top === 'apron') upper.push({ name: 'apron', role: 'accent', shape: rrect(37, 39, 43.5, 57, 1.5), light: flat(0.55) });
  if (s.top === 'hivis') upper.push({ name: 'vest', role: 'accent', shape: rrect(22.5, 36, 41.5, 48.5, 2.5), light: cylinder(CX, 12), hi: 2, mid: 0.3 });
  if (s.top === 'suit') upper.push({ name: 'inner', role: 'white', shape: rrect(38, 36, 42.5, 45, 1), light: flat(0.6) });
  if (s.top === 'hoodie') upper.push({ name: 'hood', role: 'top', shape: rrect(17, 33, 31, 42, 5), light: sphere(22, 35, 9, 8) });
  if (s.hair === 'long') upper.push({ name: 'longhair', role: 'hair', shape: rrect(14, 18, 31, 45, 5), light: sphere(22, 26, 12, 16), hi: 2, mid: 0.4 });
  upper.push(
    { name: 'arm', role: 'top', shape: intersect(arm, above(sy)), light: cylinder(30, 5), hi: 0.9, mid: 0.5 },
    { name: 'fore', role: 'skin', shape: intersect(arm, below(sy)), light: cylinder(30, 5), hi: 0.9, mid: 0.5 },
    { name: 'hand', role: 'skin', shape: ellipse(hand, 49, 3.2, 3), light: sphere(hand, 48.5, 3.6, 3.4) },
  );
  const bald = s.hair === 'bald' || s.hair === 'mohawk';
  const hairShape = bald ? sideBaldShape : sideHairShape;
  upper.push(
    { name: 'face', role: 'skin', shape: (x, y) => sideHead(x, y) && !hairShape(x, y), light: (_x, y) => (y > 35 ? 0 : 0.7), hi: 2 },
    bald
      ? { name: 'scalp', role: 'skin', shape: hairShape, light: sphere(31, 15, 19, 17), hi: 0.9, mid: 0.4 }
      : { name: 'hair', role: 'hair', shape: hairShape, light: sphere(31, 15, 19, 17), hi: 2, mid: 0.48 },
    { name: 'ear', role: 'skin', shape: ellipse(28, 28, 2.4, 3.4), light: sphere(27, 27, 3, 4) },
  );
  if (s.beard) upper.push({ name: 'beard', role: 'hair', shape: (x, y) => sideHead(x, y) && !hairShape(x, y) && y >= 30 && x >= 28 && !(y < 34 && x > 44), light: flat(0.6) });
  if (s.hair === 'bun') upper.push({ name: 'bun', role: 'hair', shape: ellipse(19, 9, 6.5, 5.5), light: sphere(17, 7, 7, 6), hi: 2 });
  if (s.hair === 'mohawk') upper.push({ name: 'crest', role: 'hair', shape: union(intersect(sideHead, above(13)), ellipse(30, 8, 15, 5)), light: sphere(30, 8, 16, 8), hi: 2 });
  upper.push(...hatParts(s, true));
  parts.push(...upper.map(up));
  return parts;
}

/** [front, behind, tone, extra rows of shadow]; names match by prefix, so 'arm' covers armL and armR. */
const CREASES: Record<Dir, [string, string, number, number][]> = {
  down: [
    ['hair', 'face', 2, 0],
    ['face', 'torso', 3, 0],
    ['arm', 'torso', 3, 0],
    ['fore', 'torso', 3, 0],
    ['arm', 'vest', 3, 0],
    ['fore', 'vest', 3, 0],
    ['inner', 'torso', 3, 0],
    ['apron', 'torso', 3, 0],
    ['apron', 'trousers', 3, 0],
    ['vest', 'torso', 3, 0],
    ['hood', 'torso', 3, 0],
    ['longhair', 'torso', 3, 0],
    ['longhair', 'arm', 3, 0],
    ['hair', 'bun', 3, 0],
    ['hat', 'hair', 3, 0],
    ['hat', 'face', 2, 0],
    ['hat', 'scalp', 3, 0],
    ['beard', 'face', 2, 0],
    ['crest', 'scalp', 3, 0],
  ],
  up: [
    ['hair', 'neck', 2, 0],
    ['hair', 'torso', 3, 0],
    ['neck', 'torso', 3, 0],
    ['scalp', 'torso', 3, 0],
    ['arm', 'torso', 3, 0],
    ['fore', 'torso', 3, 0],
    ['arm', 'vest', 3, 0],
    ['hood', 'torso', 3, 0],
    ['longhair', 'torso', 3, 0],
    ['longhair', 'arm', 3, 0],
    ['bun', 'hair', 3, 0],
    ['hat', 'hair', 3, 0],
    ['hat', 'scalp', 3, 0],
    ['crest', 'scalp', 3, 0],
    ['vest', 'torso', 3, 0],
  ],
  side: [
    ['hair', 'face', 2, 0],
    ['face', 'torso', 3, 0],
    ['hair', 'torso', 3, 0],
    ['scalp', 'torso', 3, 0],
    ['arm', 'torso', 3, 0],
    ['fore', 'torso', 3, 0],
    ['arm', 'longhair', 3, 0],
    ['arm', 'vest', 3, 0],
    ['longhair', 'torso', 3, 0],
    ['hood', 'torso', 3, 0],
    ['legN', 'legF', 3, 0],
    ['bootN', 'bootF', 3, 0],
    ['hat', 'hair', 3, 0],
    ['hat', 'face', 2, 0],
    ['hat', 'scalp', 3, 0],
    ['beard', 'face', 2, 0],
    ['bun', 'hair', 3, 0],
    ['crest', 'scalp', 3, 0],
  ],
};

const STRANDS: Record<Dir, [number, number][][]> = {
  down: [
    [[20.5, 20], [21.5, 15]],
    [[28, 19], [28.5, 14]],
    [[42.5, 20], [41.5, 15]],
  ],
  up: [
    [[22, 31], [23, 23]],
    [[30, 37], [30, 28]],
    [[38, 35], [38.5, 27]],
    [[44, 30], [43, 22]],
  ],
  side: [
    [[37, 20], [34, 13]],
    [[44, 20.5], [41, 14]],
    [[19, 30], [17.5, 21]],
  ],
};

// ---- Drawing --------------------------------------------------------------------------

const cache = new Map<string, string[]>();

export function styleKey(s: Style) {
  return `${s.hair}.${s.hat}.${s.top}${s.beard ? '.b' : ''}${s.shades ? '.s' : ''}`;
}

/** One frame of a person: 32 rows of palette characters. */
export function personFrame(s: Style, dir: Dir, pose: Pose): string[] {
  const key = `${styleKey(s)}:${dir}:${pose}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = drawPerson(s, dir, pose);
  cache.set(key, rows);
  return rows;
}

function drawPerson(s: Style, dir: Dir, pose: Pose): string[] {
  const N = PERSON_SIZE;
  const g = dir === 'side' ? SIDE_GAIT[pose] : FRONT_GAIT[pose];
  const parts = dir === 'side' ? sideParts(s, SIDE_GAIT[pose]) : frontParts(s, dir === 'up', FRONT_GAIT[pose]);
  const at = (v: number) => (v + 0.5) * UNITS;
  const bob = g.bob / UNITS;

  const owner = Array.from({ length: N }, () => new Array<number>(N).fill(-1));
  parts.forEach((p, i) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (p.shape(at(x), at(y))) owner[y][x] = i;
  });
  const own = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : owner[y][x]);
  const part = (x: number, y: number) => parts[own(x, y)]?.name ?? '';

  const tone: number[][] = owner.map((row, y) =>
    row.map((i, x) => {
      if (i < 0) return -1;
      const p = parts[i];
      const v = p.light(at(x), at(y));
      return v > (p.hi ?? 0.86) ? 0 : v > (p.mid ?? 0.5) ? 1 : 2;
    }),
  );

  for (const [front, behind, t, rows] of CREASES[dir]) {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = owner[y][x];
        if (i < 0 || !parts[i].name.startsWith(behind)) continue;
        const isFront = (xx: number, yy: number) => {
          const j = own(xx, yy);
          return j >= 0 && j !== i && parts[j].name.startsWith(front);
        };
        let hit = isFront(x + 1, y) || isFront(x - 1, y) || isFront(x, y + 1) || isFront(x, y - 1);
        for (let k = 2; k <= rows + 1 && !hit; k++) hit = isFront(x, y - k);
        if (hit) tone[y][x] = Math.max(tone[y][x], t);
      }
  }

  // Hair sheen: a broken band across the lit side of the head.
  const sheenX = dir === 'side' ? 31 : CX;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (part(x, y) !== 'hair' || parts[owner[y][x]].role !== 'hair') continue;
      const dx = (at(x) - sheenX) / 18;
      const dy = (at(y) - g.bob - 18) / 15;
      const d = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (d > 0.56 && d < 0.76 && a > -160 && a < -60) tone[y][x] = 0;
    }

  const grid = tone.map((row, y) => row.map((t, x) => (t < 0 ? '.' : ROLES[parts[owner[y][x]].role][t])));
  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < N && y < N && grid[y][x] !== '.') grid[y][x] = ch;
  };

  if (s.hair === 'short' || s.hair === 'long' || s.hair === 'bun') {
    for (const line of STRANDS[dir]) {
      const [x0, y0] = line[0].map((v) => v / UNITS);
      const [x1, y1] = line[1].map((v) => v / UNITS);
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let j = 0; j <= n; j++) {
        const x = Math.floor(x0 + ((x1 - x0) * j) / n);
        const y = Math.floor(y0 + ((y1 - y0) * j) / n + bob);
        if (part(x, y) !== 'hair') continue;
        const darker = ({ q: 'h', h: 'H', H: 'Q', Q: 'Q' } as Record<string, string>)[grid[y][x]];
        if (darker) set(x, y, darker);
      }
    }
  }

  // Sleeve hems: the bottom edge of each sleeve.
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N; x++) {
      const below = part(x, y + 1);
      if (part(x, y).startsWith('arm') && !below.startsWith('arm') && below !== 'torso' && below !== 'vest') set(x, y, 'D');
    }

  // Shoes: a lit top edge and a dark sole.
  for (const name of ['bootL', 'bootR', 'bootN', 'bootF']) {
    const cells: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (part(x, y) === name) cells.push([x, y]);
    if (!cells.length) continue;
    const top = Math.min(...cells.map((c) => c[1]));
    const bottom = Math.max(...cells.map((c) => c[1]));
    const left = Math.min(...cells.filter((c) => c[1] === top).map((c) => c[0]));
    for (const [x, y] of cells) {
      if (y === top) set(x, y, name === 'bootF' ? 'B' : x < left + 2 ? 'u' : 'b');
      if (y === bottom) set(x, y, 'U');
    }
  }

  const by = Math.round(bob);
  if (dir === 'down') {
    if (s.shades) {
      for (let x = 10; x <= 21; x++) set(x, 12 + by, 'e');
      for (const x of [10, 11, 12, 13, 18, 19, 20, 21]) set(x, 13 + by, 'e');
      set(11, 12 + by, 'w');
      set(19, 12 + by, 'w');
    } else {
      for (const ex of [11, 19]) {
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) set(ex + dx, 12 + dy + by, 'e');
        set(ex, 12 + by, 'w');
      }
    }
    if (!s.beard) {
      set(15, 16 + by, 'm');
      set(16, 16 + by, 'm');
      set(10, 15 + by, 'r');
      set(21, 15 + by, 'r');
    }
    if (hasBelt(s.top)) {
      ['122', '243', '233'].forEach((row, dy) => [...row].forEach((c, dx) => set(13 + dx, 23 + dy + by, c)));
      set(19, 24 + by, 'J');
    }
    if (s.top === 'uniform') {
      set(12, 19 + by, '1');
      set(13, 19 + by, '2');
      set(12, 20 + by, '2');
      set(13, 20 + by, '3');
    }
    if (s.top === 'hivis') for (let x = 0; x < N; x++) for (const yy of [20, 22]) if (part(x, yy + by) === 'vest') set(x, yy + by, 'f');
    if (s.top === 'hoodie') {
      set(14, 19 + by, 'F');
      set(17, 19 + by, 'F');
      set(14, 20 + by, 'F');
      set(17, 20 + by, 'F');
      for (let x = 12; x <= 19; x++) set(x, 22 + by, 'D');
    }
    if (s.top === 'apron') {
      set(11, 19 + by, 'G');
      set(20, 19 + by, 'G');
    }
    if (s.hat === 'police') {
      set(15, 7 + by, '1');
      set(16, 7 + by, '2');
    }
  } else if (dir === 'up') {
    if (s.hat === 'cap') {
      set(15, 7 + by, 'k');
      set(16, 7 + by, 'k');
    }
    if (s.hat === 'bandana') {
      set(15, 9 + by, 'Y');
      set(16, 9 + by, 'Y');
      set(15, 10 + by, 'G');
      set(16, 11 + by, 'G');
    }
    if (s.top === 'hivis') for (let x = 0; x < N; x++) for (const yy of [20, 22]) if (part(x, yy + by) === 'vest') set(x, yy + by, 'f');
    if (s.top === 'apron') {
      set(15, 23 + by, 'G');
      set(16, 23 + by, 'G');
      set(15, 24 + by, 'Y');
      set(16, 24 + by, 'Y');
    }
  } else {
    if (s.shades) {
      for (let x = 19; x <= 22; x++) {
        set(x, 12 + by, 'e');
        set(x, 13 + by, 'e');
      }
      set(21, 12 + by, 'w');
    } else {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) set(20 + dx, 12 + dy + by, 'e');
      set(20, 12 + by, 'w');
    }
    if (!s.beard) {
      set(22, 16 + by, 'm');
      set(18, 15 + by, 'r');
    }
    if (hasBelt(s.top)) {
      for (let y = 23; y <= 25; y++) {
        let front = -1;
        for (let x = 0; x < N; x++) if (part(x, y + by) === 'belt') front = x;
        if (front >= 0) set(front, y + by, y === 23 ? '1' : '2');
      }
    }
    if (s.top === 'hivis') for (let x = 0; x < N; x++) for (const yy of [20, 22]) if (part(x, yy + by) === 'vest') set(x, yy + by, 'f');
    if (s.top === 'uniform') {
      set(19, 19 + by, '2');
      set(19, 20 + by, '3');
    }
  }

  cleanup(grid, 'kewmrqQHyGJUDC1234fF');
  return outline(grid);
}
