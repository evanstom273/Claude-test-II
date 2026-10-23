import type { ProcItem } from './procedural';

/*
 * Street furniture, interiors, weapons and pickups, drawn with small canvas
 * routines. Furniture is a box seen from above at a slant: a lit top, a darker
 * front, a dark outline. World props are at world resolution (16px a tile);
 * held weapons are at the people's resolution (twice that).
 */

type Ctx = CanvasRenderingContext2D;

const OUT = '#1a1423';

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** A box: top face, front face of `depth` px, outline. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, depth: number, top: string, front: string, hi?: string) {
  rect(ctx, x, y, w, h, OUT);
  rect(ctx, x + 1, y + 1, w - 2, h - depth - 2, top);
  rect(ctx, x + 1, y + h - depth - 1, w - 2, depth, front);
  if (hi) rect(ctx, x + 1, y + 1, w - 2, 1, hi);
}

function disc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) ctx.fillRect(x, y, 1, 1);
}

const items: ProcItem[] = [];
const add = (key: string, w: number, h: number, draw: (ctx: Ctx) => void) =>
  items.push({
    key,
    w,
    h,
    draw: (ctx, ox, oy) => {
      ctx.save();
      ctx.translate(ox, oy);
      draw(ctx);
      ctx.restore();
    },
  });

// ---- Street ---------------------------------------------------------------------

add('lamp', 12, 34, (c) => {
  rect(c, 5, 6, 3, 27, OUT);
  rect(c, 6, 7, 1, 25, '#5a5a66');
  rect(c, 3, 31, 7, 3, OUT);
  rect(c, 4, 32, 5, 1, '#46464f');
  rect(c, 1, 1, 10, 6, OUT);
  rect(c, 2, 2, 8, 3, '#3a3a44');
  rect(c, 3, 5, 6, 1, '#fff2b0');
});
add('tree', 30, 34, (c) => {
  rect(c, 13, 22, 5, 12, OUT);
  rect(c, 14, 23, 3, 10, '#6a4a2e');
  disc(c, 15, 14, 14, 13, OUT);
  disc(c, 15, 14, 13, 12, '#2f6a2a');
  disc(c, 13, 12, 10, 9, '#3f8436');
  disc(c, 11, 9, 6, 5, '#58a04a');
  for (const [x, y] of [[20, 18], [8, 17], [18, 7], [23, 12]]) disc(c, x, y, 2.5, 2, '#2a5a26');
});
add('tree_dead', 26, 32, (c) => {
  rect(c, 12, 10, 3, 22, OUT);
  rect(c, 13, 11, 1, 20, '#5a4030');
  for (const [x, y, l, d] of [[13, 14, 8, -1], [13, 18, 7, 1], [13, 10, 6, -1]]) for (let i = 0; i < l; i++) rect(c, x + i * d, y - Math.floor(i / 2), 1, 1, '#5a4030');
});
add('bush', 18, 14, (c) => {
  disc(c, 9, 7, 9, 7, OUT);
  disc(c, 9, 7, 8, 6, '#2f6a2a');
  disc(c, 7, 5, 5, 3.5, '#4a8a3e');
});
add('bin', 10, 13, (c) => {
  box(c, 0, 0, 10, 13, 8, '#3a4a3a', '#2e3e30', '#5a6a5a');
  rect(c, 2, 6, 6, 1, '#1e2a20');
});
add('bench', 16, 10, (c) => {
  box(c, 0, 0, 16, 7, 3, '#8a5a34', '#6a4224', '#a87048');
  rect(c, 1, 7, 2, 3, OUT);
  rect(c, 13, 7, 2, 3, OUT);
});
add('hydrant', 8, 11, (c) => {
  rect(c, 1, 2, 6, 9, OUT);
  rect(c, 2, 3, 4, 7, '#c23b3b');
  rect(c, 0, 5, 8, 2, OUT);
  rect(c, 2, 1, 4, 2, OUT);
  rect(c, 3, 3, 1, 4, '#e86a5a');
});
add('payphone', 12, 26, (c) => {
  box(c, 0, 0, 12, 26, 20, '#c23b3b', '#a82a2a', '#e85a4a');
  rect(c, 2, 8, 8, 12, '#2a3a4a');
  rect(c, 3, 9, 3, 4, '#8ab4d8');
  rect(c, 7, 13, 2, 4, '#1a1a1e');
  rect(c, 2, 2, 8, 3, '#f4efe4');
});
add('bollard', 8, 9, (c) => {
  box(c, 0, 0, 8, 9, 5, '#3a3a40', '#2a2a30', '#5a5a64');
});
add('dumpster', 18, 14, (c) => {
  box(c, 0, 0, 18, 14, 7, '#3a6a3a', '#2e5a2e', '#4a8a4a');
  rect(c, 2, 9, 14, 1, '#1e3a1e');
});
add('neon_frame', 4, 4, (c) => rect(c, 0, 0, 4, 4, '#ffffff'));

