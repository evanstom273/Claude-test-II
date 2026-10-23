import type { Job } from './types';

/** One-shot events between the React UI and the Phaser world. */
export interface BusEvents {
  /** A job was accepted from the phone. */
  jobAccepted: { job: Job };
  jobCancelled: Record<string, never>;
  /** The player bought or changed clothes. */
  outfitChanged: { outfit: number };
  /** Bought a gun: the world refreshes the held weapon. */
  weaponsChanged: Record<string, never>;
  /** Respawn after being wasted or busted. */
  respawn: { at: 'hospital' | 'police' | 'home' };
  /** Clear the wanted level (clothes shop, respray). */
  clearWanted: Record<string, never>;
}

type Handler<T> = (payload: T) => void;

class Bus {
  private handlers = new Map<keyof BusEvents, Set<Handler<never>>>();

  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<BusEvents[K]>)(payload);
  }
}

export const bus = new Bus();
