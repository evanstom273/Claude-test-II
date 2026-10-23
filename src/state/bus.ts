import type { AbilityId, ZoneId } from './types';

/** One-shot events passed between the React UI and the Phaser world. */
export interface BusEvents {
  levelUp: { level: number };
  ability: { id: AbilityId };
  /** Ask the world to (re)build itself from the current game data. */
  worldReload: { zone: ZoneId; spawn?: string };
  /** A dialogue finished; the world may want to react (cutscenes etc). */
  dialogueEnded: { id?: string };
  /** The Hearthlight's flame changed. */
  hearthlight: { embers: number };
  playerHealed: { amount: number };
  equipmentChanged: Record<string, never>;
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