// ---- Doors (world size, one per orientation and state) ---------------------------

add('door_h', 16, 16, (c) => {
  rect(c, 1, 2, 14, 13, OUT);
  rect(c, 2, 3, 12, 11, '#7a4a2a');
  rect(c, 3, 4, 10, 4, '#8a5a34');
  rect(c, 3, 9, 10, 4, '#8a5a34');
  rect(c, 11, 9, 2, 2, '#f2c14e');
});
add('door_h_open', 16, 16, (c) => {
  rect(c, 1, 2, 3, 13, OUT);
  rect(c, 2, 3, 1, 11, '#7a4a2a');
});
add('door_v', 16, 16, (c) => {
  rect(c, 6, 0, 4, 16, OUT);
  rect(c, 7, 1, 2, 14, '#7a4a2a');
});
add('door_v_open', 16, 16, (c) => {
  rect(c, 6, 0, 10, 3, OUT);
  rect(c, 7, 1, 8, 1, '#7a4a2a');
});

// ---- Furniture ---------------------------------------------------------------------

add('counter', 16, 14, (c) => box(c, 0, 0, 16, 14, 6, '#b8a07a', '#6a4a2e', '#d0bc98'));
add('register', 16, 18, (c) => {
  box(c, 0, 4, 16, 14, 6, '#b8a07a', '#6a4a2e', '#d0bc98');
  box(c, 4, 0, 9, 10, 4, '#3a3a44', '#2a2a32', '#5a5a66');
  rect(c, 6, 2, 5, 2, '#5aff8a');
});
add('shelf', 16, 18, (c) => {
  box(c, 0, 0, 16, 18, 12, '#6a5a4a', '#4a3a2e');
  const goods = ['#c23b3b', '#3a6ab0', '#f2c14e', '#3f8f6a', '#e8e4dc', '#d26a9a'];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) rect(c, 2 + i * 3, 7 + row * 3, 2, 2, goods[(row * 4 + i) % goods.length]);
});
add('fridge', 14, 20, (c) => {
  box(c, 0, 0, 14, 20, 14, '#d8d8e0', '#b8b8c4', '#f0f0f8');
  rect(c, 2, 7, 10, 10, '#8ab4d8');
  for (let i = 0; i < 3; i++) rect(c, 3 + i * 3, 9, 2, 6, ['#c23b3b', '#f2c14e', '#3f8f6a'][i]);
});
add('table', 16, 14, (c) => {
  box(c, 0, 0, 16, 11, 3, '#9a6a44', '#6a4628', '#b07e54');
  rect(c, 1, 11, 2, 3, OUT);
  rect(c, 13, 11, 2, 3, OUT);
});
add('chair', 10, 12, (c) => box(c, 0, 0, 10, 12, 5, '#8a5a34', '#6a4224', '#a87048'));
add('stool', 8, 9, (c) => {
  disc(c, 4, 3, 4, 3, OUT);
  disc(c, 4, 3, 3, 2, '#c23b3b');
  rect(c, 3, 5, 2, 4, OUT);
});
add('bed', 16, 28, (c) => {
  box(c, 0, 0, 16, 28, 4, '#e8e4dc', '#8a6a4a');
  rect(c, 2, 2, 12, 5, '#f8f4ec');
  rect(c, 1, 9, 14, 14, '#3a6ab0');
  rect(c, 1, 9, 14, 1, '#5a8ad0');
});
add('hospbed', 16, 26, (c) => {
  box(c, 0, 0, 16, 26, 4, '#f0f0f4', '#9aa0aa');
  rect(c, 2, 2, 12, 4, '#ffffff');
  rect(c, 1, 8, 14, 13, '#8ac8b8');
});
add('sofa', 16, 14, (c) => {
  box(c, 0, 0, 16, 14, 6, '#7a3a4a', '#5a2a36', '#9a4a5a');
  rect(c, 1, 1, 14, 3, '#5a2a36');
});
add('tv', 14, 13, (c) => {
  box(c, 0, 0, 14, 13, 4, '#2a2a32', '#1e1e24');
  rect(c, 2, 2, 10, 6, '#4a8ad8');
  rect(c, 3, 3, 3, 2, '#9ad0ff');
});
add('safe', 14, 14, (c) => {
  box(c, 0, 0, 14, 14, 8, '#6a6a74', '#4a4a54', '#8a8a96');
  disc(c, 7, 9.5, 2.5, 2.5, '#2a2a32');
  rect(c, 6, 9, 3, 1, '#f2c14e');
});
add('plant', 12, 18, (c) => {
  box(c, 2, 11, 8, 7, 4, '#8a4a2a', '#6a3a1e');
  disc(c, 6, 7, 6, 6, OUT);
  disc(c, 6, 7, 5, 5, '#3f8436');
  disc(c, 5, 5, 2.5, 2, '#58a04a');
});
add('desk', 16, 14, (c) => {
  box(c, 0, 2, 16, 12, 4, '#a88a6a', '#7a5e44', '#c0a484');
  box(c, 6, 0, 8, 8, 2, '#3a3a44', '#2a2a32');
  rect(c, 7, 1, 6, 4, '#5ab0e8');
});
add('crate', 16, 16, (c) => {
  box(c, 0, 0, 16, 16, 6, '#a07a4a', '#7a5a34', '#c09a64');
  rect(c, 1, 4, 14, 1, '#7a5a34');
  rect(c, 7, 1, 2, 9, '#7a5a34');
});
for (const [i, col] of ['#c23b3b', '#3a6ab0', '#3f8f6a', '#d9a03a'].entries()) {
  add(`container_${i}`, 32, 18, (c) => {
    box(c, 0, 0, 32, 18, 7, col, col);
    for (let x = 2; x < 31; x += 3) rect(c, x, 1, 1, 9, 'rgba(0,0,0,0.25)');
    rect(c, 1, 1, 30, 1, 'rgba(255,255,255,0.25)');
    rect(c, 1, 11, 30, 6, 'rgba(0,0,0,0.3)');
  });
}
add('pooltable', 32, 18, (c) => {
  box(c, 0, 0, 32, 18, 4, '#5a3a24', '#3a2416');
  rect(c, 2, 2, 28, 10, '#2f7a3a');
  for (const [x, y] of [[2, 2], [15, 2], [29, 2], [2, 11], [15, 11], [29, 11]]) rect(c, x, y, 1, 1, OUT);
  rect(c, 8, 6, 1, 1, '#f4efe4');
  rect(c, 20, 5, 1, 1, '#c23b3b');
  rect(c, 22, 8, 1, 1, '#f2c14e');
});
add('jukebox', 14, 18, (c) => {
  box(c, 0, 0, 14, 18, 10, '#8a3a6a', '#6a2a50', '#d84a98');
  disc(c, 7, 5, 5, 4, '#ffd84f');
  rect(c, 3, 10, 8, 4, '#4fe8ff');
});
add('rack', 16, 16, (c) => {
  rect(c, 1, 2, 14, 2, OUT);
  rect(c, 1, 2, 1, 14, OUT);
  rect(c, 14, 2, 1, 14, OUT);
  const cols = ['#c23b3b', '#3a6ab0', '#e8e4dc', '#3f8f6a', '#2d2d38'];
  for (let i = 0; i < 5; i++) rect(c, 2 + Math.floor(i * 2.4), 4, 2, 9, cols[i]);
});
add('gunrack', 16, 16, (c) => {
  box(c, 0, 0, 16, 16, 12, '#5a4a3a', '#4a3a2e');
  for (let i = 0; i < 3; i++) {
    rect(c, 2, 5 + i * 3, 12, 1, '#2a2a32');
    rect(c, 3, 6 + i * 3, 2, 1, '#2a2a32');
  }
});
add('cell', 16, 18, (c) => {
  for (let x = 1; x < 16; x += 3) rect(c, x, 0, 1, 18, '#6a6a74');
  rect(c, 0, 0, 16, 1, '#4a4a54');
  rect(c, 0, 8, 16, 1, '#4a4a54');
});
add('wardrobe', 16, 22, (c) => {
  box(c, 0, 0, 16, 22, 16, '#7a5232', '#5a3a22', '#9a6a44');
  rect(c, 7, 7, 1, 13, OUT);
  rect(c, 5, 12, 1, 2, '#f2c14e');
  rect(c, 9, 12, 1, 2, '#f2c14e');
});
add('mirror', 12, 18, (c) => {
  rect(c, 0, 0, 12, 18, OUT);
  rect(c, 1, 1, 10, 16, '#c0d8e8');
  rect(c, 2, 2, 3, 6, '#f0f8ff');
});
add('booth', 16, 14, (c) => box(c, 0, 0, 16, 14, 7, '#6a2a6a', '#4a1e4a', '#8a3a8a'));
add('cooler', 10, 18, (c) => {
  box(c, 0, 8, 10, 10, 6, '#d8d8e0', '#b8b8c4');
  disc(c, 5, 4, 4, 4, OUT);
  disc(c, 5, 4, 3, 3, '#8ac8f0');
});

