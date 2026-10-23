import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Job, Point } from './types';

export type Screen = 'title' | 'game';
export type Modal = 'pause' | 'map' | 'shop' | 'job' | 'settings' | 'wardrobe' | 'stats';

export type ToastKind = 'info' | 'cash' | 'warn' | 'job' | 'radio';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface ShopState {
  buildingId: number;
  kind: string;
  name: string;
}

export interface UIState {
  screen: Screen;
  modal: Modal | null;
  modalStack: Modal[];
  toasts: Toast[];
  /** Big centred text: WASTED, BUSTED, JOB COMPLETE... */
  big: { id: number; text: string; sub?: string; color: string } | null;
  /** Context action for the touch button and keyboard hint. */
  prompt: string | null;
  wanted: number;
  /** Stars flash while the cops have lost sight of you. */
  wantedFlashing: boolean;
  inCar: { name: string; hp: number } | null;
  station: string | null;
  shop: ShopState | null;
  jobOffer: Job | null;
  /** Minimap markers in world px. */
  markers: (Point & { kind: 'job' | 'phone' | 'shop' | 'home' })[];
  player: Point;
  hurtAt: number;
}

export const uiStore = createStore<UIState>()(() => ({
  screen: 'title',
  modal: null,
  modalStack: [],
  toasts: [],
  big: null,
  prompt: null,
  wanted: 0,
  wantedFlashing: false,
  inCar: null,
  station: null,
  shop: null,
  jobOffer: null,
  markers: [],
  player: { x: 0, y: 0 },
  hurtAt: 0,
}));

export function useUI<T>(selector: (s: UIState) => T): T {
  return useStore(uiStore, selector);
}

let toastId = 0;

export const ui = {
  get: () => uiStore.getState(),
  set: (patch: Partial<UIState>) => uiStore.setState(patch),
  setScreen(screen: Screen) {
    uiStore.setState({ screen, modal: null, modalStack: [], big: null, prompt: null, wanted: 0, inCar: null, station: null, shop: null, jobOffer: null });
  },
  open(modal: Modal) {
    const { modal: cur, modalStack } = uiStore.getState();
    if (cur === modal) return;
    uiStore.setState({ modal, modalStack: cur ? [...modalStack, cur] : modalStack });
  },
  close() {
    const { modalStack } = uiStore.getState();
    const prev = modalStack[modalStack.length - 1] ?? null;
    uiStore.setState({ modal: prev, modalStack: modalStack.slice(0, -1) });
  },
  closeAll() {
    uiStore.setState({ modal: null, modalStack: [], shop: null, jobOffer: null });
  },
  toast(text: string, kind: ToastKind = 'info', ms = 2600) {
    const t = { id: ++toastId, text, kind };
    uiStore.setState((s) => ({ toasts: [...s.toasts.filter((x) => !(kind === 'radio' && x.kind === 'radio')).slice(-3), t] }));
    window.setTimeout(() => uiStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), ms);
  },
  bigText(text: string, color = '#ffd84f', sub?: string, ms = 2400) {
    const id = ++toastId;
    uiStore.setState({ big: { id, text, sub, color } });
    window.setTimeout(() => {
      if (uiStore.getState().big?.id === id) uiStore.setState({ big: null });
    }, ms);
  },
  hurt() {
    uiStore.setState({ hurtAt: performance.now() });
  },
};
