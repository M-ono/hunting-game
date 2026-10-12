import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES } from '../constants.js';
import { addText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';
import { loadBestScore } from '../utils/bestScore.js';

/** タイトル：遊び方を見せて、タップで開始 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.title);
  }

  create() {
    keepCameraCentered(this);
    const { width, height } = CONFIG.screen;
    const cx = width / 2;

    this.add.rectangle(cx, height / 2, width, height, CONFIG.colors.field);
    addText(this, cx, 330, 'ハンティング\nゲーム（仮）', { size: 116, stroke: 12 }).setLineSpacing(10);

    const howTo = [
      '画面のどこでもドラッグ … スティック',
      '　左右に倒す … 移動',
      '　上にはじく … ジャンプ（斜め上で移動しながら）',
      '床の穴をジャンプで通り抜ける … 上の段へ',
      '床の穴から飛び降りる … 下の段へ',
      'タップ … まわりを攻撃',
      `${CONFIG.prey.maxHp}回当てると獲物が気絶 → ふれて捕まえる`,
      '一番上の檻にふれる … 獲物を入れる（スコア）',
      `焚き火 … 檻の獲物${CONFIG.cooking.cost}匹で料理（ランダムで強化）`,
      '',
      '獲物を持っていると、同じ段の獲物が襲ってくる！',
      '攻撃されると、持っている獲物が逃げる',
    ];
    addText(this, cx, 960, howTo.join('\n'), { size: 38, bold: false, stroke: 6 }).setLineSpacing(14);
    addText(this, cx, 1330, 'PC：←→ 移動　↑ ジャンプ　Z 攻撃', { size: 30, bold: false, stroke: 6 });

    addText(this, cx, 1450, `制限時間 ${CONFIG.round.timeLimitSec}秒　ベスト ${loadBestScore()}`, { size: 46 });

    const start = addText(this, cx, 1620, 'タップでスタート', { size: 76, color: '#ffe066', stroke: 10 });
    this.tweens.add({ targets: start, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    const begin = () => this.scene.start(SCENES.game);
    this.input.once('pointerup', begin);
    this.input.keyboard?.once('keydown-SPACE', begin);
  }
}
