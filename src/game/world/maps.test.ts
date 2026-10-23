import { describe, expect, it } from 'vitest';
import { MAPS } from '../../data/maps';
import { NPCS } from '../../data/npcs';
import { ITEMS } from '../../data/items';
import { parseMap } from './parse';
import { reach, type ReachOptions } from './reach';
import type { ZoneId } from '../../state/types';

const parsed = Object.fromEntries(Object.entries(MAPS).map(([id, def]) => [id, parseMap(def)])) as Record<ZoneId, ReturnType<typeof parseMap>>;

function reachFrom(zone: ZoneId, spawn: string, opts: ReachOptions) {
  const map = parsed[zone];
  return reach(map, map.spawns[spawn], opts);
}

const NONE = { bolt: false, dash: false };
const BOLT = { bolt: true, dash: false };
const ALL = { bolt: true, dash: true };

describe('maps', () => {
  it('parse without errors and have rectangular rows', () => {
    for (const map of Object.values(parsed)) {
      expect(map.w).toBeGreaterThan(20);
      expect(map.terrain.length).toBe(map.w * map.h);
    }
  });

  it('every exit leads to a spawn that exists', () => {
    for (const map of Object.values(parsed)) {
      for (const region of Object.values(map.regions)) {
        if (region.def.type !== 'exit') continue;
        const target = parsed[region.def.to];
        expect(target.spawns[region.def.spawn], `${map.def.id} -> ${region.def.to}:${region.def.spawn}`).toBeDefined();
      }
    }
  });

  it('references only known NPCs and items', () => {
    for (const map of Object.values(parsed)) {
      for (const o of map.objects) {
        if (o.def.type === 'npc') expect(NPCS[o.def.id], o.def.id).toBeDefined();
        if (o.def.type === 'chest' && o.def.item) expect(ITEMS[o.def.item], o.def.item).toBeDefined();
        if (o.def.type === 'gate') expect(ITEMS[o.def.key], o.def.key).toBeDefined();
      }
    }
  });

  it('village: everyone is reachable, but the east road needs fire', () => {
    const r = reachFrom('village', 'start', NONE);
    for (const id of ['maren', 'bram', 'ivo', 'tamsin', 'wendell', 'pip', 'holt', 'edda']) expect(r.objects.has(`npc:${id}`), id).toBe(true);
    expect(r.reachable.has(`${parsed.village.spawns.north.x},${parsed.village.spawns.north.y}`)).toBe(true);
    expect(r.reachable.has(`${parsed.village.spawns.south.x},${parsed.village.spawns.south.y}`)).toBe(true);
    const east = parsed.village.spawns.east;
    const eastExit = Object.values(parsed.village.regions).find((g) => g.def.type === 'exit' && g.def.to === 'hollowdeep')!;
    const exitTile = eastExit.tiles[0];
    expect(r.reachable.has(`${east.x},${east.y}`)).toBe(true);
    expect(r.reachable.has(`${exitTile.x},${exitTile.y}`)).toBe(false);
    const withBolt = reachFrom('village', 'start', BOLT);
    expect(withBolt.reachable.has(`${exitTile.x},${exitTile.y}`)).toBe(true);
  });

  it('whisperwood: the boss is reachable on foot; the ledge needs a dash', () => {
    const r = reachFrom('whisperwood', 'south', NONE);
    expect(r.objects.has('boss:thornmother')).toBe(true);
    expect(r.objects.has('cat')).toBe(true);
    expect(r.objects.has('chest:ww_chest_key')).toBe(true);
    expect(r.objects.has('chest:ww_chest_thornblade')).toBe(true);
    expect(r.objects.has('chest:ww_chest_glade')).toBe(true);
    expect(r.objects.has('chest:ww_chest_draughts')).toBe(true);
    expect(r.objects.has('glowcap:ww_glow_1')).toBe(true);
    expect(r.objects.has('glowcap:ww_glow_2')).toBe(true);
    expect(r.objects.has('glowcap:ww_glow_3')).toBe(true);
    expect(r.objects.has('glowcap:ww_glow_4')).toBe(false);
    expect(r.objects.has('chest:ww_chest_ledge')).toBe(false);
    const all = reachFrom('whisperwood', 'south', ALL);
    expect(all.objects.has('glowcap:ww_glow_4')).toBe(true);
    expect(all.objects.has('chest:ww_chest_ledge')).toBe(true);
  });

  it('whisperwood: without the key the boss is out of reach', () => {
    const map = parsed.whisperwood;
    const noKeyChest = { ...map, objects: map.objects.filter((o) => !(o.def.type === 'chest' && o.def.id === 'ww_chest_key')) };
    const r = reach(noKeyChest, map.spawns.south, NONE);
    expect(r.objects.has('boss:thornmother')).toBe(false);
  });

  it('hollowdeep: boss reachable with the bolt; starsilver needs the dash', () => {
    const r = reachFrom('hollowdeep', 'west', BOLT);
    for (const id of ['hd_ring', 'hd_key', 'hd_tonics', 'hd_vigor', 'hd_gold']) expect(r.objects.has(`chest:${id}`), id).toBe(true);
    expect(r.objects.has('glowcap:hd_glow_1')).toBe(true);
    expect(r.objects.has('glowcap:hd_glow_2')).toBe(true);
    expect(r.objects.has('boss:colossus')).toBe(true);
    expect(r.objects.has('chest:hd_starsilver')).toBe(false);
    expect(reachFrom('hollowdeep', 'west', NONE).objects.has('chest:hd_tonics')).toBe(false);
    expect(reachFrom('hollowdeep', 'west', ALL).objects.has('chest:hd_starsilver')).toBe(true);
  });

  it('saltmere: the ravine needs the dash', () => {
    const r = reachFrom('saltmere', 'north', BOLT);
    expect(r.objects.has('npc:ferrin')).toBe(true);
    expect(r.objects.has('boss:abbess')).toBe(false);
    const all = reachFrom('saltmere', 'north', ALL);
    for (const id of ['sm_key', 'sm_mail', 'sm_amulet', 'sm_beach', 'sm_elixir']) expect(all.objects.has(`chest:${id}`), id).toBe(true);
    expect(all.objects.has('glowcap:sm_glow_1')).toBe(true);
    expect(all.objects.has('boss:abbess')).toBe(true);
  });

  it('rift: everything reachable with every power', () => {
    const r = reachFrom('rift', 'entry', ALL);
    for (const id of ['rf_elixir', 'rf_draughts', 'rf_gold']) expect(r.objects.has(`chest:${id}`), id).toBe(true);
    expect(r.objects.has('boss:hollow_king')).toBe(true);
  });

  it('there are enough glowcaps for the herbalist', () => {
    const total = Object.values(parsed).reduce((n, m) => n + m.objects.filter((o) => o.def.type === 'glowcap').length, 0);
    expect(total).toBeGreaterThanOrEqual(5);
  });
});
