// 操作パネル（十字キーと攻撃ボタン）の配置と、十字キーの向きの判定。
// Phaser に依存しないので、node --test で単体テストできる。

/**
 * 操作パネルの配置。ゲーム画面（config.screen）の下に足す。十字キーは padSide の側の下寄り、攻撃ボタンはその内側。
 * @param {typeof import('../config.js').CONFIG} config
 * @returns {{ top: number, bottom: number, zoneTop: number, split: number, padSide: string,
 *   pad: { x: number, y: number, radius: number }, attack: { x: number, y: number, radius: number } }}
 *   split より十字キー側を触ると十字キー、反対側を触ると攻撃ボタンとして扱う（多少外れて触っても効く）。
 *   zoneTop はパネルの少し上。十字キーの上（ジャンプ）を狙った指がパネルからはみ出しても効くように
 */
export function padLayout(config) {
  const { width, height } = config.screen;
  const { panelHeight, padRadius, padMargin, attackRadius, padSide } = config.controls;
  const flip = (x) => (padSide === 'left' ? width - x : x);
  const padX = width - padMargin - padRadius;
  const attackX = padX - padRadius - 60 - attackRadius;
  return {
    top: height,
    bottom: height + panelHeight,
    zoneTop: height - 80,
    split: flip(padX - padRadius - 30),
    padSide,
    pad: { x: flip(padX), y: height + panelHeight / 2 - 20, radius: padRadius },
    attack: { x: flip(attackX), y: height + panelHeight / 2, radius: attackRadius },
  };
}

/** x が十字キー側か（反対側は攻撃ボタン） */
export function onPadSide(layout, x) {
  return layout.padSide === 'left' ? x <= layout.split : x >= layout.split;
}

/**
 * 十字キーの中心から見た指の位置（dx, dy。y は下が正）を、移動とジャンプの入力に変える。
 * - 中心の近く（padDeadZone 以内）は何もしない
 * - 水平から padJumpAngle 度以上、上を触るとジャンプ。左右の成分が padMoveThreshold 以上なら移動しながら
 * - それ以外は左右の移動（右下・左下も左右として扱う。真下は何もしない）
 * @returns {{ x: -1 | 0 | 1, jump: boolean }}
 */
export function padDirection(dx, dy, { padDeadZone, padJumpAngle, padMoveThreshold }) {
  const distance = Math.hypot(dx, dy);
  if (distance <= padDeadZone) return { x: 0, jump: false };
  const nx = dx / distance;
  const up = -dy / distance;
  return {
    x: Math.abs(nx) >= padMoveThreshold ? Math.sign(nx) : 0,
    jump: up >= Math.sin((padJumpAngle * Math.PI) / 180),
  };
}
