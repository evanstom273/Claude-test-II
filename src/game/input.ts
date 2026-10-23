import Phaser from 'phaser';

export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'bolt' | 'dash' | 'radiance' | 'interact' | 'potion1' | 'potion2' | 'potion3' | 'potion4';

const K = Phaser.Input.Keyboard.KeyCodes;

const BINDINGS: Record<Action, number[]> = {
  up: [K.W, K.UP],
  down: [K.S, K.DOWN],
  left: [K.A, K.LEFT],
  right: [K.D, K.RIGHT],
  attack: [K.J, K.SPACE],
  bolt: [K.K],
  dash: [K.L, K.SHIFT],
  radiance: [K.R],
  interact: [K.E, K.ENTER],
  potion1: [K.ONE],
  potion2: [K.TWO],
  potion3: [K.THREE],
  potion4: [K.FOUR],
};

export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  /** Actions pressed this frame, captured so they can be read once. */
  private buffered = new Map<Action, number>();
  private suppressUntil = 0;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    for (const [action, codes] of Object.entries(BINDINGS) as [Action, number[]][]) {
      const keys = codes.map((c) => kb.addKey(c, false, false));
      for (const k of keys) {
        k.on('down', () => {
          if (performance.now() >= this.suppressUntil) this.buffered.set(action, scene.time.now);
        });
      }
      this.keys.set(action, keys);
    }
  }

  down(a: Action): boolean {
    return this.keys.get(a)!.some((k) => k.isDown);
  }

  /** True once per press. Presses are remembered briefly so quick taps aren't lost. */
  pressed(a: Action, bufferMs = 120): boolean {
    const t = this.buffered.get(a);
    if (t === undefined) return false;
    if (this.scene.time.now - t > bufferMs) {
      this.buffered.delete(a);
      return false;
    }
    this.buffered.delete(a);
    return true;
  }

  axis(): { x: number; y: number } {
    const x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    const y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    return { x, y };
  }

  /** Ignore presses for a moment, e.g. the key that just closed a menu. */
  suppress(ms = 150) {
    this.suppressUntil = performance.now() + ms;
    this.buffered.clear();
  }

  reset() {
    this.buffered.clear();
    for (const keys of this.keys.values()) for (const k of keys) k.reset();
  }
}
