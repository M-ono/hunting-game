import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';

/** 焚き火（一番上の床に置く）。触れて少し待つと、檻の獲物を消費して料理する */
export class Campfire {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} floorY 置く床の上面
   */
  constructor(scene, floorY) {
    const { x, radius, touchMargin } = CONFIG.campfire;
    const { campfire, campfireCore } = CONFIG.colors;
    this.scene = scene;
    this.x = x;
    this.y = floorY - radius; // 炎の中心
    this.radius = radius;

    // 薪
    const logs = scene.add.graphics().setDepth(DEPTH.stage);
    logs.fillStyle(0x6b3e1e, 1);
    logs.fillRoundedRect(x - radius * 1.2, floorY - 22, radius * 2.4, 18, 8);
    logs.fillRoundedRect(x - radius, floorY - 34, radius * 2, 16, 8);

    // 炎（通り抜けられる）。ゆらゆら動かす
    this.flame = scene.add.circle(x, this.y, radius, campfire).setDepth(DEPTH.stage + 1);
    this.core = scene.add.circle(x, this.y + radius * 0.25, radius * 0.5, campfireCore).setDepth(DEPTH.stage + 2);
    scene.tweens.add({ targets: this.flame, scaleY: 1.12, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: this.core, scale: 0.85, duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 料理の進み具合を示す輪
    this.progressRing = scene.add.graphics().setDepth(DEPTH.stage + 3);

    addText(scene, x, this.y - radius - 50, `焚き火：檻の獲物${CONFIG.cooking.cost}匹で料理`, {
      size: 30,
      bold: false,
      stroke: 6,
    })
      .setDepth(DEPTH.stage + 3)
      .setOrigin(0.7, 0.5);

    this.touchArea = new Phaser.Geom.Rectangle(
      x - radius - touchMargin,
      this.y - radius - touchMargin,
      (radius + touchMargin) * 2,
      radius * 2 + touchMargin,
    );
  }

  /** @param {Phaser.Physics.Arcade.Body} body プレイヤーの体 */
  isTouching(body) {
    return Phaser.Geom.Intersects.RectangleToValues(this.touchArea, body.left, body.right, body.top, body.bottom);
  }

  /** 料理の進み具合（0〜1）。0 で輪を消す */
  setProgress(ratio) {
    const g = this.progressRing.clear();
    if (ratio <= 0) return;
    g.lineStyle(12, 0xffffff, 0.95);
    g.beginPath();
    g.arc(this.x, this.y, this.radius + 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
    g.strokePath();
  }

  /** 料理ができたときにぱっと燃え上がる */
  burst() {
    const ring = this.scene.add
      .circle(this.x, this.y, this.radius, CONFIG.colors.campfireCore, 0.7)
      .setDepth(DEPTH.effect);
    this.scene.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }
}
