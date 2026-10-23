# Hearthlight

A top-down action RPG for the browser. Something has torn the three Embers out of Emberhold's Hearthlight, and the Gloam is creeping in. Get them back.

- Five areas: Emberhold, Whisperwood, Hollowdeep Mine, Saltmere and the Drowned Chapel, and the Gloam Rift
- Four bosses, each with a second phase
- The main quest plus five side quests, nine villagers, two shops
- Gear, levelling, potions, and three powers that open up new routes (fire burns Gloam-thorn, the dash clears gaps)
- Three save slots plus autosave, stored in IndexedDB
- No asset files: every sprite, tile, tune and sound effect is generated in code at runtime

Built with React, Vite, TypeScript, Tailwind CSS, Dexie and Phaser 4.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # map reachability, sprite data checks
npm run typecheck
```

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD / arrows |
| Attack (three-hit combo) | J / Space |
| Talk / interact | E / Enter |
| Ember Bolt | K |
| Ember Dash | L / Shift |
| Radiance | R |
| Potions | 1-4 |
| Bag | I / Tab |
| Journal | Q |
| Map | M |
| Pause | Esc |

Rest at the Hearthlight in the village square to heal and save.

## Layout

- `src/game`: Phaser scenes, entities, bosses, lighting, generated art and synthesised audio
- `src/data`: items, enemies, quests, NPC dialogue, shops and the ASCII maps
- `src/state`: game and UI stores, progression, save/load session logic
- `src/db`: Dexie database for saves and settings
- `src/ui`: React overlays (title screen, HUD, dialogue, menus)
- `preview.html` and `maps.html` are dev-only pages for eyeballing sprites and rendered maps
