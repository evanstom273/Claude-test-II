export interface Line {
  /** Speaker name. Defaults to the NPC being spoken to. Use '' for narration. */
  who?: string;
  text: string;
  /** Portrait sprite key. Defaults to the NPC's sprite. */
  portrait?: string;
}

export interface Choice {
  label: string;
  /** Hide the choice unless this returns true. */
  when?: () => boolean;
  action?: () => void;
  then?: Dialogue;
}

export interface Dialogue {
  id?: string;
  lines: (Line | string)[];
  choices?: Choice[];
  /** Runs when the node's lines finish (when it has no choices). */
  onEnd?: () => void;
  /** Continue into another node after this one. */
  next?: Dialogue;
}

export function normLine(l: Line | string): Line {
  return typeof l === 'string' ? { text: l } : l;
}
