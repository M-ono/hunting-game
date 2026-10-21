import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';

/** ギルド（一番上の床に置く）。触れると持っている獲物をすべて売って、お金をもらう */
export class Guild {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} floorY 置く床の上面
   */
  constructor(scene, floorY) {
    const { x, width, height, touchMargin } = CONFIG.guild;
    const { guildWall, guildRoof, guildDoor } = CONFIG.colors;
    this.scene = scene;
    this.x = x;
    this.top = floorY - height; // 屋根のてっぺん

    const left = x - width / 2;
    const right = x + width / 2;
    const wallTop = this.top + 50;
    const g = scene.add.graphics().setDepth(DEPTH.stage);
    g.fillStyle(guildWall, 1).fillRect(left, wallTop, width, floorY - wallTop); // 壁
    g.fillStyle(guildRoof, 1).fillTriangle(left - 14, wallTop, right + 14, wallTop, x, this.top); // 屋根
    g.fillStyle(guildDoor, 1).fillRect(x - 24, floorY - 62, 48, 62); // 入口

    this.sign = addText(scene, x, wallTop + 26, 'ギルド', { size: 38, stroke: 6 }).setDepth(DEPTH.stage + 1);
    addText(scene, x, this.top - 30, '獲物を届けるとお金に', { size: 30, bold: false, stroke: 6 }).setDepth(
      DEPTH.stage + 1,
    );

    // この範囲にプレイヤーの体が重なったら「触れた」とみなす（通り抜けられる）
    this.touchArea = new Phaser.Geom.Rectangle(
      left - touchMargin,
      this.top - touchMargin,
      width + touchMargin * 2,
      height + touchMargin * 2,
    );
  }

  /** @param {Phaser.Physics.Arcade.Body} body プレイヤーの体 */
  isTouching(body) {
    return Phaser.Geom.Intersects.RectangleToValues(this.touchArea, body.left, body.right, body.top, body.bottom);
  }

  /** お金を受け取ったときに看板を少し弾ませる */
  bounce() {
    this.bounceTween?.stop();
    this.sign.setScale(1);
    this.bounceTween = this.scene.tweens.add({ targets: this.sign, scale: 1.3, duration: 120, yoyo: true });
  }
}
