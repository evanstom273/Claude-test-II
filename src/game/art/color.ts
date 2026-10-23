/** Colour helpers for building palettes from a single base colour. */

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Move a hue towards a target hue by up to `amount` degrees. */
function hueToward(h: number, target: number, amount: number) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amount);
}

/**
 * Four tones from one base colour: highlight, base, shade, deep.
 * Shadows lean cool and highlights warm, which reads richer than plain dark/light.
 */
export function ramp(hex: string): [string, string, string, string] {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  const tone = (dl: number, toward: number, shift: number, ds: number) => {
    const hh = s < 0.06 ? h : hueToward(h, toward, shift);
    return rgbToHex(...hslToRgb(hh, Math.max(0, Math.min(1, s + ds)), Math.max(0.03, Math.min(0.97, l + dl))));
  };
  return [tone(0.13, 50, 6, -0.04), hex, tone(-0.14, 235, 8, 0.04), tone(-0.26, 245, 14, 0.06)];
}

/** Mix two colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}

/** Pack '#rrggbb' as 0xAABBGGRR for writing straight into ImageData. */
export function packABGR(hex: string, alpha = 255): number {
  const [r, g, b] = hexToRgb(hex);
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}
