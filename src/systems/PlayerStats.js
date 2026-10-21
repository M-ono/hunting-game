// プレイヤーの能力値（一度に持てる数・移動速度）を計算する。
// 食堂の定食などの一時的な効果（今は「一度に持てる数」だけ）は、必ず addEffect() を通して加える。
// Phaser に依存しないので、node --test で単体テストできる。

export const EFFECT_CAPACITY = 'capacity'; // value = 一度に持てる数（例：3）

export class PlayerStats {
  /**
   * @param {object} options
   * @param {number} options.baseCapacity 標準で一度に持てる数
   * @param {number} options.baseSpeed 基本の移動速度
   * @param {number} options.slowdownPerPrey 1匹持つごとに遅くなる割合
   * @param {number} options.minSpeedRate 持ち運びで遅くなるときの下限（基本速度に対する割合）
   */
  constructor({ baseCapacity, baseSpeed, slowdownPerPrey, minSpeedRate }) {
    this.baseCapacity = baseCapacity;
    this.baseSpeed = baseSpeed;
    this.slowdownPerPrey = slowdownPerPrey;
    this.minSpeedRate = minSpeedRate;
    // 効果は種類ごとに1つ。同じ種類を加えると新しいほうで上書きする
    this.effects = new Map();
  }

  /**
   * 一時的な効果を加える。
   * @param {string} type 効果の種類（EFFECT_CAPACITY）
   * @param {number} value 効果の値
   * @param {number} durationMs 効果が続く時間
   * @param {number} now 現在のゲーム内時刻（ms）
   */
  addEffect(type, value, durationMs, now) {
    const effect = { type, value, endsAt: now + durationMs };
    this.effects.set(type, effect);
    return effect;
  }

  /** 時間切れの効果を外し、外れた効果を返す。毎フレーム呼ぶ */
  update(now) {
    const expired = [];
    for (const [type, effect] of this.effects) {
      if (now >= effect.endsAt) {
        this.effects.delete(type);
        expired.push(effect);
      }
    }
    return expired;
  }

  get hasEffects() {
    return this.effects.size > 0;
  }

  /** 表示用：効いている効果と残り時間 */
  activeEffects(now) {
    return [...this.effects.values()].map((effect) => ({
      type: effect.type,
      value: effect.value,
      remainingMs: Math.max(0, effect.endsAt - now),
    }));
  }

  /** いま一度に持てる数 */
  get capacity() {
    const effect = this.effects.get(EFFECT_CAPACITY);
    return effect ? Math.max(this.baseCapacity, effect.value) : this.baseCapacity;
  }

  /** 持っている数による速度の倍率（1匹ごとに slowdownPerPrey ずつ下がる） */
  carryRate(carried) {
    return Math.max(this.minSpeedRate, 1 - this.slowdownPerPrey * carried);
  }

  /** 実際の移動速度 = 基本速度 × 持ち運びの倍率 */
  moveSpeed(carried) {
    return this.baseSpeed * this.carryRate(carried);
  }
}
