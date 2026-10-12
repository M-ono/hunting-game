import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { describeEffect } from '../systems/cooking.js';
import { formatClock } from '../utils/format.js';
import { addText } from './text.js';

/** 画面上部の帯：残り時間・スコア・所持数・速度・料理の効果 */
export class Hud {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    const { width } = CONFIG.screen;
    const bandHeight = CONFIG.field.y;

    scene.add
      .rectangle(width / 2, bandHeight / 2, width, bandHeight, CONFIG.colors.hudBand)
      .setDepth(DEPTH.hud);

    const row1 = 62;
    const row2 = 146;
    const make = (x, y, originX, size) =>
      addText(scene, x, y, '', { size }).setOrigin(originX, 0.5).setDepth(DEPTH.hud);

    this.timeText = make(40, row1, 0, 60);
    this.scoreText = make(width / 2, row1, 0.5, 60);
    this.carryText = make(width - 40, row1, 1, 60);
    this.speedText = make(40, row2, 0, 42);
    this.effectText = make(width - 40, row2, 1, 42).setColor('#ffe066');
  }

  /**
   * @param {object} state
   * @param {number} state.remainingMs 残り時間
   * @param {number} state.score スコア（檻の獲物の数）
   * @param {number} state.carried 持っている数
   * @param {number} state.capacity 一度に持てる数
   * @param {number} state.speedRate 基本速度に対する今の速度の割合
   * @param {{ type: string, value: number, remainingMs: number }[]} state.effects 効いている効果
   */
  update({ remainingMs, score, carried, capacity, speedRate, effects }) {
    this.timeText.setText(`のこり ${formatClock(remainingMs)}`).setColor(remainingMs <= 10000 ? '#ff6b6b' : '#ffffff');
    this.scoreText.setText(`スコア ${score}`);
    this.carryText.setText(`所持 ${carried}/${capacity}`).setColor(carried >= capacity ? '#ffe066' : '#ffffff');
    this.speedText.setText(`速度 ${Math.round(speedRate * 100)}%`);
    this.effectText.setText(
      effects.map((effect) => `${describeEffect(effect)} あと${Math.ceil(effect.remainingMs / 1000)}秒`).join('  '),
    );
  }
}
