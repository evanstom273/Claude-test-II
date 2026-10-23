/** Input written by the on-screen touch controls and read by the game's Controls. */

export type TouchAction = 'attack' | 'bolt' | 'dash' | 'radiance' | 'interact' | 'potion1' | 'potion2' | 'potion3' | 'potion4';

export const touchInput = {
  /** Analogue stick, each axis -1..1. */
  x: 0,
  y: 0,
  presses: new Map<TouchAction, number>(),

  setStick(x: number, y: number) {
    this.x = x;
    this.y = y;
  },

  press(a: TouchAction) {
    this.presses.set(a, performance.now());
  },

  /** Read a press once, if it happened recently. */
  take(a: TouchAction, withinMs = 160): boolean {
    const t = this.presses.get(a);
    if (t === undefined) return false;
    this.presses.delete(a);
    return performance.now() - t <= withinMs;
  },

  clear() {
    this.presses.clear();
    this.x = 0;
    this.y = 0;
  },
};
