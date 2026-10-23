import { mix, ramp } from './color';
import type { Palette } from './pixels';
import { outline, rrect, union, type Shape } from './shapes';

/*
 * Cars seen from above, facing right, drawn from rectangles at twice world
 * resolution (shown at half scale like the people). Shading runs across the
 * width rather than from a fixed corner, because cars spin round.
 */

export type CarModel = 'compact' | 'sedan' | 'sports' | 'van' | 'pickup' | 'taxi' | 'police' | 'ambulance';

export interface CarSpec {
  /** Drawn size in pixels; the world size is half this. */
  len: number;
  wid: number;
  /** Top speed, acceleration and grip, roughly 0..1. */
  speed: number;
  accel: number;
  grip: number;
  hp: number;
  /** Price at the chop shop. */
  value: number;
  name: string;
}

export const CAR_SPECS: Record<CarModel, CarSpec> = {
  compact: { len: 40, wid: 22, speed: 0.78, accel: 0.8, grip: 0.8, hp: 70, value: 60, name: 'Bubble' },
  sedan: { len: 48, wid: 22, speed: 0.85, accel: 0.75, grip: 0.75, hp: 90, value: 90, name: 'Saloon' },
  sports: { len: 48, wid: 21, speed: 1.1, accel: 1, grip: 0.9, hp: 80, value: 220, name: 'Stinger' },
  van: { len: 52, wid: 24, speed: 0.7, accel: 0.55, grip: 0.6, hp: 130, value: 80, name: 'Box Van' },
  pickup: { len: 52, wid: 24, speed: 0.8, accel: 0.7, grip: 0.65, hp: 120, value: 100, name: 'Workhorse' },
  taxi: { len: 48, wid: 22, speed: 0.85, accel: 0.75, grip: 0.75, hp: 90, value: 90, name: 'Cab' },
  police: { len: 48, wid: 22, speed: 1.0, accel: 0.9, grip: 0.85, hp: 120, value: 0, name: 'Patrol Car' },
  ambulance: { len: 54, wid: 25, speed: 0.8, accel: 0.6, grip: 0.6, hp: 140, value: 0, name: 'Ambulance' },
};

export const CIVILIAN_MODELS: CarModel[] = ['compact', 'sedan', 'sedan', 'sports', 'van', 'pickup', 'taxi'];

export const CAR_COLOURS = ['#c23b3b', '#3a6ab0', '#e8e4dc', '#2d2d38', '#3f8f6a', '#d9a03a', '#8a8a96', '#7a4ab0', '#b05a2a', '#2a7a8a'];

/** Fixed colours for the special models. */
export const MODEL_COLOUR: Partial<Record<CarModel, string>> = { taxi: '#f2c14e', police: '#e8e4dc', ambulance: '#f0ece4' };

const ROLES = { body: 'dcCD', glass: 'qhHQ', trim: 'opPO' } as const;

export function carPalette(colour: string, burnt = false): Palette {
  const body = burnt ? ['#4a4448', '#363034', '#28232a', '#1c181e'] : ramp(colour);
  const glass = burnt ? ['#3a3a40', '#2a2a30', '#202026', '#18181c'] : ['#bfe6ff', '#5f8fbf', '#3f5f8a', '#283c5c'];
  const trim = burnt ? ['#3a3a3a', '#2a2a2a', '#1e1e1e', '#141414'] : ['#7a7a86', '#4a4a56', '#33333d', '#24242c'];
  const p: Palette = { '.': null, k: '#141018', x: burnt ? '#0e0c10' : '#16161a' };
  [...ROLES.body].forEach((c, i) => (p[c] = body[i]));
  [...ROLES.glass].forEach((c, i) => (p[c] = glass[i]));
  [...ROLES.trim].forEach((c, i) => (p[c] = trim[i]));
  p.y = burnt ? '#3a3430' : '#fff6c8';
  p.r = burnt ? '#3a2a2a' : '#e04040';
  p.R = burnt ? '#2a2020' : '#9a2a2a';
  p.b = '#3a7aff';
  p.w = burnt ? '#4a4448' : '#f4efe4';
  p.s = burnt ? '#2a2420' : mix(colour, '#000000', 0.55);
  return p;
}

interface Layer {
  shape: Shape;
  /** Tone from a position: returns a palette character. */
  paint: (x: number, y: number) => string;
}

/** Shading across the car's width: lit along the spine, darker towards the sides. */
function across(wid: number, chars: string, hiBand = 0.2, shadeBand = 0.62) {
  return (_x: number, y: number) => {
    const d = Math.abs(y - wid / 2) / (wid / 2);
    return d < hiBand ? chars[0] : d < shadeBand ? chars[1] : chars[2];
  };
}

