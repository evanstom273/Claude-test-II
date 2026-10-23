import Phaser from 'phaser';
import { ATLAS } from '../textures';
import type { World } from '../world/types';

export type PickupKind = 'coin' | 'heart' | 'mana' | 'ember' | 'glowcap';

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  kind: PickupKind;
  value: number;
  /** Item id for embers, flag id for glowcaps. */
  ref?: string;
  private world: World;
  private born: number;
  private expires: number | null;
  private baseY: number;
  private shadow: Phaser.GameObjects.Image;

  constructor(world: World, x: number, y: number, kind: PickupKind, value = 1, ref?: string) {
    const frame = kind === 'coin' ? 'coin_0' : kind === 'heart' ? 'heart' : kind === 'mana' ? 'mana' : kind === 'glowcap' ? 'glowcap' : `gem_${ref === 'verdant_ember' ? 'verdant' : ref === 'stone_ember' ? 'stone' : 'tide'}`;
    super(world, x, y, ATLAS, frame);
    this.world = world;
    this.kind = kind;
    this.value = value;
    this.ref = ref;
    world.add.existing(this);
    world.physics.add.existing(this);
    this.born = world.time.now;
    this.expires = kind === 'coin' || kind === 'heart' || kind === 'mana' ? world.time.now + 14000 : null;
    this.baseY = y;
    this.shadow = world.add.image(x, y + 5, ATLAS, 'shadow').setDepth(-5000).setScale(kind === 'ember' ? 0.9 : 0.5);
    if (kind === 'coin') this.play('coin_spin');
    this.body.setSize(kind === 'ember' || kind === 'glowcap' ? 12 : 8, kind === 'ember' || kind === 'glowcap' ? 12 : 8);
    if (kind === 'coin' || kind === 'heart' || kind === 'mana') {
      // Pop out of the enemy.
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 40;
      this.setVelocity(Math.cos(a) * s, Math.sin(a) * s);
      this.setDrag(140);
    }
    this.setDepth(y);
  }

  get collectable() {
    return this.world.time.now - this.born > 250;
  }

  tick(time: number) {
    if (this.expires !== null) {
      const left = this.expires - time;
      if (left <= 0) {
        this.shadow.destroy();
        this.destroy();
        return;
      }
      if (left < 3000) this.setVisible(Math.floor(time / 100) % 2 === 0);
    }
    if (this.kind === 'ember' || this.kind === 'glowcap') {
      const bob = Math.sin((time - this.born) / 300) * (this.kind === 'ember' ? 2.5 : 0.8);
      this.setY(this.baseY + bob);
    }
    this.shadow.setPosition(this.x, (this.kind === 'ember' ? this.baseY : this.y) + 6);
    // Drift toward the player when close.
    const p = this.world.player;
    if (this.collectable && (this.kind === 'coin' || this.kind === 'heart' || this.kind === 'mana')) {
      const d = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
      if (d < 36) {
        const a = Phaser.Math.Angle.Between(this.x, this.y, p.x, p.y);
        this.setVelocity(Math.cos(a) * 140, Math.sin(a) * 140);
      }
    }
  }

  destroy(fromScene?: boolean) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
