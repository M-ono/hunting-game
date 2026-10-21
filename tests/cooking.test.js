import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollCookingEffect, checkCooking, describeEffect } from '../src/systems/cooking.js';
import { EFFECT_CAPACITY } from '../src/systems/PlayerStats.js';
import { CONFIG } from '../src/config.js';

const cooking = CONFIG.cooking;

// 決まった順に値を返す乱数の代わり
const sequence = (...values) => {
  let i = 0;
  return () => values[i++];
};

test('料理の効果は毎回「所持上限アップ」で、上限は最小〜最大のどれか', () => {
  assert.deepEqual(rollCookingEffect(cooking, sequence(0)), { type: EFFECT_CAPACITY, value: cooking.capacityMin });
  assert.deepEqual(rollCookingEffect(cooking, sequence(0.9999)), { type: EFFECT_CAPACITY, value: cooking.capacityMax });
});

test('本物の乱数でも上限は範囲内に収まり、すべての値が出る', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const effect = rollCookingEffect(cooking);
    assert.equal(effect.type, EFFECT_CAPACITY);
    assert.ok(effect.value >= cooking.capacityMin && effect.value <= cooking.capacityMax);
    seen.add(effect.value);
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
  assert.equal(describeEffect({ type: EFFECT_CAPACITY, value: 3 }), '所持上限 3匹');
});
