import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Dialogue } from '../data/dialogue';

export type Screen = 'title' | 'game';

export type Modal =
  | 'pause'
  | 'inventory'
  | 'journal'
  | 'map'
  | 'shop'
  | 'dialogue'
  | 'gameover'
  | 'ending'
  | 'settings'
  | 'controls';

export type ToastKind = 'item' | 'quest' | 'level' | 'info' | 'warn';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
  icon?: string;
}

export interface ActiveDialogue {
  /** The node currently on screen. */
  node: Dialogue;
  /** Index of the line within the node. */
  line: number;
  /** Portrait sprite key used when a line has no explicit portrait. */
  portrait?: string;
  speaker?: string;
}

export interface BossBar {
  name: string;
  hp: number;
  maxHp: number;
}

export interface Cooldowns {
  bolt: number;
  dash: number;
  radiance: number;
}

export interface UIState {
  screen: Screen;
  modal: Modal | null;
  /** Stack of modals to return to (e.g. settings opened from pause). */
  modalStack: Modal[];
  shopId: string | null;
  dialogue: ActiveDialogue | null;
  toasts: Toast[];
  banner: { id: number; title: string; subtitle?: string } | null;
  boss: BossBar | null;
  prompt: string | null;
  /** 0..1 fraction of each ability's cooldown remaining. */
  cooldowns: Cooldowns;
  saving: boolean;
  /** Bumped whenever the HUD should briefly flash red. */
  hurtTick: number;
}

const initial: UIState = {
  screen: 'title',
  modal: null,
  modalStack: [],
  shopId: null,
  dialogue: null,
  toasts: [],
  banner: null,
  boss: null,
  prompt: null,
  cooldowns: { bolt: 0, dash: 0, radiance: 0 },
  saving: false,
  hurtTick: 0,
};

export const uiStore = createStore<UIState>()(() => initial);

export function useUI<T>(selector: (s: UIState) => T): T {
  return useStore(uiStore, selector);
}

let toastId = 1;

export const ui = {
  get: () => uiStore.getState(),

  reset() {
    uiStore.setState({ ...initial, screen: uiStore.getState().screen });
  },

  setScreen(screen: Screen) {
    uiStore.setState({ screen, modal: null, modalStack: [], dialogue: null, boss: null, prompt: null, banner: null });
  },

  open(modal: Modal) {
    const { modal: current, modalStack } = uiStore.getState();
    if (current === modal) return;
    uiStore.setState({ modal, modalStack: current ? [...modalStack, current] : modalStack });
  },

  /** Close the current modal, returning to the one beneath it if any. */
  close() {
    const { modalStack } = uiStore.getState();
    const next = modalStack[modalStack.length - 1] ?? null;
    uiStore.setState({ modal: next, modalStack: modalStack.slice(0, -1), ...(next ? {} : { shopId: null }) });
  },

  closeAll() {
    uiStore.setState({ modal: null, modalStack: [], shopId: null, dialogue: null });
  },

  openShop(shopId: string) {
    uiStore.setState({ modal: 'shop', modalStack: [], shopId });
  },

  toast(text: string, kind: ToastKind = 'info', icon?: string) {
    const id = toastId++;
    uiStore.setState((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind, icon }] }));
    setTimeout(() => {
      uiStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, kind === 'level' || kind === 'quest' ? 4200 : 3200);
  },

  banner(title: string, subtitle?: string) {
    const id = toastId++;
    uiStore.setState({ banner: { id, title, subtitle } });
    setTimeout(() => {
      if (uiStore.getState().banner?.id === id) uiStore.setState({ banner: null });
    }, 3200);
  },

  setBoss(boss: BossBar | null) {
    uiStore.setState({ boss });
  },

  setPrompt(prompt: string | null) {
    if (uiStore.getState().prompt !== prompt) uiStore.setState({ prompt });
  },

  setCooldowns(c: Cooldowns) {
    const cur = uiStore.getState().cooldowns;
    if (cur.bolt !== c.bolt || cur.dash !== c.dash || cur.radiance !== c.radiance) uiStore.setState({ cooldowns: c });
  },

  hurt() {
    uiStore.setState((s) => ({ hurtTick: s.hurtTick + 1 }));
  },
};
