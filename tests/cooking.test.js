import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollCookingEffect, checkCooking, describeEffect } from '../src/systems/cooking.js';
import { EFFECT_CAPACITY, EFFECT_SPEED } from '../src/systems/PlayerStats.js';
import { CONFIG } from '../src/config.js';

const cooking = CONFIG.cooking;

// 決まった順に値を返す乱数の代わり
const sequence = (...values) => {
  let i = 0;
  return () => values[i++];
};

test('乱数が速度アップの確率未満なら移動速度アップ', () => {
  const effect = rollCookingEffect(cooking, sequence(0));
  assert.deepEqual(effect, { type: EFFECT_SPEED, value: cooking.speedBonus });
});

test('それ以外は所持上限アップで、上限は最小〜最大のどれか', () => {
  assert.deepEqual(rollCookingEffect(cooking, sequence(0.99, 0)), {
    type: EFFECT_CAPACITY,
    value: cooking.capacityMin,
  });
  assert.deepEqual(rollCookingEffect(cooking, sequence(0.99, 0.9999)), {
    type: EFFECT_CAPACITY,
    value: cooking.capacityMax,
  });
});

test('本物の乱数でも上限は範囲内に収まる', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const effect = rollCookingEffect(cooking);
    if (effect.type === EFFECT_CAPACITY) {
      assert.ok(effect.value >= cooking.capacityMin && effect.value <= cooking.capacityMax);
      seen.add(effect.value);
    }
  }
  assert.equal(seen.size, cooking.capacityMax - cooking.capacityMin + 1);
});

test('料理できる条件', () => {
  assert.deepEqual(checkCooking({ score: 2, cost: 2, effectActive: false }), { ok: true });
  assert.deepEqual(checkCooking({ score: 1, cost: 2, effectActive: false }), {
    ok: false,
    reason: 'notEnough',
    missing: 1,
  });
  assert.deepEqual(checkCooking({ score: 5, cost: 2, effectActive: true }), { ok: false, reason: 'active' });
});

test('効果の表示テキスト', () => {
  assert.equal(describeEffect({ type: EFFECT_SPEED, value: 0.3 }), '移動速度 +30%');
  assert.equal(describeEffect({ type: EFFECT_CAPACITY, value: 3 }), '所持上限 3匹');
});
