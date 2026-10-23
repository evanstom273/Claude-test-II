import { FRAMES } from '../game/art/registry';
import { drawRows, spriteSize } from '../game/art/pixels';

const out = document.getElementById('out')!;
const filter = new URLSearchParams(location.search).get('f');
const scale = Number(new URLSearchParams(location.search).get('s') ?? 4);
for (const f of FRAMES) {
  if (filter && !f.key.match(new RegExp(filter))) continue;
  const { w, h } = spriteSize(f.rows);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  drawRows(c.getContext('2d')!, f.rows, f.palette, 0, 0);
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.appendChild(c);
  const label = document.createElement('div');
  label.textContent = f.key;
  cell.appendChild(label);
  out.appendChild(cell);
}
