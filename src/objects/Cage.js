import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';

/** 檻（一番上の床に置く）。触れると持っている獲物をすべて入れる。中の数がスコア */
export class Cage {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} floorY 置く床の上面
   */
  constructor(scene, floorY) {
    const { x, width, height, touchMargin } = CONFIG.cage;
    const { cage: color, cageFloor } = CONFIG.colors;
    this.scene = scene;

    const left = x - width / 2;
    const top = floorY - height;
    scene.add.rectangle(x, floorY - height / 2, width, height, cageFloor, 0.9).setDepth(DEPTH.stage);

    // 檻の格子
    const g = scene.add.graphics().setDepth(DEPTH.stage + 1);
    g.lineStyle(10, color, 1).strokeRect(left, top, width, height);
    g.lineStyle(6, color, 1);
    for (let bx = left + 36; bx < left + width; bx += 36) {
      g.lineBetween(bx, top, bx, floorY);
    }

    this.label = addText(scene, x, top + height / 2, '檻 0', { size: 44 }).setDepth(DEPTH.stage + 2);
    addText(scene, x, top - 30, '獲物を運んでタッチ', { size: 30, bold: false, stroke: 6 }).setDepth(DEPTH.stage + 2);

    // この範囲にプレイヤーの体が重なったら「触れた」とみなす（通り抜けられる）
    this.touchArea = new Phaser.Geom.Rectangle(
      left - touchMargin,
      top - touchMargin,
      width + touchMargin * 2,
      height + touchMargin * 2,
    );
  }

  /** @param {Phaser.Physics.Arcade.Body} body プレイヤーの体 */
  isTouching(body) {
    return Phaser.Geom.Intersects.RectangleToValues(this.touchArea, body.left, body.right, body.top, body.bottom);
  }

  setCount(count) {
    this.label.setText(`檻 ${count}`);
  }

  /** 数が変わったときに少し弾ませる */
  bounce() {
    this.bounceTween?.stop();
    this.label.setScale(1);
    this.bounceTween = this.scene.tweens.add({ targets: this.label, scale: 1.4, duration: 120, yoyo: true });
  }
}
