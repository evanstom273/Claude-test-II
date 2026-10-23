import type { BuildingKind } from './tiles';

/** Shop signs and place names. Picked in order, so each is used once before repeating. */
const NAMES: Partial<Record<BuildingKind, string[]>> = {
  bar: ['The Rusty Anchor', 'The Crooked Spoon', 'The Drowned Rat', "The King's Ransom", 'The Last Orders', 'The Bent Copper'],
  club: ['The Velvet Room', 'Club Nowhere'],
  shop_food: ['Bargain Booze', 'Kwik Mart', 'Corner Shop', 'Late Late Mart', 'Pick n Nick'],
  chippy: ['Cod Almighty', 'The Codfather', 'Frying Nemo', 'Batter Days'],
  shop_guns: ['Lock, Stock & Barrel', 'Gun Shy'],
  shop_clothes: ['Threads', 'Second Skin', 'Dead Man’s Shoes'],
  bank: ['Grimsport Savings & Loan'],
  police: ['Grimsport Constabulary'],
  hospital: ["St Anselm's Hospital"],
  garage: ['No Questions Motors'],
  respray: ["Spray 'n' Pray"],
  office: ['Holloway Holdings', 'Brine & Partners', 'Grimsport Gazette', 'Mallory Insurance', 'Tidewater Tower', 'Dunmore Consulting', 'Saltworks Ltd'],
  warehouse: ['Dockside Storage', 'Hake & Sons Wholesale', 'Fish Market', 'Brackish Imports', 'Cold Store'],
  safehouse: ['Your Flat'],
  house: ['House'],
  flats: ['Kestrel House', 'Marlowe Court', 'Tannery Heights', 'Gull Point', 'Ashdown Towers', 'Brewer Court', 'Chandler House', 'Pickering Heights', 'Netley Court', 'Sefton House'],
};

const used = new Map<BuildingKind, number>();

export function resetNames() {
  used.clear();
}

export function buildingName(kind: BuildingKind, gangName?: string): string {
  if (kind === 'gang_hq') return gangName ? `${gangName} HQ` : 'HQ';
  const list = NAMES[kind] ?? [kind];
  const n = used.get(kind) ?? 0;
  used.set(kind, n + 1);
  return list[n % list.length];
}

/** Random first and last names for targets and contacts. */
export const FIRST_NAMES = ['Dez', 'Kev', 'Shaz', 'Mick', 'Tash', 'Big Sue', 'Lenny', 'Mo', 'Jodie', 'Gaz', 'Priya', 'Tony', 'Nadia', 'Fitz', 'Rhys', 'Kemi', 'Ollie', 'Bev', 'Reggie', 'Ash'];
export const LAST_NAMES = ['Mallory', 'Pike', 'Doyle', 'Okafor', 'Harker', 'Quill', 'Benson', 'Rourke', 'Achebe', 'Finch', 'Grimes', 'Volkov', 'Sharma', 'Kerrigan', 'Lowe'];
