import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES } from '../constants.js';
import { addText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';
import { loadBestScore, saveBestScore } from '../utils/bestScore.js';

/** リザルト：スコアとベスト記録。タップでもう一度 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SCENES.result);
  }

  /** @param {{ score?: number, cookCount?: number }} data */
  create({ score = 0, cookCount = 0 } = {}) {
    keepCameraCentered(this);
    const { width, height } = CONFIG.screen;
    const cx = width / 2;

    const previousBest = loadBestScore();
    const isNewBest = score > previousBest;
    if (isNewBest) saveBestScore(score);

    this.add.rectangle(cx, height / 2, width, height, CONFIG.colors.hudBand);
    addText(this, cx, 420, 'タイムアップ！', { size: 96, color: '#ffe066', stroke: 12 });
    addText(this, cx, 700, `スコア ${score}匹`, { size: 132, stroke: 14 });
    addText(this, cx, 900, isNewBest ? '新記録！' : `ベスト ${previousBest}匹`, {
      size: 60,
      color: isNewBest ? '#ff9f43' : '#ffffff',
    });
    addText(this, cx, 1010, `料理した回数 ${cookCount}回`, { size: 44, bold: false, stroke: 6 });

    const retry = addText(this, cx, 1400, 'タップでもう一度', { size: 76, color: '#ffe066', stroke: 10 });
    this.tweens.add({ targets: retry, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    // 終了直前のタップでいきなり再開しないよう、少し待ってから受け付ける
    this.time.delayedCall(700, () => {
      const again = () => this.scene.start(SCENES.game);
      this.input.once('pointerup', again);
      this.input.keyboard?.once('keydown-SPACE', again);
    });
  }
}
