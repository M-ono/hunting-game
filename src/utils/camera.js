import { CONFIG } from '../config.js';

/**
 * 1080×1920 の設計範囲が、どんな画面でも中央に来るようにカメラを合わせる。
 * Scale.EXPAND では画面の縦横比に合わせて見える範囲が広がるので、リサイズのたびに合わせ直す。
 * @param {Phaser.Scene} scene
 */
export function keepCameraCentered(scene) {
  const { width, height } = CONFIG.screen;
  const center = () => scene.cameras.main.centerOn(width / 2, height / 2);
  center();
  scene.scale.on('resize', center);
  scene.events.once('shutdown', () => scene.scale.off('resize', center));
}
