import Phaser from 'phaser';

/** PC のキー：←→/AD で移動、↑/W/Space でジャンプ、Z/J で攻撃 */
export function addControlKeys(scene) {
  return scene.input.keyboard?.addKeys('W,A,D,UP,LEFT,RIGHT,SPACE,Z,J') ?? null;
}

/** キーの入力を input に足す（左右のキーを押していれば、指の入力より優先） */
export function applyControlKeys(keys, input) {
  if (!keys) return;
  const JustDown = Phaser.Input.Keyboard.JustDown;
  const x = (keys.RIGHT.isDown || keys.D.isDown ? 1 : 0) - (keys.LEFT.isDown || keys.A.isDown ? 1 : 0);
  if (x !== 0) input.x = x;
  if (JustDown(keys.UP) || JustDown(keys.W) || JustDown(keys.SPACE)) input.jump = true;
  if (JustDown(keys.Z) || JustDown(keys.J)) input.attack = true;
}
