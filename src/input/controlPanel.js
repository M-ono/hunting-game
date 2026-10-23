import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';

/** 操作パネルの背景（ゲーム画面の下）。縮小して左右や下に余白が見えても切れないよう、大きめに敷く */
export function addPanelBackground(scene, top, bottom) {
  const { width } = CONFIG.screen;
  const height = bottom - top + 1000;
  scene.add.rectangle(width / 2, top + height / 2, width * 3, height, CONFIG.colors.hudBand).setDepth(DEPTH.controls - 1);
  scene.add.rectangle(width / 2, top, width * 3, 4, 0xffffff, 0.15).setDepth(DEPTH.controls - 1);
}

/**
 * ◀ ▶ ▲ と、斜め上（移動しながらジャンプ）の小さな矢印を描く。押している向きを光らせる
 * @param {Phaser.GameObjects.Graphics} g
 * @param {{ x: number, y: number }} center
 * @param {number} distance 中心から矢印までの距離
 * @param {{ x: number, jump: boolean } | null} pressed 押している向き（押していなければ null）
 * @param {number} size 大きい矢印の大きさ
 * @param {number} alpha 光っていない矢印の濃さ
 */
export function drawArrows(g, center, distance, pressed, size, alpha) {
  const x = pressed?.x ?? 0;
  const jump = pressed?.jump ?? false;
  // deg の向きの三角形（0 = 右、90 = 上）
  const arrow = (deg, s, lit) => {
    const a = (deg * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = -Math.sin(a);
    const cx = center.x + ux * distance;
    const cy = center.y + uy * distance;
    g.fillStyle(lit ? CONFIG.colors.controlLit : 0xffffff, lit ? 1 : alpha);
    g.fillTriangle(
      cx + ux * s,
      cy + uy * s,
      cx - ux * s * 0.6 - uy * s * 0.85,
      cy - uy * s * 0.6 + ux * s * 0.85,
      cx - ux * s * 0.6 + uy * s * 0.85,
      cy - uy * s * 0.6 - ux * s * 0.85,
    );
  };
  arrow(0, size, pressed && x > 0 && !jump);
  arrow(180, size, pressed && x < 0 && !jump);
  arrow(90, size, pressed && jump && x === 0);
  arrow(45, size * 0.67, pressed && jump && x > 0);
  arrow(135, size * 0.67, pressed && jump && x < 0);
}
