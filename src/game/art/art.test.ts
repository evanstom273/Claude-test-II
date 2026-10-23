import { describe, expect, it } from 'vitest';
import { FRAMES, ANIMS, FRAME_MAP } from './registry';
import { BASE } from './pixels';

describe('pixel art', () => {
  it('every frame has rows of equal width', () => {
    const bad: string[] = [];
    for (const f of FRAMES) {
      const w = f.rows[0].length;
      f.rows.forEach((r, i) => {
        if (r.length !== w) bad.push(`${f.key} row ${i}: ${r.length} != ${w}  "${r}"`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('every frame only uses known palette characters', () => {
    const bad: string[] = [];
    for (const f of FRAMES) {
      for (const r of f.rows) {
        for (const ch of r) {
          if (!(ch in BASE) && !(ch in f.palette)) bad.push(`${f.key}: '${ch}'`);
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('frame keys are unique and animations reference real frames', () => {
    const keys = FRAMES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ANIMS) for (const k of a.frames) expect(FRAME_MAP[k], `${a.key} -> ${k}`).toBeDefined();
  });
});
