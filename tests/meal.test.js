import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollMealEffect, checkMeal, describeEffect } from '../src/systems/meal.js';
import { EFFECT_CAPACITY } from '../src/systems/PlayerStats.js';
import { CONFIG } from '../src/config.js';

const meal = CONFIG.meal;

// 決まった順に値を返す乱数の代わり
const sequence = (...values) => {
  let i = 0;
  return () => values[i++];
};

test('定食の効果は毎回「持てる数アップ」で、持てる数は最小〜最大のどれか', () => {
  assert.deepEqual(rollMealEffect(meal, sequence(0)), { type: EFFECT_CAPACITY, value: meal.capacityMin });
  assert.deepEqual(rollMealEffect(meal, sequence(0.9999)), { type: EFFECT_CAPACITY, value: meal.capacityMax });
});

test('本物の乱数でも持てる数は範囲内に収まり、すべての値が出る', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const effect = rollMealEffect(meal);
    assert.equal(effect.type, EFFECT_CAPACITY);
    assert.ok(effect.value >= meal.capacityMin && effect.value <= meal.capacityMax);
    seen.add(effect.value);
  }
  assert.equal(seen.size, meal.capacityMax - meal.capacityMin + 1);
});

test('定食を食べられる条件（お金が足りる・効果中でない）', () => {
  assert.deepEqual(checkMeal({ money: 20, price: 20, effectActive: false }), { ok: true });
  assert.deepEqual(checkMeal({ money: 10, price: 20, effectActive: false }), {
    ok: false,
    reason: 'notEnough',
    missing: 10,
  });
  assert.deepEqual(checkMeal({ money: 50, price: 20, effectActive: true }), { ok: false, reason: 'active' });
});

test('効果の表示テキスト', () => {
  assert.equal(describeEffect({ type: EFFECT_CAPACITY, value: 3 }), '持てる数 3匹');
});