// ---- Pickups (world size) ----------------------------------------------------------

add('cash', 12, 9, (c) => {
  box(c, 0, 0, 12, 9, 3, '#5aa04a', '#3f7a32', '#8ad06a');
  rect(c, 5, 1, 2, 5, '#2f6a2a');
});
add('medkit', 12, 10, (c) => {
  box(c, 0, 0, 12, 10, 3, '#f0ece4', '#c8c4bc');
  rect(c, 5, 2, 2, 5, '#d64545');
  rect(c, 3, 3, 6, 2, '#d64545');
});
add('burger', 12, 9, (c) => {
  disc(c, 6, 3, 6, 3, OUT);
  disc(c, 6, 3, 5, 2, '#d9a03a');
  rect(c, 1, 4, 10, 2, '#5a2e1e');
  rect(c, 1, 5, 10, 1, '#5aa04a');
  rect(c, 1, 6, 10, 2, '#c89a4a');
  rect(c, 1, 8, 10, 1, OUT);
});
add('ammo', 12, 9, (c) => {
  box(c, 0, 0, 12, 9, 3, '#5a6a3a', '#3a4a26', '#7a8a4a');
  rect(c, 2, 2, 8, 2, '#f2c14e');
});
add('package', 12, 11, (c) => {
  box(c, 0, 0, 12, 11, 4, '#c8a06a', '#9a7a4a', '#e0bc84');
  rect(c, 5, 1, 2, 9, '#7a5a34');
});
add('briefcase', 14, 11, (c) => {
  rect(c, 5, 0, 4, 2, OUT);
  box(c, 0, 1, 14, 10, 4, '#3a2a20', '#2a1e16', '#5a4030');
  rect(c, 6, 4, 2, 1, '#f2c14e');
});

