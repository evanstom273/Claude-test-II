import { describe, expect, it } from 'vitest';
import { ALL_LOOKS } from '../../data/cast';
import { CAR_SPECS, carFrame, carPalette, CAR_COLOURS, type CarModel } from './cars';
import { DIRS, PERSON_SIZE, POSES, personFrame, personPalette } from './people';

describe('generated people', () => {
  it('draws every look in every direction and pose, using only colours the palette knows', () => {
    for (const look of ALL_LOOKS) {
      const pal = personPalette(look.colours);
      for (const dir of DIRS)
        for (const pose of POSES) {
          const rows = personFrame(look.style, dir, pose);
          expect(rows.length).toBe(PERSON_SIZE);
          for (const row of rows) {
            expect(row.length).toBe(PERSON_SIZE);
            for (const ch of row) if (ch !== '.') expect(pal[ch], `${look.id} ${dir} ${pose} '${ch}'`).toBeDefined();
          }
        }
    }
  });
});

describe('generated cars', () => {
  it('draws every model at its spec size', () => {
    for (const model of Object.keys(CAR_SPECS) as CarModel[]) {
      const rows = carFrame(model);
      const pal = carPalette(CAR_COLOURS[0], false);
      expect(rows.length).toBeGreaterThanOrEqual(CAR_SPECS[model].wid);
      expect(rows[0].length).toBeGreaterThanOrEqual(CAR_SPECS[model].len);
      for (const row of rows) for (const ch of row) if (ch !== '.') expect(pal[ch], `${model} '${ch}'`).toBeDefined();
    }
  });
});
