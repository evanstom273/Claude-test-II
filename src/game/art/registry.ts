import { ALL_LOOKS } from '../../data/cast';
import { CAR_COLOURS, CAR_SPECS, CIVILIAN_MODELS, MODEL_COLOUR, carFrame, carPalette, type CarModel } from './cars';
import { DIRS, POSES, personFrame, personPalette } from './people';
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

function add(key: string, rows: string[], palette: Palette) {
  frames.push({ key, rows, palette });
}

// ---- People: nine frames each, plus walk and idle animations per direction -----------

for (const look of ALL_LOOKS) {
  const palette = personPalette(look.colours);
  for (const dir of DIRS) {
    for (const pose of POSES) add(`${look.id}_${dir}_${pose}`, personFrame(look.style, dir, pose), palette);
    anims.push({ key: `${look.id}_walk_${dir}`, frames: [`${look.id}_${dir}_a`, `${look.id}_${dir}_idle`, `${look.id}_${dir}_b`, `${look.id}_${dir}_idle`], fps: 9 });
    anims.push({ key: `${look.id}_run_${dir}`, frames: [`${look.id}_${dir}_a`, `${look.id}_${dir}_idle`, `${look.id}_${dir}_b`, `${look.id}_${dir}_idle`], fps: 14 });
  }
}

// ---- Cars: civilian models in every colour, specials in their livery, burnt wrecks ----

const uniqueModels = [...new Set(CIVILIAN_MODELS)].filter((m) => !MODEL_COLOUR[m]);
for (const model of Object.keys(CAR_SPECS) as CarModel[]) {
  const rows = carFrame(model);
  if (MODEL_COLOUR[model]) add(`car_${model}`, rows, carPalette(MODEL_COLOUR[model]!));
  else if (uniqueModels.includes(model)) CAR_COLOURS.forEach((col, i) => add(`car_${model}_${i}`, rows, carPalette(col)));
  add(`car_${model}_burnt`, rows, carPalette('#000000', true));
}

export function carFrameKey(model: CarModel, colour: number) {
  return MODEL_COLOUR[model] ? `car_${model}` : `car_${model}_${colour}`;
}

export const FRAMES = frames;
export const ANIMS = anims;
export const FRAME_MAP: Record<string, FrameDef> = Object.fromEntries(frames.map((f) => [f.key, f]));
