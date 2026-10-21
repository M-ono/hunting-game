// ベスト記録（終わったときの所持金）をブラウザに保存する。プライベートモードなどで保存できなくても遊べるようにする

// 記録が「檻に入れた数」から「お金」に変わったので、前の記録とは別の名前で保存する
const KEY = 'hunting-game:best-money';

export function loadBestScore() {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    localStorage.setItem(KEY, String(score));
  } catch {
    // 保存できない環境では何もしない
  }
}
