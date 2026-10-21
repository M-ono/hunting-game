// 表示用の書式

/** 残り時間（ミリ秒）を「分:秒」にする。端数の秒は切り上げ（例：299001ms → "5:00"、9500ms → "0:10"） */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** お金の表示（例：120 → "120G"） */
export function formatMoney(amount, unit) {
  return `${amount}${unit}`;
}

/** お金の増減の表示（例：30 → "+30G"、-20 → "−20G"） */
export function formatMoneyChange(amount, unit) {
  return `${amount < 0 ? '−' : '+'}${Math.abs(amount)}${unit}`;
}

/** 秒数を「5分」「90秒」「1分30秒」のような言葉にする */
export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}秒`;
  return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
}
