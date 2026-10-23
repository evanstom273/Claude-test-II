import { MAPS } from '../data/maps';
import { parseMap } from '../game/world/parse';
import { renderMap } from '../game/world/render';
import type { ZoneId } from '../state/types';

const q = new URLSearchParams(location.search);
const zone = (q.get('z') ?? 'village') as ZoneId;
const scale = Number(q.get('s') ?? 2);
const crop = q.get('c')?.split(',').map(Number); // x,y,w,h in tiles
const map = parseMap(MAPS[zone]);
const r = renderMap(map);
const out = document.createElement('canvas');
const [cx, cy, cw, ch] = crop ?? [0, 0, map.w, map.h];
out.width = cw * 16;
out.height = ch * 16;
out.style.width = `${cw * 16 * scale}px`;
out.style.height = `${ch * 16 * scale}px`;
const ctx = out.getContext('2d')!;
ctx.drawImage(r.ground, -cx * 16, -cy * 16);
ctx.drawImage(r.overhead, -cx * 16, -cy * 16);
document.getElementById('out')!.appendChild(out);
