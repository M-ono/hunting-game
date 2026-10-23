import { CONFIG } from '../config.js';

/**
 * 幅 1080 × 高さ height の設計範囲が、どんな画面でも中央に収まるようにカメラを合わせる。
 * Scale.EXPAND では画面の縦横比に合わせて見える範囲が広がるので、リサイズのたびに合わせ直す。
 * 設計範囲が見える範囲より大きいとき（ゲーム画面の下に操作パネルを足したときなど）は、収まるように縮小する。
 * @param {Phaser.Scene} scene
 * @param {number} [height] 設計範囲の高さ（省略すると 1920）
 */
export function keepCameraCentered(scene, height = CONFIG.screen.height) {
  const { width } = CONFIG.screen;
  const fit = () => {
    const camera = scene.cameras.main;
    camera.setZoom(Math.min(1, scene.scale.width / width, scene.scale.height / height));
    camera.centerOn(width / 2, height / 2);
  };
  fit();
  scene.scale.on('resize', fit);
  scene.events.once('shutdown', () => scene.scale.off('resize', fit));
}
