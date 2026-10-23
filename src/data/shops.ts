import type { BuildingKind } from '../game/city/tiles';
import type { ItemId, WeaponId } from '../state/types';

export type ShopLine =
  | { kind: 'weapon'; weapon: WeaponId; price: number }
  | { kind: 'ammo'; weapon: WeaponId; price: number }
  | { kind: 'item'; item: ItemId; price: number; name: string; desc: string; icon: string; now?: boolean }
  | { kind: 'heal'; price: number; name: string; desc: string }
  | { kind: 'outfit'; outfit: number; price: number };

export const ITEM_INFO: Record<ItemId, { name: string; heal: number; icon: string }> = {
  burger: { name: 'Burger', heal: 30, icon: 'burger' },
  chips: { name: 'Fish & chips', heal: 40, icon: 'burger' },
  pint: { name: 'Pint', heal: 10, icon: 'burger' },
  medkit: { name: 'First aid kit', heal: 70, icon: 'medkit' },
};

export function shopLines(kind: BuildingKind): ShopLine[] {
  switch (kind) {
    case 'shop_guns':
      return [
        { kind: 'weapon', weapon: 'bat', price: 40 },
        { kind: 'weapon', weapon: 'pistol', price: 180 },
        { kind: 'weapon', weapon: 'shotgun', price: 450 },
        { kind: 'weapon', weapon: 'smg', price: 550 },
        { kind: 'ammo', weapon: 'pistol', price: 40 },
        { kind: 'ammo', weapon: 'shotgun', price: 60 },
        { kind: 'ammo', weapon: 'smg', price: 70 },
      ];
    case 'shop_food':
      return [
        { kind: 'item', item: 'burger', price: 8, name: 'Burger', desc: 'Heals 30. Eat with X or the burger button.', icon: 'burger' },
        { kind: 'item', item: 'medkit', price: 45, name: 'First aid kit', desc: 'Heals 70.', icon: 'medkit' },
      ];
    case 'chippy':
      return [{ kind: 'item', item: 'chips', price: 12, name: 'Fish & chips', desc: 'Heals 40. Salt and vinegar?', icon: 'burger' }];
    case 'bar':
    case 'club':
      return [{ kind: 'item', item: 'pint', price: 5, name: 'Pint', desc: 'Heals 10. Drunk on the spot.', icon: 'burger', now: true }];
    case 'hospital':
      return [{ kind: 'heal', price: 40, name: 'Patch me up', desc: 'Back to full health.' }];
    case 'shop_clothes':
      return [1, 2, 3, 4].map((outfit) => ({ kind: 'outfit' as const, outfit, price: 150 }));
    default:
      return [];
  }
}
