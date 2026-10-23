import Phaser from 'phaser';
import { CONFIG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { TitleScene } from './scenes/TitleScene.js';

// URL の末尾に ?debug を付けると、当たり判定の表示などの確認用機能が使える
const debug = new URLSearchParams(window.location.search).has('debug');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: CONFIG.colors.background,
  scale: {
    // 画面全体にキャンバスを広げ（どこを触っても操作できる）、1080×1920 の範囲が必ず収まるように拡大縮小する
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CONFIG.screen.width,
    height: CONFIG.screen.height,
  },
  // 十字キーと攻撃ボタンを2本の指で同時に押せるように、指を3本まで受け付ける
  input: { activePointers: 3 },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: CONFIG.physics.gravity }, debug },
  },
  // PauseScene は本編の上に重ねて表示するので、GameScene より後ろに置く
  scene: [BootScene, TitleScene, GameScene, ResultScene, PauseScene],
});

game.registry.set('debug', debug);
if (debug) {
  // ブラウザの開発者ツールから game や CONFIG を触って、その場で数値を試せる
  window.game = game;
  window.CONFIG = CONFIG;
}