// ---- Weapons (people resolution: drawn facing right, held at the left end) -----------

add('w_pistol', 14, 8, (c) => {
  rect(c, 0, 0, 13, 4, OUT);
  rect(c, 1, 1, 11, 2, '#4a4a54');
  rect(c, 1, 1, 11, 1, '#7a7a86');
  rect(c, 1, 3, 4, 5, OUT);
  rect(c, 2, 4, 2, 3, '#3a2a20');
});
add('w_smg', 20, 9, (c) => {
  rect(c, 0, 1, 19, 4, OUT);
  rect(c, 1, 2, 17, 2, '#3a3a44');
  rect(c, 1, 2, 17, 1, '#6a6a76');
  rect(c, 5, 4, 3, 5, OUT);
  rect(c, 11, 4, 2, 4, OUT);
  rect(c, 6, 5, 1, 3, '#2a2a32');
});
add('w_shotgun', 26, 7, (c) => {
  rect(c, 0, 1, 25, 4, OUT);
  rect(c, 7, 2, 17, 1, '#5a5a66');
  rect(c, 7, 3, 17, 1, '#3a3a44');
  rect(c, 1, 2, 7, 3, '#6a4a2e');
  rect(c, 13, 4, 6, 3, OUT);
  rect(c, 14, 5, 4, 1, '#6a4a2e');
});
add('w_bat', 26, 6, (c) => {
  rect(c, 0, 1, 26, 4, OUT);
  rect(c, 1, 2, 6, 2, '#3a2a20');
  rect(c, 7, 2, 18, 2, '#c8a06a');
  rect(c, 12, 2, 13, 1, '#e0bc84');
});

