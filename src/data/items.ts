export type ItemKind = 'weapon' | 'armor' | 'charm' | 'consumable' | 'key' | 'material';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  /** Sprite key of the icon (see art/icons). */
  icon: string;
  /** Shop buy price. Items without a price can't be bought. */
  price?: number;
  atk?: number;
  def?: number;
  maxHp?: number;
  maxMp?: number;
  /** Movement speed bonus, as a fraction (0.15 = +15%). */
  speed?: number;
  /** Mana regeneration multiplier bonus (1 = double). */
  mpRegen?: number;
  /** Gold find bonus, as a fraction. */
  goldFind?: number;
  /** Light radius bonus in dark places, as a fraction. */
  light?: number;
  heal?: number;
  mana?: number;
}

const list: ItemDef[] = [
  // Weapons
  { id: 'rusty_sword', name: 'Rusty Sword', kind: 'weapon', icon: 'icon_sword_rusty', atk: 2, desc: "A Keeper's training blade. More rust than edge." },
  { id: 'iron_sword', name: 'Iron Sword', kind: 'weapon', icon: 'icon_sword_iron', atk: 5, price: 120, desc: 'Plain, honest iron from Bram\'s forge.' },
  { id: 'thornblade', name: 'Thornblade', kind: 'weapon', icon: 'icon_sword_thorn', atk: 8, desc: 'Living heartwood, hard as iron. It hums when the Gloam is near.' },
  { id: 'steel_sabre', name: 'Steel Sabre', kind: 'weapon', icon: 'icon_sword_steel', atk: 11, price: 420, desc: 'Folded steel, forged with Hollowdeep ore.' },
  { id: 'emberbrand', name: 'Emberbrand', kind: 'weapon', icon: 'icon_sword_ember', atk: 16, desc: "Bram's masterwork. Starsilver that remembers the sun." },

  // Armour
  { id: 'padded_tunic', name: 'Padded Tunic', kind: 'armor', icon: 'icon_armor_tunic', def: 1, desc: 'Quilted wool. Keeps the draught out, and not much else.' },
  { id: 'leather_jerkin', name: 'Leather Jerkin', kind: 'armor', icon: 'icon_armor_leather', def: 3, price: 90, desc: 'Boiled leather, stitched tight.' },
  { id: 'chain_mail', name: 'Chain Mail', kind: 'armor', icon: 'icon_armor_chain', def: 6, price: 360, desc: 'Ten thousand rings, every one riveted by hand.' },
  { id: 'tidewarden_mail', name: 'Tidewarden Mail', kind: 'armor', icon: 'icon_armor_tide', def: 9, maxHp: 10, desc: 'Scale armour of the old chapel guard. Still smells of the sea.' },
  { id: 'gloamward_plate', name: 'Gloamward Plate', kind: 'armor', icon: 'icon_armor_plate', def: 12, price: 900, desc: 'Plate etched with ward-runes. Heavy as a bad conscience.' },

  // Charms
  { id: 'feather_charm', name: 'Feather Charm', kind: 'charm', icon: 'icon_charm_feather', speed: 0.15, desc: 'A jay feather on a string. Your feet feel lighter. (+15% speed)' },
  { id: 'lucky_coin', name: 'Lucky Coin', kind: 'charm', icon: 'icon_charm_coin', goldFind: 0.5, desc: 'Two-headed, naturally. (+50% gold found)' },
  { id: 'glimmer_charm', name: 'Glimmer Charm', kind: 'charm', icon: 'icon_charm_glimmer', light: 0.5, def: 1, desc: 'A miner\'s lamp-glass on a chain. (+50% light in dark places)' },
  { id: 'vigor_charm', name: 'Vigor Charm', kind: 'charm', icon: 'icon_charm_vigor', maxHp: 25, desc: 'A red stone that beats faintly, like a second heart. (+25 HP)' },
  { id: 'sage_charm', name: 'Sage Charm', kind: 'charm', icon: 'icon_charm_sage', maxMp: 15, mpRegen: 1, desc: 'Dried glowcap set in silver. (+15 MP, faster mana regeneration)' },
  { id: 'tide_amulet', name: 'Tide Amulet', kind: 'charm', icon: 'icon_charm_tide', def: 3, maxHp: 10, maxMp: 5, desc: 'A pearl that is always cold. (+3 DEF, +10 HP, +5 MP)' },

  // Consumables
  { id: 'draught', name: 'Healing Draught', kind: 'consumable', icon: 'icon_potion_red', heal: 35, price: 20, desc: 'Restores 35 HP. Tastes of honey and regret.' },
  { id: 'greater_draught', name: 'Greater Draught', kind: 'consumable', icon: 'icon_potion_big', heal: 100, price: 60, desc: 'Restores 100 HP.' },
  { id: 'tonic', name: 'Mana Tonic', kind: 'consumable', icon: 'icon_potion_blue', mana: 25, price: 25, desc: 'Restores 25 MP. Fizzes alarmingly.' },
  { id: 'elixir', name: 'Elixir', kind: 'consumable', icon: 'icon_potion_gold', heal: 9999, mana: 9999, price: 180, desc: 'Fully restores HP and MP.' },

  // Materials & key items
  { id: 'glowcap', name: 'Glowcap', kind: 'material', icon: 'icon_glowcap', desc: 'A softly glowing mushroom. Ivo the herbalist wants these.' },
  { id: 'starsilver', name: 'Starsilver Ore', kind: 'material', icon: 'icon_starsilver', desc: 'Ore that glitters even in total darkness. Bram would know what to do with it.' },
  { id: 'foremans_ring', name: "Foreman's Ring", kind: 'key', icon: 'icon_ring', desc: 'A plain gold band, engraved "B & E".' },
  { id: 'key_whisperwood', name: 'Mossy Key', kind: 'key', icon: 'icon_key_moss', desc: 'Opens a locked gate in Whisperwood.' },
  { id: 'key_hollowdeep', name: 'Rusted Key', kind: 'key', icon: 'icon_key_rust', desc: 'Opens a locked door in Hollowdeep.' },
  { id: 'key_saltmere', name: 'Barnacled Key', kind: 'key', icon: 'icon_key_sea', desc: 'Opens a locked door in the Drowned Chapel.' },
  { id: 'verdant_ember', name: 'Verdant Ember', kind: 'key', icon: 'icon_ember_green', desc: 'The first Ember of the Hearthlight. Warm, and smells of spring.' },
  { id: 'stone_ember', name: 'Stone Ember', kind: 'key', icon: 'icon_ember_stone', desc: 'The second Ember. Heavy, patient, and very old.' },
  { id: 'tide_ember', name: 'Tide Ember', kind: 'key', icon: 'icon_ember_blue', desc: 'The third Ember. It pulses like a slow wave.' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));

export function item(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item: ${id}`);
  return def;
}

export const EQUIP_KINDS = ['weapon', 'armor', 'charm'] as const;
export type EquipSlot = (typeof EQUIP_KINDS)[number];

export function isEquipment(def: ItemDef): def is ItemDef & { kind: EquipSlot } {
  return def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'charm';
}

/** Items that can be sold back to a shop, and for how much. */
export function sellPrice(def: ItemDef): number {
  if (def.kind === 'key' || def.kind === 'material') return 0;
  if (def.price) return Math.floor(def.price / 2);
  // Found gear sells for a modest sum based on its power.
  const power = (def.atk ?? 0) * 12 + (def.def ?? 0) * 12 + (def.maxHp ?? 0) * 2 + (def.maxMp ?? 0) * 3;
  return Math.max(5, Math.floor(power));
}

/** Consumables bound to the number keys, in order. */
export const QUICK_ITEMS = ['draught', 'greater_draught', 'tonic', 'elixir'] as const;
