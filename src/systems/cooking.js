// 料理：檻の獲物（スコア）を消費して、しばらくの間「一度に持てる数」がランダムに増える。
// Phaser に依存しないので、node --test で単体テストできる。

import { EFFECT_CAPACITY } from './PlayerStats.js';

/**
 * 料理の効果を決める：一度に持てる数を capacityMin〜capacityMax からランダムに選ぶ。
 * @param {typeof import('../config.js').CONFIG.cooking} cooking 設定
 * @param {() => number} random 0以上1未満を返す関数（テスト用に差し替え可能）
 * @returns {{ type: string, value: number }}
 */
export function rollCookingEffect(cooking, random = Math.random) {
  const span = cooking.capacityMax - cooking.capacityMin + 1;
  const value = cooking.capacityMin + Math.min(span - 1, Math.floor(random() * span));
  return { type: EFFECT_CAPACITY, value };
}

/**
 * いま料理できるか。
 * @param {object} state
 * @param {number} state.score 檻の獲物の数
 * @param {number} state.cost 料理に必要な数
 * @param {boolean} state.effectActive 料理の効果が続いているか（効果中は料理できない）
 * @returns {{ ok: true } | { ok: false, reason: 'active' } | { ok: false, reason: 'notEnough', missing: number }}
 */
export function checkCooking({ score, cost, effectActive }) {
  if (effectActive) return { ok: false, reason: 'active' };
  if (score < cost) return { ok: false, reason: 'notEnough', missing: cost - score };
  return { ok: true };
}

/** 効果の表示用テキスト */
export function describeEffect({ type, value }) {
  if (type === EFFECT_CAPACITY) return `所持上限 ${value}匹`;
  return type;
}
