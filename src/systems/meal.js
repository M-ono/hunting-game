// 食堂の日替わり定食：お金を払って食べると、しばらくの間「一度に持てる数」がランダムに増える。
// Phaser に依存しないので、node --test で単体テストできる。

import { EFFECT_CAPACITY } from './PlayerStats.js';

/**
 * 定食の効果を決める：一度に持てる数を capacityMin〜capacityMax からランダムに選ぶ（日替わりなので運次第）。
 * @param {typeof import('../config.js').CONFIG.meal} meal 設定
 * @param {() => number} random 0以上1未満を返す関数（テスト用に差し替え可能）
 * @returns {{ type: string, value: number }}
 */
export function rollMealEffect(meal, random = Math.random) {
  const span = meal.capacityMax - meal.capacityMin + 1;
  const value = meal.capacityMin + Math.min(span - 1, Math.floor(random() * span));
  return { type: EFFECT_CAPACITY, value };
}

/**
 * いま定食を食べられるか。
 * @param {object} state
 * @param {number} state.money 所持金
 * @param {number} state.price 定食の値段
 * @param {boolean} state.effectActive 定食の効果が続いているか（効果中は食べられない）
 * @returns {{ ok: true } | { ok: false, reason: 'active' } | { ok: false, reason: 'notEnough', missing: number }}
 */
export function checkMeal({ money, price, effectActive }) {
  if (effectActive) return { ok: false, reason: 'active' };
  if (money < price) return { ok: false, reason: 'notEnough', missing: price - money };
  return { ok: true };
}

/** 効果の表示用テキスト */
export function describeEffect({ type, value }) {
  if (type === EFFECT_CAPACITY) return `持てる数 ${value}匹`;
  return type;
}
