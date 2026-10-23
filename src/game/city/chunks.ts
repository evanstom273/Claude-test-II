import Phaser from 'phaser';
import { ATLAS } from '../textures';
import { bufferToCanvas, paintChunk } from './paint';
import { CHUNK, TILE, chunkKey, type CityMap, type Prop } from './tiles';

export interface StaticLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  /** Only shines at night. */
  night: boolean;
  /** Neon flickers a little. */
  flicker?: boolean;
}

export interface DoorView {
  prop: Prop;
  sprite: Phaser.GameObjects.Image;
  open: boolean;
  closeAt: number;
}

interface Loaded {
  key: number;
  texKey: string;
  image: Phaser.GameObjects.Image;
  objects: Phaser.GameObjects.GameObject[];
  lights: StaticLight[];
  doors: DoorView[];
  props: Prop[];
}

const CHUNK_PX = CHUNK * TILE;
const NIGHT_COLOURS: Record<string, number> = { warm: 0xffd9a0, cool: 0xcfe4ff, neon: 0xff4fa8 };

/**
 * Paints the city a chunk at a time around the camera, and creates the
 * sprites for whatever stands in each chunk. Far chunks are thrown away.
 */
export class ChunkManager {
  private loaded = new Map<number, Loaded>();
  readonly doors = new Map<number, DoorView>();
  onLoad?: (cx: number, cy: number, props: Prop[]) => void;
  onUnload?: (cx: number, cy: number) => void;

  constructor(
    private scene: Phaser.Scene,
    private city: CityMap,
  ) {}

  /** Keep chunks around the view loaded. Missing visible chunks are painted at once; the margin one per frame. */
  update(view: Phaser.Geom.Rectangle) {
    const need = new Set<number>();
    const vis = (m: number) => ({
      x0: Math.max(0, Math.floor((view.x - m) / CHUNK_PX)),
      y0: Math.max(0, Math.floor((view.y - m) / CHUNK_PX)),
      x1: Math.min(Math.ceil(this.city.W / CHUNK) - 1, Math.floor((view.right + m) / CHUNK_PX)),
      y1: Math.min(Math.ceil(this.city.H / CHUNK) - 1, Math.floor((view.bottom + m) / CHUNK_PX)),
    });
    const inner = vis(16);
    const outer = vis(CHUNK_PX * 0.6);
    for (let cy = inner.y0; cy <= inner.y1; cy++)
      for (let cx = inner.x0; cx <= inner.x1; cx++) {
        need.add(chunkKey(cx, cy));
        if (!this.loaded.has(chunkKey(cx, cy))) this.load(cx, cy);
      }
    let budget = 1;
    for (let cy = outer.y0; cy <= outer.y1; cy++)
      for (let cx = outer.x0; cx <= outer.x1; cx++) {
        need.add(chunkKey(cx, cy));
        if (budget > 0 && !this.loaded.has(chunkKey(cx, cy))) {
          this.load(cx, cy);
          budget--;
        }
      }
    // Unload anything well outside the margin.
    const keep = vis(CHUNK_PX * 1.4);
    for (const [key, l] of this.loaded) {
      const cx = key % 1000;
      const cy = Math.floor(key / 1000);
      if (cx < keep.x0 || cx > keep.x1 || cy < keep.y0 || cy > keep.y1) this.unload(l, cx, cy);
    }
  }

  isLoaded(cx: number, cy: number) {
    return this.loaded.has(chunkKey(cx, cy));
  }

  get lights(): StaticLight[] {
    const out: StaticLight[] = [];
    for (const l of this.loaded.values()) out.push(...l.lights);
    return out;
  }

