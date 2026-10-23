import Phaser from 'phaser';
import type { NpcDef } from '../../data/npcs';
import type { Facing } from '../../state/types';
import { ATLAS } from '../textures';
import type { World } from '../world/types';

export class Npc extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  def: NpcDef;
  private shadow: Phaser.GameObjects.Image;
  private home: { x: number; y: number };
  private nextMove = 0;
  private moveUntil = 0;
  private facing: Facing;
  private talking = false;

  constructor(world: World, x: number, y: number, def: NpcDef) {
    super(world, x, y, ATLAS, def.sprite === 'cat' ? 'cat_0' : `${def.sprite}_down_idle`);
    this.def = def;
    this.home = { x, y };
    this.facing = def.facing ?? 'down';
    world.add.existing(this);
    world.physics.add.existing(this);
    this.body.setSize(10, 7).setOffset(3, 9);
    this.body.setImmovable(true);
    this.body.pushable = false;
    this.shadow = world.add.image(x, y + 7, ATLAS, 'shadow').setDepth(-5000);
    if (def.sprite === 'cat') this.play('cat_idle');
    else this.face(this.facing);
    this.nextMove = world.time.now + 1000 + Math.random() * 3000;
  }

  private dirKey(f: Facing) {
    return f === 'left' || f === 'right' ? 'side' : f;
  }

  face(f: Facing) {
    if (this.def.sprite === 'cat') return;
    this.facing = f;
    this.setFlipX(f === 'left');
    this.play(`${this.def.sprite}_idle_${this.dirKey(f)}`, true);
  }

  faceToward(x: number, y: number) {
    const dx = x - this.x;
    const dy = y - this.y;
    this.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }

  setTalking(on: boolean) {
    this.talking = on;
    if (on) this.setVelocity(0, 0);
  }

  update(time: number) {
    this.setDepth(this.body.bottom);
    this.shadow.setPosition(this.x, this.body.bottom - 1);
    const wander = this.def.wander ?? 0;
    if (!wander || this.talking || this.def.sprite === 'cat') return;
    if (time < this.moveUntil) {
      const v = this.body.velocity;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) this.play(`${this.def.sprite}_walk_${this.dirKey(this.facing)}`, true);
      return;
    }
    if (this.body.velocity.lengthSq() > 0) {
      this.setVelocity(0, 0);
      this.face(this.facing);
    }
    if (time < this.nextMove) return;
    this.nextMove = time + 2000 + Math.random() * 4000;
    const far = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y) > wander * 16;
    const dirs: Facing[] = ['up', 'down', 'left', 'right'];
    let f = dirs[Math.floor(Math.random() * 4)];
    if (far) {
      const dx = this.home.x - this.x;
      const dy = this.home.y - this.y;
      f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[f];
    this.face(f);
    this.setVelocity(v[0] * 30, v[1] * 30);
    this.moveUntil = time + 400 + Math.random() * 400;
  }

  destroy(fromScene?: boolean) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
