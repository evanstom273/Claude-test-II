import { ALL_LOOKS } from '../data/cast';
import { generateCity } from '../game/city/gen';
import { bufferToCanvas, paintChunk, paintMinimap } from '../game/city/paint';
import { CHUNK, TILE } from '../game/city/tiles';
import { CAR_COLOURS, CAR_SPECS, MODEL_COLOUR, carFrame, carPalette, type CarModel } from '../game/art/cars';
import { DIRS, POSES, personFrame, personPalette } from '../game/art/people';
import { drawRows } from '../game/art/pixels';

/* Dev-only: draws generated sprites large so they can be eyeballed. Open /preview.html. */

const out = document.getElementById('out')!;
const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 3);
const only = params.get('only');

function section(title: string) {
  const h = document.createElement('h2');
  h.textContent = title;
  out.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  out.appendChild(row);
  return row;
}

function canvasFor(rows: string[], palette: Record<string, string | null>, s = scale, flip = false) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  c.style.width = `${c.width * s}px`;
  drawRows(c.getContext('2d')!, rows, palette, 0, 0, flip);
  return c;
}

if (!only || only === 'people') {
  const row = section('People');
  for (const look of ALL_LOOKS) {
    const fig = document.createElement('figure');
    const pal = personPalette(look.colours);
    const frames = params.get('all') ? DIRS.flatMap((d) => POSES.map((p) => personFrame(look.style, d, p))) : DIRS.map((d) => personFrame(look.style, d, 'idle'));
    const strip = document.createElement('div');
    strip.style.display = 'flex';
    for (const f of frames) strip.appendChild(canvasFor(f, pal));
    fig.appendChild(strip);
    const cap = document.createElement('figcaption');
    cap.textContent = look.id;
    fig.appendChild(cap);
    row.appendChild(fig);
  }
}

if (!only || only === 'cars') {
  const row = section('Cars');
  for (const model of Object.keys(CAR_SPECS) as CarModel[]) {
    const rows = carFrame(model);
    for (const colour of model in MODEL_COLOUR ? [MODEL_COLOUR[model]!] : CAR_COLOURS.slice(0, 4)) row.appendChild(canvasFor(rows, carPalette(colour), scale));
    row.appendChild(canvasFor(rows, carPalette('#000000', true), scale));
  }
}

if (only === 'city') {
  const seed = Number(params.get('seed') ?? 1234);
  const t0 = performance.now();
  const city = generateCity(seed);
  const t1 = performance.now();
  const info = document.createElement('div');
  out.appendChild(info);
  const mini = paintMinimap(city);
  mini.style.width = `${city.W * Number(params.get('mscale') ?? 3)}px`;
  mini.style.imageRendering = 'pixelated';
  const n = Number(params.get('n') ?? 0);
  if (n > 0) {
    const cx0 = Number(params.get('cx') ?? 2);
    const cy0 = Number(params.get('cy') ?? 2);
    const big = document.createElement('canvas');
    big.width = big.height = n * CHUNK * TILE;
    const ctx = big.getContext('2d')!;
    let paintMs = 0;
    for (let cy = 0; cy < n; cy++)
      for (let cx = 0; cx < n; cx++) {
        const p0 = performance.now();
        const buf = paintChunk(city, cx0 + cx, cy0 + cy);
        paintMs += performance.now() - p0;
        ctx.drawImage(bufferToCanvas(buf), cx * CHUNK * TILE, cy * CHUNK * TILE);
      }
    big.style.width = `${big.width * Number(params.get('zoom') ?? 1)}px`;
    big.style.imageRendering = 'pixelated';
    out.appendChild(big);
    info.textContent = `gen ${(t1 - t0).toFixed(0)}ms, ${city.buildings.length} buildings, ${city.props.length} props, paint ${(paintMs / (n * n)).toFixed(1)}ms/chunk`;
  } else {
    out.appendChild(mini);
    info.textContent = `gen ${(t1 - t0).toFixed(0)}ms, ${city.buildings.length} buildings, ${city.props.length} props, kinds: ${[...new Set(city.buildings.map((b) => b.kind))].join(', ')}`;
  }
}
