import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES } from '../constants.js';
import { addText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';
import { loadBestScore, saveBestScore } from '../utils/bestScore.js';
import { formatMoney } from '../utils/format.js';

/** リザルト：残ったお金（記録）・稼いだお金・使ったお金とベスト記録。タップでもう一度 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SCENES.result);
  }

  /** @param {{ money?: number, earned?: number, spent?: number, mealCount?: number }} data */
  create({ money = 0, earned = 0, spent = 0, mealCount = 0 } = {}) {
    keepCameraCentered(this);
    const { width, height } = CONFIG.screen;
    const cx = width / 2;
    const yen = (amount) => formatMoney(amount, CONFIG.money.unit);

    const previousBest = loadBestScore();
    const isNewBest = money > previousBest;
    if (isNewBest) saveBestScore(money);

    this.add.rectangle(cx, height / 2, width, height, CONFIG.colors.hudBand);
    addText(this, cx, 420, 'タイムアップ！', { size: 96, color: '#ffe066', stroke: 12 });
    addText(this, cx, 590, '所持金', { size: 56, bold: false, stroke: 8 });
    addText(this, cx, 735, yen(money), { size: 132, color: '#ffe066', stroke: 14 });
    addText(this, cx, 900, isNewBest ? '新記録！' : `ベスト ${yen(previousBest)}`, {
      size: 60,
      color: isNewBest ? '#ff9f43' : '#ffffff',
    });
    addText(
      this,
      cx,
      1060,
      `稼いだお金 ${yen(earned)}\n使ったお金 ${yen(spent)}（日替わり定食 ${mealCount}回）`,
      { size: 44, bold: false, stroke: 6 },
    ).setLineSpacing(16);

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
