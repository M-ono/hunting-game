import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerStats, EFFECT_CAPACITY } from '../src/systems/PlayerStats.js';

const createStats = () =>
  new PlayerStats({ baseCapacity: 1, baseSpeed: 400, slowdownPerPrey: 0.1, minSpeedRate: 0.3 });

test('効果がなければ標準の上限と速度', () => {
  const stats = createStats();
  assert.equal(stats.capacity, 1);
  assert.equal(stats.moveSpeed(0), 400);
});

test('持っている数1匹ごとに10%遅くなり、下限で止まる', () => {
  const stats = createStats();
  assert.equal(stats.moveSpeed(1), 360);
  assert.equal(stats.moveSpeed(3), 280);
  assert.equal(stats.moveSpeed(20), 120);
});

test('所持上限アップは標準より小さくならない', () => {
  const stats = new PlayerStats({ baseCapacity: 3, baseSpeed: 400, slowdownPerPrey: 0.1, minSpeedRate: 0.3 });
  stats.addEffect(EFFECT_CAPACITY, 2, 15000, 0);
  assert.equal(stats.capacity, 3);
  stats.addEffect(EFFECT_CAPACITY, 4, 15000, 0);
  assert.equal(stats.capacity, 4);
});

test('所持上限アップは速さを変えない', () => {
  const stats = createStats();
  stats.addEffect(EFFECT_CAPACITY, 4, 15000, 0);
  assert.equal(stats.moveSpeed(0), 400);
  assert.equal(stats.moveSpeed(2), 320);
});

test('効果は時間切れで外れて元に戻る', () => {
  const stats = createStats();
  stats.addEffect(EFFECT_CAPACITY, 3, 1000, 500);
  assert.deepEqual(stats.update(1499), []);
  assert.equal(stats.capacity, 3);
  assert.deepEqual(stats.activeEffects(1000), [{ type: EFFECT_CAPACITY, value: 3, remainingMs: 500 }]);

  const expired = stats.update(1500);
  assert.equal(expired.length, 1);
  assert.equal(stats.capacity, 1);
  assert.equal(stats.hasEffects, false);
});

test('同じ種類の効果は新しいほうで上書きされる', () => {
  const stats = createStats();
  stats.addEffect(EFFECT_CAPACITY, 4, 1000, 0);
  stats.addEffect(EFFECT_CAPACITY, 2, 1000, 500);
  assert.equal(stats.capacity, 2);
  stats.update(1000);
  assert.equal(stats.capacity, 2); // 上書きした効果は 1500 まで続く
  stats.update(1500);
  assert.equal(stats.capacity, 1);
});
