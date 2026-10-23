# LOWLIFE

An open-world, top-down crime game for the browser. Grimsport is a wet, neon-lit port town run by three gangs and a police force that's always one phone call away. Nick cars, take jobs from ringing payphones, rob tills, pick fights you probably shouldn't, and try to stay alive until morning.

- One big city, generated from a seed: the docks, industrial yards, the Strip, downtown, a residential estate, parks and the seafront
- Three gangs with their own turf, looks and HQs: the Vipers, the Velvet Crowns and the Dock Rats. Work for one and the others notice
- Every building can be walked into, with furnished interiors you see through the walls
- Cars to steal, drift with the handbrake, crash, sell, respray or set on fire. Traffic drives on the left
- Fists, a bat, a pistol, an SMG and a shotgun; explosions
- Wanted stars, foot patrols and police cars that chase you through the streets
- Five kinds of job: steal a car, a hit, a timed delivery, torching a rival's car, thinning out a rival gang
- Shops, a chippy, bars, a hospital, a gun shop and a clothes shop (a change of clothes loses the police)
- Day and night, street lights, headlights, sirens, and four radio stations
- Three save slots, stored in IndexedDB. Save by sleeping in your flat
- No asset files: every person, car, tile, prop, tune and sound effect is generated in code at runtime

Built with React, Vite, TypeScript, Tailwind CSS, Dexie and Phaser 4.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # city reachability, lanes, routing, sprite data checks
npm run typecheck
```

## Controls

| Action | Keys |
| --- | --- |
| Move / drive | WASD / arrows |
| Attack (hold for automatic weapons) | J / Space |
| Interact: get in or out, carjack, answer, buy, rob | E / Enter / F |
| Switch weapon | Q / Tab |
| Sprint | Shift |
| Handbrake (in a car) | Shift / K |
| Horn | H |
| Radio | R |
| Eat something | X |
| Map | M |
| Phone (pause) | Esc / P |

With a mouse, you can aim with the pointer (Settings → Mouse aim); otherwise you auto-aim at the nearest threat.

On phones, tablets and foldables, touch controls switch on automatically: drag on the left half to move or steer (point the stick where you want the car to go), use the buttons on the right to attack, switch weapon, brake, honk and change station, and tap the yellow button that appears to get in cars, answer phones and so on. Portrait and landscape both work.

## How the world works

Most of the game comes from a few systems that interact:

- **Crimes** are events with a place and a noise. Anyone who sees or hears one reacts: civilians run and sometimes phone it in, shopkeepers cower or reach under the counter, gang members join in when it's one of theirs, cops add to your wanted level.
- **Wanted level** builds from heat. Each crime a cop witnesses adds some, and the stars climb no faster than one every couple of seconds. Get out of sight and they flash, then drop one at a time.
- **Gangs** remember how you've treated them. Do jobs for a gang and they like you; kill their people and they'll shoot on sight.
- **Payphones** ring around the city. Answer one for a job.

## Deploying

`.github/workflows/deploy.yml` builds the game and publishes `dist/` to GitHub Pages on every push to `main` (Pages source: GitHub Actions). The build uses relative paths, so it works from the repo's Pages sub-path.

## Layout

- `src/game/city`: city generation, furnishing, tile painting and chunked streaming
- `src/game/art`: shape-based generators for people, cars and props, plus the texture atlases
- `src/game/entities`: people and cars, with the car physics
- `src/game/systems`: combat, AI, police, traffic, routing, population and jobs
- `src/game/scenes`: boot, title and the city scene that ties it all together
- `src/data`: the cast, weapons and shop stock
- `src/state`: game and UI stores, save/load session logic
- `src/db`: Dexie database for saves and settings
- `src/ui`: React overlays (title screen, HUD, phone, map, shops, jobs, touch controls)
- `preview.html` is a dev-only page for eyeballing the generated people, cars and city

Hearthlight, the top-down action RPG that used to live here, is archived on the [`hearthlight-v1`](https://github.com/evanstom273/Claude-test-II/tree/hearthlight-v1) branch.
