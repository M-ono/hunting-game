import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES, preyTextureKey } from '../constants.js';
import { addText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';
import { loadBestScore } from '../utils/bestScore.js';
import { formatDuration, formatMoney } from '../utils/format.js';

/** タイトル：遊び方と獲物の値段を見せて、タップで開始 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.title);
  }

  create() {
    keepCameraCentered(this);
    const { width, height } = CONFIG.screen;
    const cx = width / 2;
    const { meal, prey } = CONFIG;
    const yen = (amount) => formatMoney(amount, CONFIG.money.unit);

    this.add.rectangle(cx, height / 2, width, height, CONFIG.colors.field);
    addText(this, cx, 330, 'ハンティング\nゲーム（仮）', { size: 116, stroke: 12 }).setLineSpacing(10);

    const side = CONFIG.controls.padSide === 'left' ? '左下' : '右下';
    const controlsHowTo = {
      joystick: [
        `${side}のジョイスティック … 倒して移動`,
        '　上にはじく … ジャンプ（斜め上で移動しながら）',
        '　軽くタップ … まわりを攻撃',
      ],
      pad: [
        `${side}の十字キー … ◀ ▶ 移動　▲ ジャンプ`,
        '　斜め上を押す … 移動しながらジャンプ',
        '攻撃ボタン … まわりを攻撃（押したままで連続）',
      ],
      stick: [
        '画面の端以外をドラッグ … スティック',
        '　左右に倒す … 移動',
        '　上にはじく … ジャンプ（斜め上で移動しながら）',
        'タップ … まわりを攻撃',
      ],
    }[CONFIG.controls.mode];
    const howTo = [
      ...controlsHowTo,
      '床の穴をジャンプで通り抜ける … 上の段へ',
      '床の穴から飛び降りる … 下の段へ',
      `${prey.maxHp === 1 ? '攻撃を当てる' : `${prey.maxHp}回当てる`}と獲物が気絶 → ふれて捕まえる`,
      '一番上のギルドに届ける … 獲物を売ってお金に',
      `食堂 … ${yen(meal.price)}で日替わり定食（持てる数が${meal.capacityMin}〜${meal.capacityMax}匹に）`,
      '',
      '獲物を持っていると、同じ段の獲物が襲ってくる！',
      '攻撃されると、持っている獲物が逃げる',
    ];
    // 説明は上端をそろえて置く（行が増えても下の文字と重ならないように、下の文字は上の文字の下端から並べる）
    const guide = addText(this, cx, 540, howTo.join('\n'), { size: 38, bold: false, stroke: 6 })
      .setLineSpacing(10)
      .setOrigin(0.5, 0);

    // 獲物の見本：色と値段（安い順）。足元をそろえて並べる
    const legendTitle = addText(this, cx, guide.getBounds().bottom + 40, '深い段の獲物ほど高く売れる', {
      size: 38,
      stroke: 6,
    }).setOrigin(0.5, 0);
    const kinds = prey.types.map((type, index) => ({ type, index })).sort((a, b) => a.type.price - b.type.price);
    const tallest = Math.max(...prey.types.map((type) => type.height));
    const feetY = legendTitle.getBounds().bottom + 24 + tallest;
    let legendBottom = feetY;
    kinds.forEach(({ type, index }, i) => {
      const x = cx + (i - (kinds.length - 1) / 2) * 200;
      this.add.image(x, feetY - type.height / 2, preyTextureKey(index));
      const price = addText(this, x, feetY + 12, yen(type.price), { size: 40, stroke: 6 }).setOrigin(0.5, 0);
      legendBottom = price.getBounds().bottom;
    });

    const pcHint = addText(this, cx, legendBottom + 50, 'PC：←→ 移動　↑ ジャンプ　Z 攻撃', {
      size: 30,
      bold: false,
      stroke: 6,
    });

    const info = addText(
      this,
      cx,
      pcHint.getBounds().bottom + 70,
      `制限時間 ${formatDuration(CONFIG.round.timeLimitSec)}　ベスト ${yen(loadBestScore())}`,
      { size: 46 },
    );

    const start = addText(this, cx, Math.max(1620, info.getBounds().bottom + 90), 'タップでスタート', {
      size: 76,
      color: '#ffe066',
      stroke: 10,
    });
    this.tweens.add({ targets: start, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    const begin = () => this.scene.start(SCENES.game);
    this.input.once('pointerup', begin);
    this.input.keyboard?.once('keydown-SPACE', begin);
  }
}