  private load(cx: number, cy: number) {
    const key = chunkKey(cx, cy);
    const texKey = `chunk_${key}`;
    const canvas = bufferToCanvas(paintChunk(this.city, cx, cy));
    if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);
    this.scene.textures.addCanvas(texKey, canvas);
    const image = this.scene.add.image(cx * CHUNK_PX, cy * CHUNK_PX, texKey).setOrigin(0, 0).setDepth(-100000);
    const props = this.city.propsByChunk.get(key) ?? [];
    const loaded: Loaded = { key, texKey, image, objects: [], lights: [], doors: [], props };
    for (const p of props) this.makeProp(p, loaded);
    // Lit interiors at night.
    for (const b of this.city.buildings) {
      if (Math.floor((b.x + b.w / 2) / CHUNK) !== cx || Math.floor((b.y + b.h / 2) / CHUNK) !== cy) continue;
      const warm = b.kind === 'house' || b.kind === 'flats' || b.kind === 'bar' || b.kind === 'safehouse' || b.kind === 'chippy';
      const col = b.kind === 'club' ? 0xd86aff : warm ? NIGHT_COLOURS.warm : NIGHT_COLOURS.cool;
      loaded.lights.push({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2) * TILE, radius: Math.max(b.w, b.h) * 9, color: col, intensity: 0.8, night: true });
    }
    this.loaded.set(key, loaded);
    this.onLoad?.(cx, cy, props);
  }

  private unload(l: Loaded, cx: number, cy: number) {
    this.onUnload?.(cx, cy);
    l.image.destroy();
    for (const o of l.objects) o.destroy();
    for (const d of l.doors) this.doors.delete(d.prop.id);
    if (this.scene.textures.exists(l.texKey)) this.scene.textures.remove(l.texKey);
    this.loaded.delete(l.key);
  }

  private makeProp(p: Prop, l: Loaded) {
    const s = this.scene;
    const bx = (p.tx + p.tw / 2) * TILE;
    const by = (p.ty + p.th) * TILE;
    const img = (frame: string, x = bx, y = by - 1, ox = 0.5, oy = 1) => {
      const o = s.add.image(x, y, ATLAS, frame).setOrigin(ox, oy).setDepth(y);
      l.objects.push(o);
      return o;
    };
    switch (p.kind) {
      case 'door': {
        const frame = p.variant === 0 ? 'door_h' : 'door_v';
        const sprite = s.add.image(p.tx * TILE + 8, p.ty * TILE + 8, ATLAS, frame).setDepth(p.ty * TILE + (p.variant === 0 ? 15 : 8));
        l.objects.push(sprite);
        const view: DoorView = { prop: p, sprite, open: false, closeAt: 0 };
        l.doors.push(view);
        this.doors.set(p.id, view);
        return;
      }
      case 'lamp':
        img('lamp', bx, by - 2);
        l.lights.push({ x: bx, y: by - 22, radius: 52, color: 0xffd28a, intensity: 1, night: true });
        return;
      case 'tree':
        img(this.city.district[p.ty * this.city.W + p.tx] === 4 ? 'tree_dead' : 'tree', bx, by + 1);
        return;
      case 'container':
        img(`container_${p.variant ?? 0}`);
        return;
      case 'crate':
      case 'bush':
      case 'bin':
      case 'bench':
      case 'hydrant':
      case 'bollard':
      case 'dumpster':
      case 'counter':
      case 'register':
      case 'shelf':
      case 'fridge':
      case 'table':
      case 'chair':
      case 'stool':
      case 'bed':
      case 'hospbed':
      case 'sofa':
      case 'tv':
      case 'safe':
      case 'plant':
      case 'desk':
      case 'pooltable':
      case 'jukebox':
      case 'rack':
      case 'gunrack':
      case 'cell':
      case 'wardrobe':
      case 'mirror':
      case 'booth':
      case 'cooler':
      case 'payphone':
        img(p.kind);
        if (p.kind === 'jukebox') l.lights.push({ x: bx, y: by - 8, radius: 26, color: 0xff4fa8, intensity: 0.8, night: false, flicker: true });
        return;
      case 'neon':
      case 'sign': {
        if (!p.text) return;
        const neon = p.kind === 'neon';
        const color = p.color ?? '#f4efe4';
        const t = s.add
          .text(p.tx * TILE + 8, p.ty * TILE + 6, p.text.toUpperCase(), {
            fontFamily: '"Silkscreen", monospace',
            fontSize: '8px',
            color: neon ? color : '#f4efe4',
            stroke: neon ? '#1a0a1a' : '#2a2430',
            strokeThickness: 2,
            resolution: 4,
          })
          .setOrigin(0.5, 0.5)
          .setScale(0.6)
          .setDepth(p.ty * TILE + 2);
        l.objects.push(t);
        if (neon) l.lights.push({ x: p.tx * TILE + 8, y: p.ty * TILE + 6, radius: 34, color: Phaser.Display.Color.HexStringToColor(color).color, intensity: 1, night: true, flicker: true });
        return;
      }
    }
  }

  destroy() {
    for (const [key, l] of this.loaded) this.unload(l, key % 1000, Math.floor(key / 1000));
  }
}