// ---- Effects --------------------------------------------------------------------------

for (let i = 0; i < 3; i++) {
  add(`blood_${i}`, 16, 12, (c) => {
    const spots = [
      [[8, 6, 5, 3.5], [3, 4, 2, 1.5], [13, 8, 2, 1.5]],
      [[7, 7, 6, 3], [12, 3, 1.5, 1.5], [2, 9, 1.5, 1]],
      [[9, 5, 4.5, 4], [4, 9, 2.5, 1.5], [14, 3, 1, 1]],
    ][i];
    for (const [x, y, rx, ry] of spots) disc(c, x, y, rx, ry, '#7a1a22');
    for (const [x, y, rx, ry] of spots) disc(c, x - 0.5, y - 0.5, rx * 0.6, ry * 0.6, '#9a2430');
  });
}
add('scorch', 34, 22, (c) => {
  disc(c, 17, 11, 17, 11, 'rgba(20,16,20,0.55)');
  disc(c, 17, 11, 11, 7, 'rgba(10,8,10,0.6)');
});
add('skid', 4, 3, (c) => rect(c, 0, 0, 4, 3, 'rgba(20,18,24,0.35)'));
add('flash', 9, 9, (c) => {
  disc(c, 4.5, 4.5, 4.5, 2, '#ffd84f');
  disc(c, 4.5, 4.5, 2, 4.5, '#ffd84f');
  disc(c, 4.5, 4.5, 2, 2, '#ffffff');
});
for (let i = 0; i < 4; i++) {
  add(`boom_${i}`, 40, 40, (c) => {
    const rr = [8, 14, 18, 19][i];
    const cols = [['#ffffff', '#fff3b0'], ['#fff3b0', '#ffb040'], ['#ffb040', '#d84a2a'], ['#5a4a4a', '#3a3036']][i];
    disc(c, 20, 20, rr, rr, cols[1]);
    disc(c, 20, 20, rr * 0.6, rr * 0.6, cols[0]);
    if (i >= 2) for (const [x, y] of [[10, 12], [28, 14], [14, 28], [27, 27]]) disc(c, x, y, 4, 4, i === 3 ? '#4a4044' : '#ff7a3a');
  });
}
add('star', 11, 11, (c) => {
  const pts = [[5, 0], [6, 3], [10, 4], [7, 6], [8, 10], [5, 8], [2, 10], [3, 6], [0, 4], [4, 3]];
  c.fillStyle = '#ffd84f';
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x + 0.5, y + 0.5) : c.moveTo(x + 0.5, y + 0.5)));
  c.closePath();
  c.fill();
});

add('arrow', 12, 11, (c) => {
  c.fillStyle = OUT;
  for (let y = 0; y < 11; y++) {
    const half = 5.5 - Math.abs(y - 5);
    c.fillRect(0, y, Math.max(1, Math.round(half * 2.2)), 1);
  }
  c.fillStyle = '#ffd84f';
  for (let y = 1; y < 10; y++) {
    const half = 4.5 - Math.abs(y - 5);
    if (half > 0) c.fillRect(1, y, Math.max(1, Math.round(half * 2.2) - 1), 1);
  }
});

export const PROPS: ProcItem[] = items;
