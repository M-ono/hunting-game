// ベストスコアをブラウザに保存する。プライベートモードなどで保存できなくても遊べるようにする

const KEY = 'hunting-game:best-score';

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
