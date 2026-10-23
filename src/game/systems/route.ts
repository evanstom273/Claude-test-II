import { B, T, TILE, type CityMap } from '../city/tiles';

/*
 * Route finding for cars that aren't following lanes (the police, mostly).
 * Dijkstra over tiles a car can drive on, preferring road and keeping away
 * from walls so the route is one a car can actually get round. The search is
 * boxed in around the start and goal so it stays cheap.
 */

const MARGIN = 24;

let cost = new Float32Array(0);
let prev = new Int32Array(0);
let heap = new Int32Array(0);
let heapKey = new Float32Array(0);
let stamp = new Int32Array(0);
let pass = 0;

function ensure(n: number) {
  if (cost.length >= n) return;
  cost = new Float32Array(n);
  prev = new Int32Array(n);
  heap = new Int32Array(n * 4);
  heapKey = new Float32Array(n * 4);
  stamp = new Int32Array(n);
}

/** What it costs a car to cross a tile, or Infinity if it can't. */
function tileCost(c: CityMap, x: number, y: number): number {
  const i = y * c.W + x;
  if (c.block[i] & B.CAR) return Infinity;
  const k = c.kind[i];
  if (k === T.WATER || k === T.WALL || k === T.FENCE) return Infinity;
  let cost = k === T.ROAD ? 1 : k === T.PARKING || k === T.CONCRETE ? 1.6 : 3;
  // Hugging walls gets cars stuck: make tiles next to anything solid dearer.
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= c.W || ny >= c.H || c.block[ny * c.W + nx] & B.CAR) cost += 3;
    }
  return cost;
}

/** Waypoints (tile centres, world pixels) from one point to another, or null if there's no way. */
export function roadPath(c: CityMap, sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const W = c.W;
  ensure(W * c.H);
  pass++;
  const s0x = Math.floor(sx / TILE);
  const s0y = Math.floor(sy / TILE);
  const g0x = Math.floor(gx / TILE);
  const g0y = Math.floor(gy / TILE);
  const x0 = Math.max(0, Math.min(s0x, g0x) - MARGIN);
  const y0 = Math.max(0, Math.min(s0y, g0y) - MARGIN);
  const x1 = Math.min(W - 1, Math.max(s0x, g0x) + MARGIN);
  const y1 = Math.min(c.H - 1, Math.max(s0y, g0y) + MARGIN);

  let size = 0;
  const push = (i: number, k: number) => {
    let n = size++;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (heapKey[p] <= k) break;
      heap[n] = heap[p];
      heapKey[n] = heapKey[p];
      n = p;
    }
    heap[n] = i;
    heapKey[n] = k;
  };
  const pop = () => {
    const top = heap[0];
    const lastI = heap[--size];
    const lastK = heapKey[size];
    let n = 0;
    for (;;) {
      let ch = n * 2 + 1;
      if (ch >= size) break;
      if (ch + 1 < size && heapKey[ch + 1] < heapKey[ch]) ch++;
      if (heapKey[ch] >= lastK) break;
      heap[n] = heap[ch];
      heapKey[n] = heapKey[ch];
      n = ch;
    }
    heap[n] = lastI;
    heapKey[n] = lastK;
    return top;
  };

  const start = s0y * W + s0x;
  const goal = g0y * W + g0x;
  stamp[start] = pass;
  cost[start] = 0;
  prev[start] = -1;
  push(start, 0);
  // If the goal itself can't be reached (the player is indoors), settle for the closest tile we got to.
  let best = start;
  let bestD = Infinity;
  while (size > 0) {
    const i = pop();
    const ix = i % W;
    const iy = (i - ix) / W;
    const d = Math.abs(ix - g0x) + Math.abs(iy - g0y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
    if (i === goal) break;
    if (heap.length - size < 8) break;
    const ci = cost[i];
    for (let dir = 0; dir < 4; dir++) {
      const nx = ix + (dir === 0 ? 1 : dir === 2 ? -1 : 0);
      const ny = iy + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
      const n = ny * W + nx;
      const step = n === goal ? 1 : tileCost(c, nx, ny);
      if (step === Infinity) continue;
      const nc = ci + step;
      if (stamp[n] === pass && cost[n] <= nc) continue;
      stamp[n] = pass;
      cost[n] = nc;
      prev[n] = i;
      push(n, nc + (Math.abs(nx - g0x) + Math.abs(ny - g0y)));
    }
  }
  if (best === start) return null;
  const out: { x: number; y: number }[] = [];
  for (let i = best; i !== -1 && i !== start; i = prev[i]) {
    const x = i % W;
    out.push({ x: x * TILE + 8, y: ((i - x) / W) * TILE + 8 });
  }
  return out.reverse();
}
