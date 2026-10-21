import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { describeEffect } from '../systems/meal.js';
import { formatClock, formatMoney } from '../utils/format.js';
import { addText } from './text.js';

/** 文字か色が変わったときだけ描き直す（毎フレーム描き直すと重くなるため） */
function show(text, value, color = '#ffffff') {
  if (text.text !== value) text.setText(value);
  if (text.style.color !== color) text.setColor(color);
}

/** 画面上部の帯：残り時間・所持金・持っている獲物の数・速度・定食の効果 */
export class Hud {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    const { width } = CONFIG.screen;
    const bandHeight = CONFIG.field.y;
    this.scene = scene;

    scene.add
      .rectangle(width / 2, bandHeight / 2, width, bandHeight, CONFIG.colors.hudBand)
      .setDepth(DEPTH.hud);

    const row1 = 62;
    const row2 = 146;
    const make = (x, y, originX, size) =>
      addText(scene, x, y, '', { size }).setOrigin(originX, 0.5).setDepth(DEPTH.hud);

    // 所持金は4〜5桁になっても左右の文字に重ならないよう、少し右に寄せる
    this.timeText = make(40, row1, 0, 54);
    this.moneyText = make(width / 2 + 20, row1, 0.5, 54);
    this.carryText = make(width - 40, row1, 1, 54);
    this.speedText = make(40, row2, 0, 42);
    this.effectText = make(width - 40, row2, 1, 42);

    this.moneyFlash = { color: '#ffffff', until: 0 };
  }

  /** 所持金を少しの間 color で光らせて弾ませる（増えたら金色、減ったら赤） */
  flashMoney(color, now) {
    this.moneyFlash = { color, until: now + 600 };
    this.moneyTween?.stop();
    this.moneyText.setScale(1);
    this.moneyTween = this.scene.tweens.add({ targets: this.moneyText, scale: 1.25, duration: 120, yoyo: true });
  }

  /**
   * @param {object} state
   * @param {number} state.now ゲーム内時刻
   * @param {number} state.remainingMs 残り時間
   * @param {number} state.money 所持金
   * @param {number} state.carried 持っている数
   * @param {number} state.capacity 一度に持てる数
   * @param {number} state.speedRate 基本速度に対する今の速度の割合
   * @param {{ type: string, value: number, remainingMs: number }[]} state.effects 効いている効果
   */
  update({ now, remainingMs, money, carried, capacity, speedRate, effects }) {
    show(this.timeText, `のこり ${formatClock(remainingMs)}`, remainingMs <= 10000 ? '#ff6b6b' : '#ffffff');
    show(
      this.moneyText,
      `所持金 ${formatMoney(money, CONFIG.money.unit)}`,
      now < this.moneyFlash.until ? this.moneyFlash.color : '#ffffff',
    );
    show(this.carryText, `獲物 ${carried}/${capacity}`, carried >= capacity ? '#ffe066' : '#ffffff');
    show(this.speedText, `速度 ${Math.round(speedRate * 100)}%`);
    show(
      this.effectText,
      effects.map((effect) => `${describeEffect(effect)} あと${Math.ceil(effect.remainingMs / 1000)}秒`).join('  '),
      '#ffe066',
    );
  }
}
