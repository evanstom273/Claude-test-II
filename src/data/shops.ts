import { game } from '../state/gameStore';

export interface ShopDef {
  id: string;
  name: string;
  keeper: string;
  portrait: string;
  greeting: string;
  stock: () => string[];
}

export const SHOPS: Record<string, ShopDef> = {
  forge: {
    id: 'forge',
    name: "Bram's Forge",
    keeper: 'Bram',
    portrait: 'bram',
    greeting: 'Good steel, fair prices. Mostly fair.',
    stock: () => [
      'iron_sword',
      'leather_jerkin',
      ...(game.flag('boss:thornmother') ? ['chain_mail'] : []),
      ...(game.flag('boss:colossus') ? ['steel_sabre'] : []),
      ...(game.flag('boss:abbess') ? ['gloamward_plate'] : []),
    ],
  },
  apothecary: {
    id: 'apothecary',
    name: "Ivo's Remedies",
    keeper: 'Ivo',
    portrait: 'ivo',
    greeting: 'Tinctures! Tonics! Mostly safe!',
    stock: () => ['draught', 'tonic', ...(game.questDone('glowcaps') ? ['greater_draught', 'elixir'] : [])],
  },
};
