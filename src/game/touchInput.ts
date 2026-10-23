/** Input written by the on-screen touch controls and read by the game's Controls. */

export type TouchAction = 'attack' | 'interact' | 'weapon' | 'handbrake' | 'radio' | 'horn' | 'sprint' | 'eat';

export const touchInput = {
  /** Analogue stick, each axis -1..1. */
  x: 0,
  y: 0,
  /** Buttons held down right now. */
  held: new Set<TouchAction>(),
  presses: new Map<TouchAction, number>(),

  setStick(x: number, y: number) {
    this.x = x;
    this.y = y;
  },

  press(a: TouchAction) {
    this.presses.set(a, performance.now());
    this.held.add(a);
  },

  release(a: TouchAction) {
    this.held.delete(a);
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
    this.held.clear();
    this.x = 0;
    this.y = 0;
  },
};
