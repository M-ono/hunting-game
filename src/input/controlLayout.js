// 操作パネル（ジョイスティック・十字キー・攻撃ボタン）の配置と、倒した向きの判定。
// Phaser に依存しないので、node --test で単体テストできる。

/**
 * ジョイスティックの配置（mode: 'joystick'）。ゲーム画面（config.screen）の下の操作パネルに置く。
 * パネルのどこを触っても触った位置に出て、触っていないときは padSide の側の下寄り（home）に置いておく。
 * @param {typeof import('../config.js').CONFIG} config
 * @returns {{ top: number, bottom: number, radius: number, home: { x: number, y: number }, hint: { x: number, y: number } }}
 *   hint は使い方の文字の位置（ジョイスティックの反対側）
 */
export function joystickLayout(config) {
  const { width, height } = config.screen;
  const { panelHeight, joystickRadius, padMargin, padSide } = config.controls;
  const flip = (x) => (padSide === 'left' ? width - x : x);
  return {
    top: height,
    bottom: height + panelHeight,
    radius: joystickRadius,
    home: { x: flip(width - padMargin - joystickRadius - 40), y: height + panelHeight / 2 - 10 },
    hint: { x: flip(300), y: height + panelHeight / 2 },
  };
}

/**
 * 十字キーと攻撃ボタンの配置（mode: 'pad'）。十字キーは padSide の側の下寄り、攻撃ボタンはその内側。
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

/** 中心から見た指の位置（dx, dy。y は下が正）を、左右の移動とジャンプに分ける */
function direction(dx, dy, { deadZone, moveThreshold, jumpAngle, jumpMinDistance }) {
  const distance = Math.hypot(dx, dy);
  if (distance <= deadZone) return { x: 0, jump: false };
  return {
    x: Math.abs(dx / distance) >= moveThreshold ? Math.sign(dx) : 0,
    jump: -dy >= jumpMinDistance && -dy / distance >= Math.sin((jumpAngle * Math.PI) / 180),
  };
}

/**
 * ジョイスティックを倒した向き（中心から指まで dx, dy）を、移動とジャンプの入力に変える。
 * - 中心の近く（deadZone 以内）は何もしない。横向きの割合が moveThreshold 以上なら左右に移動
 * - 水平から jumpAngle 度以上、上へ jumpMinDistance 以上はじくとジャンプ（タップや小さなぶれでは跳ばない）
 * @returns {{ x: -1 | 0 | 1, jump: boolean }}
 */
export function stickDirection(dx, dy, { deadZone, moveThreshold, jumpAngle, jumpMinDistance }) {
  return direction(dx, dy, { deadZone, moveThreshold, jumpAngle, jumpMinDistance });
}

/**
 * ジャンプしたあと、指がジャンプの向きから十分戻ったか。少しぶれただけで何度も跳ばないよう、跳ぶ条件より少しゆるめる
 * （上へ jumpMinDistance の6割より戻るか、角度が jumpAngle より12度以上下がったら戻ったとみなす）
 */
export function leftJumpZone(dx, dy, { jumpAngle, jumpMinDistance }) {
  return -dy < jumpMinDistance * 0.6 || -dy / Math.hypot(dx, dy) < Math.sin(((jumpAngle - 12) * Math.PI) / 180);
}

/**
 * 十字キーの中心から見た指の位置を、移動とジャンプの入力に変える（触った位置で向きが決まる）。
 * - 中心の近く（padDeadZone 以内）は何もしない
 * - 水平から padJumpAngle 度以上、上を触るとジャンプ。左右の成分が padMoveThreshold 以上なら移動しながら
 * - それ以外は左右の移動（右下・左下も左右として扱う。真下は何もしない）
 * @returns {{ x: -1 | 0 | 1, jump: boolean }}
 */
export function padDirection(dx, dy, { padDeadZone, padJumpAngle, padMoveThreshold }) {
  return direction(dx, dy, {
    deadZone: padDeadZone,
    moveThreshold: padMoveThreshold,
    jumpAngle: padJumpAngle,
    jumpMinDistance: 0,
  });
}
