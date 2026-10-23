import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  joystickLayout,
  leftJumpZone,
  onPadSide,
  padDirection,
  padLayout,
  stickDirection,
} from '../src/input/controlLayout.js';

// 角度（0 = 右、90 = 上）と距離から、中心から見た指の位置を作る
const at = (deg, distance = 100) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * distance, -Math.sin(a) * distance];
};

// ---- ジョイスティック ----

const stick = { deadZone: 24, moveThreshold: 0.3, jumpAngle: 35, jumpMinDistance: 50 };

test('ジョイスティック：中心の近くは何もしない（タップしても動かない）', () => {
  assert.deepEqual(stickDirection(10, -15, stick), { x: 0, jump: false });
});

test('ジョイスティック：左右に倒すと移動。少し上にずれても跳ばない', () => {
  assert.deepEqual(stickDirection(...at(0), stick), { x: 1, jump: false });
  assert.deepEqual(stickDirection(...at(180), stick), { x: -1, jump: false });
  assert.deepEqual(stickDirection(...at(20), stick), { x: 1, jump: false });
  assert.deepEqual(stickDirection(...at(-45), stick), { x: 1, jump: false }); // 右下
});

test('ジョイスティック：上へはじくとジャンプ、斜め上なら移動しながら。上へ少しだけでは跳ばない', () => {
  assert.deepEqual(stickDirection(...at(90, 80), stick), { x: 0, jump: true });
  assert.deepEqual(stickDirection(...at(45, 110), stick), { x: 1, jump: true });
  assert.deepEqual(stickDirection(...at(135, 110), stick), { x: -1, jump: true });
  assert.deepEqual(stickDirection(...at(90, 40), stick), { x: 0, jump: false }); // 上へ40しか動いていない
});

test('ジョイスティック：一度跳んだら、十分に戻すまで次は跳ばない（少しのぶれで何度も跳ばない）', () => {
  assert.equal(leftJumpZone(...at(90, 100), stick), false);
  assert.equal(leftJumpZone(...at(30, 100), stick), false); // 35°より少し下がっただけ
  assert.equal(leftJumpZone(...at(15, 100), stick), true); // 横まで戻した
  assert.equal(leftJumpZone(...at(90, 25), stick), true); // 中心近くまで戻した
});

test('ジョイスティックの配置：ふだんは右下で、操作パネルに収まり画面の端から離れている。使い方の文字は反対側', () => {
  const layout = joystickLayout(CONFIG);
  const { width, height } = CONFIG.screen;
  const { home, radius, hint } = layout;
  assert.equal(layout.top, height, 'パネルはゲーム画面のすぐ下');
  assert.equal(layout.bottom, height + CONFIG.controls.panelHeight);
  assert.ok(home.x > width / 2, 'ジョイスティックが右側にない');
  assert.ok(width - (home.x + radius) >= CONFIG.controls.padMargin, 'ジョイスティックが画面の右端に近すぎる');
  assert.ok(home.y - radius >= layout.top, 'ジョイスティックがゲーム画面にはみ出している');
  assert.ok(layout.bottom - (home.y + radius) >= 60, 'ジョイスティックが画面の下端に近すぎる');
  assert.ok(hint.x < home.x - radius, '使い方の文字がジョイスティックに重なる');

  const left = joystickLayout({ ...CONFIG, controls: { ...CONFIG.controls, padSide: 'left' } });
  assert.equal(left.home.x, width - home.x, 'padSide: left で左右が入れ替わらない');
  assert.equal(left.hint.x, width - hint.x);
});

// ---- 十字キー ----

const pad = { padDeadZone: 28, padJumpAngle: 35, padMoveThreshold: 0.38 };

test('十字キー：中心の近くは何もしない', () => {
  assert.deepEqual(padDirection(10, -15, pad), { x: 0, jump: false });
});

test('十字キー：左右で移動。少し上や下にずれても左右のまま（うっかりジャンプしない）', () => {
  assert.deepEqual(padDirection(...at(0), pad), { x: 1, jump: false });
  assert.deepEqual(padDirection(...at(180), pad), { x: -1, jump: false });
  assert.deepEqual(padDirection(...at(25), pad), { x: 1, jump: false });
  assert.deepEqual(padDirection(...at(155), pad), { x: -1, jump: false });
  assert.deepEqual(padDirection(...at(-40), pad), { x: 1, jump: false }); // 右下
});

test('十字キー：上でその場ジャンプ、斜め上で移動しながらジャンプ、真下は何もしない', () => {
  assert.deepEqual(padDirection(...at(90), pad), { x: 0, jump: true });
  assert.deepEqual(padDirection(...at(75), pad), { x: 0, jump: true });
  assert.deepEqual(padDirection(...at(45), pad), { x: 1, jump: true });
  assert.deepEqual(padDirection(...at(135), pad), { x: -1, jump: true });
  assert.deepEqual(padDirection(...at(-90), pad), { x: 0, jump: false });
});

test('十字キーの配置：十字キーは右下、攻撃ボタンはその左。重ならず、画面の端から離れている', () => {
  const layout = padLayout(CONFIG);
  const { width, height } = CONFIG.screen;
  const { pad: dpad, attack } = layout;
  assert.equal(layout.top, height, 'パネルはゲーム画面のすぐ下');
  assert.ok(dpad.x > attack.x, '十字キーが右');
  assert.ok(Math.hypot(dpad.x - attack.x, dpad.y - attack.y) > dpad.radius + attack.radius, '十字キーと攻撃ボタンが重なっている');
  assert.ok(width - (dpad.x + dpad.radius) >= CONFIG.controls.padMargin, '十字キーが画面の右端に近すぎる');
  assert.ok(attack.x - attack.radius >= 100, '攻撃ボタンが画面の左端に近すぎる');
  for (const button of [dpad, attack]) {
    assert.ok(button.y - button.radius >= layout.top, 'ボタンがゲーム画面にはみ出している');
    assert.ok(layout.bottom - (button.y + button.radius) >= 60, 'ボタンが画面の下端に近すぎる');
  }
  // 十字キーの円はすべて十字キー側、攻撃ボタンの円はすべて攻撃ボタン側
  assert.ok(onPadSide(layout, dpad.x - dpad.radius) && !onPadSide(layout, attack.x + attack.radius));
});

test('十字キーの配置：padSide を left にすると左右が入れ替わる', () => {
  const right = padLayout(CONFIG);
  const left = padLayout({ ...CONFIG, controls: { ...CONFIG.controls, padSide: 'left' } });
  const { width } = CONFIG.screen;
  assert.equal(left.pad.x, width - right.pad.x);
  assert.equal(left.attack.x, width - right.attack.x);
  assert.ok(onPadSide(left, left.pad.x) && onPadSide(left, left.pad.x + left.pad.radius));
  assert.ok(!onPadSide(left, left.attack.x) && !onPadSide(left, left.attack.x - left.attack.radius));
});
