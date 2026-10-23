import type { GameData, QuestId } from '../state/types';

export const EMBERS = [
  { id: 'verdant_ember', key: 'verdant', name: 'Verdant Ember', where: 'Whisperwood, north of the village' },
  { id: 'stone_ember', key: 'stone', name: 'Stone Ember', where: 'Hollowdeep Mine, along the east road' },
  { id: 'tide_ember', key: 'tide', name: 'Tide Ember', where: 'the Drowned Chapel in Saltmere, to the south' },
] as const;

export function embersPlaced(d: GameData): number {
  return EMBERS.filter((e) => d.flags[`placed:${e.key}`]).length;
}

export const SLIME_GOAL = 10;
export const GLOWCAP_GOAL = 5;
export const MASTERWORK_COST = 300;

export function slimesSlainForQuest(d: GameData): number {
  const base = Number(d.flags['slimes_base'] ?? 0);
  const total = (d.killsByType['slime'] ?? 0) + (d.killsByType['bog_slime'] ?? 0) + (d.killsByType['cave_slime'] ?? 0);
  return Math.max(0, total - base);
}

export interface QuestDef {
  id: QuestId;
  title: string;
  giver: string;
  main?: boolean;
  /** Lines describing what to do next. */
  objective: (d: GameData) => string[];
  /** Short line shown once the quest is complete. */
  done: string;
}

export const QUESTS: Record<QuestId, QuestDef> = {
  main: {
    id: 'main',
    title: 'The Guttering Flame',
    giver: 'Keeper Maren',
    main: true,
    done: 'The Hollow King is gone, and dawn has come to Emberhold.',
    objective: (d) => {
      const q = d.quests.main;
      if (!q || q.stage === 0) return ['Speak with Keeper Maren by the Hearthlight.'];
      if (q.stage >= 2) return ['The old shrine in the north-east of Emberhold has torn open.', 'Enter the Gloam Rift and face the Hollow King.'];
      const lines: string[] = [];
      for (const e of EMBERS) {
        const placed = !!d.flags[`placed:${e.key}`];
        const held = (d.inventory[e.id] ?? 0) > 0;
        if (placed) lines.push(`✓ ${e.name} burns in the Hearthlight.`);
        else if (held) lines.push(`• ${e.name}: return it to the Hearthlight.`);
        else lines.push(`• ${e.name}: somewhere in ${e.where}.`);
      }
      return lines;
    },
  },
  whiskers: {
    id: 'whiskers',
    title: "Where's Whiskers?",
    giver: 'Old Tamsin',
    done: 'Whiskers is home, fat and unrepentant.',
    objective: (d) =>
      (d.quests.whiskers?.stage ?? 0) >= 1
        ? ['Whiskers bolted for home. Let Tamsin know.']
        : ["Find Tamsin's ginger cat, Whiskers, somewhere in Whisperwood."],
  },
  glowcaps: {
    id: 'glowcaps',
    title: 'Glowcap Gathering',
    giver: 'Ivo the Herbalist',
    done: 'Ivo is brewing stronger remedies now.',
    objective: (d) => {
      const n = d.inventory['glowcap'] ?? 0;
      return n >= GLOWCAP_GOAL
        ? [`Bring the Glowcaps to Ivo. (${n}/${GLOWCAP_GOAL})`]
        : [`Gather Glowcaps in the wilds for Ivo. (${n}/${GLOWCAP_GOAL})`, 'They grow in damp, shadowy places.'];
    },
  },
  ring: {
    id: 'ring',
    title: "The Foreman's Ring",
    giver: 'Bram the Smith',
    done: 'Bram wears his ring again.',
    objective: (d) =>
      (d.inventory['foremans_ring'] ?? 0) > 0
        ? ["Return the Foreman's Ring to Bram."]
        : ["Find Bram's wedding ring somewhere in Hollowdeep Mine."],
  },
  slimes: {
    id: 'slimes',
    title: 'Pest Control',
    giver: 'Farmer Wendell',
    done: "Wendell's turnips are safe. For now.",
    objective: (d) => {
      const n = Math.min(SLIME_GOAL, slimesSlainForQuest(d));
      return n >= SLIME_GOAL
        ? ['Tell Wendell the slimes have been dealt with.']
        : [`Slay slimes for Farmer Wendell. (${n}/${SLIME_GOAL})`];
    },
  },
  masterwork: {
    id: 'masterwork',
    title: "The Smith's Masterwork",
    giver: 'Bram the Smith',
    done: 'You carry the Emberbrand.',
    objective: (d) =>
      (d.inventory['starsilver'] ?? 0) > 0
        ? [`Bring the Starsilver Ore and ${MASTERWORK_COST} gold to Bram.`, `(You have ${d.gold} gold.)`]
        : ['Find Starsilver Ore in the deepest workings of Hollowdeep Mine.'],
  },
};

export const QUEST_ORDER: QuestId[] = ['main', 'whiskers', 'glowcaps', 'slimes', 'ring', 'masterwork'];
