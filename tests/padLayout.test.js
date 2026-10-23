import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { onPadSide, padDirection, padLayout } from '../src/input/padLayout.js';

const options = { padDeadZone: 28, padJumpAngle: 35, padMoveThreshold: 0.38 };
// 角度（0 = 右、90 = 上）と距離から、十字キーの中心から見た指の位置を作る
const at = (deg, distance = 100) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * distance, -Math.sin(a) * distance];
};

test('十字キー：中心の近くは何もしない', () => {
  assert.deepEqual(padDirection(10, -15, options), { x: 0, jump: false });
});

test('十字キー：左右で移動。少し上や下にずれても左右のまま（うっかりジャンプしない）', () => {
  assert.deepEqual(padDirection(...at(0), options), { x: 1, jump: false });
  assert.deepEqual(padDirection(...at(180), options), { x: -1, jump: false });
  assert.deepEqual(padDirection(...at(25), options), { x: 1, jump: false });
  assert.deepEqual(padDirection(...at(155), options), { x: -1, jump: false });
  assert.deepEqual(padDirection(...at(-40), options), { x: 1, jump: false }); // 右下
});

test('十字キー：上でその場ジャンプ、斜め上で移動しながらジャンプ、真下は何もしない', () => {
  assert.deepEqual(padDirection(...at(90), options), { x: 0, jump: true });
  assert.deepEqual(padDirection(...at(75), options), { x: 0, jump: true });
  assert.deepEqual(padDirection(...at(45), options), { x: 1, jump: true });
  assert.deepEqual(padDirection(...at(135), options), { x: -1, jump: true });
  assert.deepEqual(padDirection(...at(-90), options), { x: 0, jump: false });
});

test('操作パネル：十字キーは右下、攻撃ボタンはその左。重ならず、画面の端から離れている', () => {
  const layout = padLayout(CONFIG);
  const { width, height } = CONFIG.screen;
  const { pad, attack } = layout;
  assert.equal(layout.top, height, 'パネルはゲーム画面のすぐ下');
  assert.equal(layout.bottom, height + CONFIG.controls.panelHeight);
  assert.ok(pad.x > attack.x, '十字キーが右');
  assert.ok(Math.hypot(pad.x - attack.x, pad.y - attack.y) > pad.radius + attack.radius, '十字キーと攻撃ボタンが重なっている');
  assert.ok(width - (pad.x + pad.radius) >= CONFIG.controls.padMargin, '十字キーが画面の右端に近すぎる');
  assert.ok(attack.x - attack.radius >= 100, '攻撃ボタンが画面の左端に近すぎる');
  for (const button of [pad, attack]) {
    assert.ok(button.y - button.radius >= layout.top, 'ボタンがゲーム画面にはみ出している');
    assert.ok(layout.bottom - (button.y + button.radius) >= 60, 'ボタンが画面の下端に近すぎる');
  }
  // 十字キーの円はすべて十字キー側、攻撃ボタンの円はすべて攻撃ボタン側
  assert.ok(onPadSide(layout, pad.x - pad.radius) && !onPadSide(layout, attack.x + attack.radius));
});

test('操作パネル：padSide を left にすると左右が入れ替わる', () => {
  const right = padLayout(CONFIG);
  const left = padLayout({ ...CONFIG, controls: { ...CONFIG.controls, padSide: 'left' } });
  const { width } = CONFIG.screen;
  assert.equal(left.pad.x, width - right.pad.x);
  assert.equal(left.attack.x, width - right.attack.x);
  assert.ok(onPadSide(left, left.pad.x) && onPadSide(left, left.pad.x + left.pad.radius));
  assert.ok(!onPadSide(left, left.attack.x) && !onPadSide(left, left.attack.x - left.attack.radius));
});
