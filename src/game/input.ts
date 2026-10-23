import Phaser from 'phaser';
import { touchInput, type TouchAction } from './touchInput';

export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'interact' | 'weapon' | 'handbrake' | 'radio' | 'horn' | 'sprint' | 'eat';

const K = Phaser.Input.Keyboard.KeyCodes;

const BINDINGS: Record<Action, number[]> = {
  up: [K.W, K.UP],
  down: [K.S, K.DOWN],
  left: [K.A, K.LEFT],
  right: [K.D, K.RIGHT],
  attack: [K.J, K.SPACE],
  interact: [K.E, K.ENTER, K.F],
  weapon: [K.Q, K.TAB],
  handbrake: [K.SHIFT, K.K],
  sprint: [K.SHIFT],
  radio: [K.R],
  horn: [K.H],
  eat: [K.X],
};

/** Keyboard, mouse and touch, merged. */
export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  /** Frame number each action was pressed on, so slow frames never drop a tap. */
  private buffered = new Map<Action, number>();
  private frame = 0;
  private suppressUntil = 0;
  /** Mouse position on screen, and whether the button is held. */
  mouse = { x: 0, y: 0, down: false, movedAt: -1e9, clicked: false };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    for (const [action, codes] of Object.entries(BINDINGS) as [Action, number[]][]) {
      const keys = codes.map((c) => kb.addKey(c, false, false));
      for (const k of keys)
        k.on('down', () => {
          if (performance.now() >= this.suppressUntil) this.buffered.set(action, this.frame);
        });
      this.keys.set(action, keys);
    }
  }

  /** Track the mouse on the game canvas (desktop aiming). */
  attachMouse(canvas: HTMLCanvasElement) {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
      this.mouse.movedAt = performance.now();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      move(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false;
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }

  down(a: Action): boolean {
    if (a !== 'up' && a !== 'down' && a !== 'left' && a !== 'right' && touchInput.held.has(a as TouchAction)) return true;
    if (a === 'attack' && this.mouse.down) return true;
    return this.keys.get(a)!.some((k) => k.isDown);
  }

  /** Call once at the start of every update. */
  tick() {
    this.frame++;
  }

  /** True once per press, if it happened in the last couple of frames. */
  pressed(a: Action): boolean {
    if (a !== 'up' && a !== 'down' && a !== 'left' && a !== 'right' && touchInput.take(a as TouchAction)) return true;
    if (a === 'attack' && this.mouse.clicked) {
      this.mouse.clicked = false;
      return true;
    }
    const f = this.buffered.get(a);
    if (f === undefined) return false;
    this.buffered.delete(a);
    return this.frame - f <= 3;
  }

  /** Movement input. `analog` is true when it came from the touch stick. */
  axis(): { x: number; y: number; analog: boolean } {
    const x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    const y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (x === 0 && y === 0 && (touchInput.x !== 0 || touchInput.y !== 0)) return { x: touchInput.x, y: touchInput.y, analog: true };
    return { x, y, analog: false };
  }

  suppress(ms = 150) {
    this.suppressUntil = performance.now() + ms;
    this.buffered.clear();
    this.mouse.clicked = false;
    touchInput.presses.clear();
  }

  reset() {
    this.buffered.clear();
    this.mouse.down = false;
    this.mouse.clicked = false;
    for (const keys of this.keys.values()) for (const k of keys) k.reset();
  }
}