export function carFrame(model: CarModel): string[] {
  const { len: L, wid: W } = CAR_SPECS[model];
  const layers: Layer[] = [];
  const add = (shape: Shape, paint: string | Layer['paint']) => layers.push({ shape, paint: typeof paint === 'string' ? () => paint : paint });

  // Tyres peek out at the corners.
  const tyre = (x0: number, x1: number) => {
    add(rrect(x0, 0.5, x1, 4, 1), 'x');
    add(rrect(x0, W - 4, x1, W - 0.5, 1), 'x');
  };
  tyre(L * 0.16, L * 0.31);
  tyre(L * 0.68, L * 0.83);

  const body = rrect(1, 2, L - 1, W - 2, W * 0.2);
  add(body, across(W, 'dcC', 0.1, 0.55));

  const glass = across(W, 'qhH', 0.15, 0.5);
  const roofTone = across(W, 'dcC', 0.22, 0.8);
  const isVan = model === 'van' || model === 'ambulance';
  if (model === 'pickup') {
    // Open bed behind the cab.
    add(rrect(3, 4, L * 0.48, W - 4, 2), 'D');
    add(rrect(5, 6, L * 0.46, W - 6, 1), 'C');
    add(rrect(L * 0.5, 3.5, L * 0.6, W - 3.5, 2), glass);
    add(rrect(L * 0.58, 3, L * 0.7, W - 3, 2), roofTone);
    add(rrect(L * 0.69, 3.5, L * 0.77, W - 3.5, 2), glass);
  } else if (isVan) {
    add(rrect(3, 3, L * 0.74, W - 3, 3), roofTone);
    add(rrect(L * 0.73, 3.5, L * 0.83, W - 3.5, 2.5), glass);
    for (let x = L * 0.2; x < L * 0.7; x += L * 0.17) add(rrect(x, 3, x + 0.6, W - 3, 0), 'c');
  } else {
    const [r0, r1, w0, w1] =
      model === 'sports' ? [0.22, 0.3, 0.52, 0.62] : model === 'compact' ? [0.14, 0.24, 0.62, 0.74] : [0.2, 0.3, 0.6, 0.71];
    add(rrect(L * r0, 4, L * r1, W - 4, 2), glass);
    add(rrect(L * r1 - 0.5, 3.5, L * w0 + 0.5, W - 3.5, 2.5), roofTone);
    add(rrect(L * w0, 3.5, L * w1, W - 3.5, 2.5), glass);
    // Side windows along the roof.
    add(rrect(L * r1, 2.5, L * w0, 4, 0.5), 'h');
    add(rrect(L * r1, W - 4, L * w0, W - 2.5, 0.5), 'H');
    // Bonnet seam.
    add(rrect(L * w1 + 2, W / 2 - 0.4, L - 4, W / 2 + 0.4, 0), model === 'sports' ? 'D' : 'C');
  }

  // Lights and bumpers.
  add(rrect(L - 3, 3, L - 1, 6, 0.5), 'y');
  add(rrect(L - 3, W - 6, L - 1, W - 3, 0.5), 'y');
  add(rrect(1, 3, 3, 6, 0.5), 'r');
  add(rrect(1, W - 6, 3, W - 3, 0.5), 'r');
  add(rrect(0.5, 6, 1.5, W - 6, 0), 'P');
  add(rrect(L - 1.5, 6, L - 0.5, W - 6, 0), 'P');

  if (model === 'taxi') {
    add(rrect(L * 0.38, W / 2 - 3, L * 0.5, W / 2 + 3, 1), 'y');
    add(rrect(L * 0.4, W / 2 - 1, L * 0.48, W / 2 + 1, 0), 'k');
  }
  if (model === 'police' || model === 'ambulance') {
    const cx = model === 'police' ? L * 0.44 : L * 0.66;
    add(rrect(cx - 2, 3.5, cx + 2, W / 2, 1), 'r');
    add(rrect(cx - 2, W / 2, cx + 2, W - 3.5, 1), 'b');
    add(rrect(cx - 2.5, W / 2 - 0.5, cx + 2.5, W / 2 + 0.5, 0), 'w');
  }
  if (model === 'police') {
    // Dark bonnet and boot.
    add(rrect(L * 0.72, 3, L - 3, W - 3, 3), 'D');
    add(rrect(3, 3, L * 0.19, W - 3, 3), 'D');
  }
  if (model === 'ambulance') add(rrect(4, W / 2 - 1.5, L * 0.7, W / 2 + 1.5, 0), 'r');
  if (model === 'sports') add(union(rrect(4, W / 2 - 3, L * 0.18, W / 2 - 1.5, 0), rrect(4, W / 2 + 1.5, L * 0.18, W / 2 + 3, 0)), 'w');

  const grid: string[][] = Array.from({ length: W }, () => new Array<string>(L).fill('.'));
  for (let y = 0; y < W; y++)
    for (let x = 0; x < L; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      for (const l of layers) if (l.shape(px, py)) grid[y][x] = l.paint(px, py);
    }
  return outline(grid);
}
