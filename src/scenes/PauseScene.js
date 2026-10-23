import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES } from '../constants.js';
import { addText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';

/** 一時停止（「戻る」操作やアプリの切り替えで止まったとき）。本編の上に重ねて出し、タップで再開 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create() {
    keepCameraCentered(this);
    const { width, height } = CONFIG.screen;
    this.add.rectangle(width / 2, height / 2, width * 3, height * 3, 0x000000, 0.6);
    addText(this, width / 2, 860, '一時停止', { size: 104, color: '#ffe066', stroke: 12 });
    const resume = addText(this, width / 2, 1060, 'タップで再開', { size: 68, stroke: 10 });
    this.tweens.add({ targets: resume, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    // 止まるきっかけになったタッチでいきなり再開しないよう、少し待ってから受け付ける
    this.time.delayedCall(400, () => {
      const again = () => {
        this.scene.stop();
        this.scene.resume(SCENES.game);
      };
      this.input.once('pointerup', again);
      this.input.keyboard?.once('keydown-SPACE', again);
    });
  }
}
