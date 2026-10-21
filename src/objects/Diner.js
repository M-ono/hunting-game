import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';
import { formatMoney } from '../utils/format.js';

/** 食堂（一番上の床に置く）。触れて少し待つと、お金を払って日替わり定食を食べる */
export class Diner {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} floorY 置く床の上面
   */
  constructor(scene, floorY) {
    const { x, width, height, touchMargin } = CONFIG.diner;
    const { dinerWall, dinerRoof, dinerNoren } = CONFIG.colors;
    this.scene = scene;
    this.x = x;
    this.top = floorY - height; // ひさしの上
    this.width = width;
    this.height = height;

    const left = x - width / 2;
    const wallTop = this.top + 26;
    const g = scene.add.graphics().setDepth(DEPTH.stage);
    g.fillStyle(dinerWall, 1).fillRect(left, wallTop, width, floorY - wallTop); // 壁
    g.fillStyle(dinerRoof, 1).fillRect(left - 14, this.top, width + 28, wallTop - this.top); // ひさし
    g.fillStyle(0x3a2a1a, 1).fillRect(x - 44, wallTop + 40, 88, floorY - wallTop - 40); // 入口
    g.fillStyle(dinerNoren, 1).fillRect(left + 22, wallTop, width - 44, 58); // のれん

    this.sign = addText(scene, x, wallTop + 24, '食堂', { size: 36, stroke: 6 }).setDepth(DEPTH.stage + 1);
    addText(scene, x, this.top - 50, `日替わり定食 ${formatMoney(CONFIG.meal.price, CONFIG.money.unit)}`, {
      size: 30,
      bold: false,
      stroke: 6,
    }).setDepth(DEPTH.stage + 1);

    // 食べるまでの待ち時間を示すバー
    this.progressBar = scene.add.graphics().setDepth(DEPTH.stage + 2);

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

  /** 食べるまでの待ち時間の進み具合（0〜1）。0 でバーを消す */
  setProgress(ratio) {
    const g = this.progressBar.clear();
    if (ratio <= 0) return;
    const left = this.x - this.width / 2;
    const y = this.top - 22;
    g.fillStyle(0x000000, 0.6).fillRect(left, y, this.width, 14);
    g.fillStyle(0xffffff, 0.95).fillRect(left, y, this.width * Math.min(1, ratio), 14);
  }

  /** 食べ終わったときに、ぱっと光らせる */
  burst() {
    const ring = this.scene.add
      .circle(this.x, this.top + this.height / 2, 70, CONFIG.colors.capacityAura, 0.7)
      .setDepth(DEPTH.effect);
    this.scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }
}
