import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';

/**
 * 共通の見た目の文字を置く（中心基準）。
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {{ size?: number, color?: string, bold?: boolean, stroke?: number }} [options]
 */
export function addText(scene, x, y, text, { size = 48, color = '#ffffff', bold = true, stroke = 8 } = {}) {
  return scene.add
    .text(x, y, text, {
      fontFamily: CONFIG.ui.fontFamily,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      stroke: '#000000',
      strokeThickness: stroke,
      align: 'center',
    })
    .setOrigin(0.5);
}

/** ふわっと浮かんで消える文字（「+1」「いっぱい！」など） */
export function floatText(scene, x, y, text, { color = '#ffffff', size = 46, rise = 90, duration = 900 } = {}) {
  const label = addText(scene, x, y, text, { size, color }).setDepth(DEPTH.effect);
  scene.tweens.add({
    targets: label,
    y: y - rise,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
  return label;
}
