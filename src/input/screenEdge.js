import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { nearScreenEdge } from './controlLayout.js';

/**
 * 指が画面の端の近くから触り始めたか。近ければその端を少し光らせて知らせ、端の名前を返す（操作にはしない）。
 * スマホでは画面の端からのスワイプが「戻る」やホームへの移動になりやすいので、端から始めたタッチは受け付けない。
 * @param {Phaser.Scene} scene
 * @param {Phaser.Input.Pointer} pointer
 * @returns {'left' | 'right' | 'bottom' | null}
 */
export function rejectEdgeTouch(scene, pointer) {
  const { displayScale, displaySize, gameSize } = scene.scale;
  // pointer.x / y はキャンバスの座標。画面上の大きさ（CSS px）に直して判定する
  const edge = nearScreenEdge(
    { x: pointer.x / displayScale.x, y: pointer.y / displayScale.y },
    displaySize,
    CONFIG.controls,
  );
  if (!edge) return null;

  // 光らせる帯（キャンバスの座標）を、ステージの座標に直して描く（ゲーム画面が縮小されていてもずれないように）
  const side = CONFIG.controls.edgeGuardSide * displayScale.x;
  const bottom = CONFIG.controls.edgeGuardBottom * displayScale.y;
  const { width, height } = gameSize;
  const [x1, y1, x2, y2] = {
    left: [0, 0, side, height],
    right: [width - side, 0, width, height],
    bottom: [0, height - bottom, width, height],
  }[edge];
  const camera = scene.cameras.main;
  const a = camera.getWorldPoint(x1, y1);
  const b = camera.getWorldPoint(x2, y2);
  const strip = scene.add
    .rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y, 0xffffff, 0.3)
    .setDepth(DEPTH.controls);
  scene.tweens.add({ targets: strip, alpha: 0, duration: 450, onComplete: () => strip.destroy() });
  return edge;
}
