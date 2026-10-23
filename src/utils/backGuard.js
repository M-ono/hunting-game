// スマホの「戻る」操作（画面の端からのスワイプなど）で、遊んでいる途中にページを離れないようにする。
// 遊んでいる間だけ履歴に目印を1つ積み、「戻る」が来たら積み直して onBack を呼ぶ（ゲームを一時停止する）。
// 遊んでいないとき（タイトル・結果）は積み直さないので、もう一度「戻る」でふつうにページを離れられる。

const MARK = 'huntingGameGuard';
let onBack = null;
let listening = false;

/** 今の履歴が目印でなければ積む。履歴を触れない環境（埋め込み表示など）では false */
function pushMark() {
  try {
    if (history.state?.[MARK] !== true) history.pushState({ [MARK]: true }, '');
    return true;
  } catch {
    return false;
  }
}

/**
 * 遊んでいる間、「戻る」でページを離れないようにする。
 * @param {() => void} handler 「戻る」が来たときに呼ぶ
 * @returns {() => void} 守るのをやめる関数
 */
export function guardBackNavigation(handler) {
  if (!pushMark()) return () => {};
  onBack = handler;
  if (!listening) {
    listening = true;
    window.addEventListener('popstate', () => {
      if (!onBack) return;
      pushMark();
      onBack();
    });
  }
  return () => {
    if (onBack === handler) onBack = null;
  };
}
