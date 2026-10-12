# ハンティングゲーム（仮）開発メモ

スマホのブラウザで遊ぶ2Dゲーム。**ドンキーコングのような横視点のジャンプゲーム**で、床の穴をジャンプで通り抜けて登り、穴から飛び降りて降りながら獲物を捕まえ、一番上の床の檻へ運ぶ。**片手のタッチ操作**で遊べることが前提。

- 技術：Phaser 4（4.2.x）＋ Vite 8、JavaScript（ES Modules）、Arcade Physics
- 公開：GitHub Actions → GitHub Pages（https://m-ono.github.io/hunting-game/ ）
- 絵は図形の仮素材（あとで差し替える）

## コマンド

| コマンド | 内容 |
|---|---|
| `npm install` | 依存パッケージを入れる（Node.js 22.12 以上） |
| `npm run dev` | 開発サーバー。`--host` 付きなので、同じ Wi-Fi のスマホから表示される Network の URL で確認できる |
| `npm run build` | `dist/` に本番用ファイルを作る |
| `npm run preview` | ビルド結果を確認する |
| `npm test` | 単体テスト（`node --test`、追加の依存なし） |
| `npm run build:artifact` | Claude 上で試遊するページ用に `dist-artifact/` を作る（下の「Claude 上で試遊」） |

確認用：URL の末尾に `?debug` を付けると、当たり判定の表示・`window.game`／`window.CONFIG` の公開（開発者ツールから数値をその場で変えられる）・C キーで料理の効果を即付与（檻の獲物は減らない）が有効になる。

## 現在の仕様（数値はすべて仮。`src/config.js` で変更）

### ステージ
- 縦長1画面（論理サイズ 1080×1920）。床は下から 0〜4 の5段（`floors`）。はしごはない
- **床は下からも横からも通り抜けられない**（下でジャンプすると頭をぶつける）
- 地面以外の各段に幅260pxの**穴**がある（`floors[].holes`）。穴は下から右・左・右と交互、一番上は檻と焚き火の間。上下の段の穴は横に重ならない
- **上の段へ**：穴の下でジャンプして穴を通り抜け、穴のふちに乗る（床の間隔330px ＜ ジャンプの高さ420px）。斜め上にはじくと移動しながら跳べる
- **下の段へ**：穴に歩いて入って飛び降りる
- 障害物：床の上の岩。ジャンプで飛び越える（`obstacles`）
- **檻と焚き火は一番上の床**（`cage.floor` / `campfire.floor`）
- **出発地点は一番上の床の檻のそば**（`player.startFloor` / `player.startX`）。穴から降りて狩りに行き、穴を通って登って檻へ戻る

### ルール
| 項目 | 内容 | 設定 |
|---|---|---|
| 移動 | 左右に走る（420）、ジャンプ（高さ420px。穴を通って一段上の床に乗れる）、穴から飛び降りて下の段へ | `player.runSpeed` `player.jumpHeight` `floors[].holes` |
| 攻撃 | 周囲をまとめて攻撃（半径150、0.35秒に1回） | `attack.*` |
| 気絶→捕獲 | 獲物の体力1。**攻撃1回で気絶**して動かなくなり、触れると捕まえる | `prey.maxHp` |
| 所持上限 | 標準1匹。上限に達したら、檻に入れるまで次は捕まえられない | `carry.baseCapacity` |
| 減速 | 1匹ごとに −10%（下限30%）。左右の移動に効く（ジャンプの高さは変わらない）。檻に入れると戻る | `carry.slowdownPerPrey` |
| 檻 | 触れると持っている獲物をすべて入れる。入れた数がスコア | `cage.*` |
| 反撃 | 獲物を持っている間、**同じ段**で半径450以内の獲物が向かってきて、ぶつかると攻撃 | `prey.aggroRadius` |
| 被弾 | 持っている獲物が1匹逃げる（体力が戻って再び動き出す）。直後1秒は無敵（点滅） | `carry.escapeOnHit` `player.invincibleMs` |
| 料理 | 焚き火に触れて0.8秒とどまると、**檻の獲物（スコア）を2匹消費**して料理。ランダムで15秒間「所持上限が2〜4匹」か「移動速度+30%」 | `cooking.*` |
| 制限時間 | **5分**（300秒）。残り時間は「分:秒」で表示。終わるとスコアとベスト記録を表示し、タップでリトライ | `round.timeLimitSec` |

### 操作（片手）
- 画面のどこでもドラッグすると、指の位置に仮想スティックが出る
  - 左右に倒す：移動／上にはじく：ジャンプ／斜め上にはじく：移動しながらジャンプ（跳んだあとに指を横へずらしても動ける）
- 上の段へは穴の下でジャンプして、穴のふちに乗る。下の段へは穴に歩いて入って飛び降りる
- 短くタップ：攻撃（`controls.autoAttack: true` にすると近くの獲物を自動で攻撃）
- PC：←→/AD 移動、↑/W/Space ジャンプ、Z/J 攻撃

### 仕様にない仮の追加（理由）
- 気絶は5秒で回復（`prey.stunMs`）：回復しないと「先に全部気絶させてから運ぶ」と反撃が起きなくなるため
- 檻に入れた獲物は1.5秒後に別の場所で補充（`prey.respawnDelayMs`）：ステージの獲物の数（7匹）を保つため
- 料理は0.8秒とどまると発動（`cooking.holdMs`、0で触れた瞬間）：通りがかりに触れてスコアが減らないように
- 料理の効果中は次の料理はできない。効果が切れたとき上限を超えて持っていても没収しない（檻に入れるまで追加で捕まえられないだけ）
- 速度の計算：基本速度 ×（1＋料理の速度ボーナス）× max(0.3, 1 − 0.1 × 所持数)
- 獲物はジャンプせず、床の端・穴・岩・壁の手前で引き返す（穴には落ちない。攻撃で飛ばされたときは落ちることがある）。床を下から通れないので、一番上の床には上がれない（出現もしない）
- 檻と焚き火のまわり（`prey.keepOutMargin` = 160px）には獲物が入らない・出現しない（見えない柵で確実に止める）

## 設計のルール
- **調整用の数値は `src/config.js` だけに書く**（ステージ配置・色も含む）
- **所持上限・移動速度は `PlayerStats` を通す**。料理などの一時効果は `stats.addEffect(type, value, durationMs, now)` で加える（`EFFECT_CAPACITY` / `EFFECT_SPEED`）。新しい強化もこの入口を使う
- ステージの形と位置の判定（床と穴・獲物が入れない範囲・一段上に登れるか）は `src/systems/stageLayout.js`。Phaser に依存しない純粋な関数にしてテストを書く。床や穴の配置を変えたら `npm test` で「どの段からも穴を通って一段上に登れる」「各段に落ちられる穴がある」「上下の段の穴が重ならない」「足場が狭すぎない」を確かめる
- 床に立っているかは `body.blocked.down`（床・岩・画面の端との衝突）だけで判定する。`touching.down` は獲物との重なり判定でも立つので使わない（空中で獲物に触れてジャンプできてしまう）
- 仮素材は `constants.js` の `TEXTURES` の名前で作っている。本番の絵は同じ名前で読み込めば差し替わる（右向きで描く。左向きは反転表示）
- ゲーム内時刻は `GameScene.now`（update の delta を足したもの）。タブを切り替えている間は進まない。時刻の比較はこれを使う
- 位置を直接動かすときは `body.reset(x, y)` を使う（`x` / `y` の代入だと、そのフレームの移動量があとから足されてずれ、床をすり抜けることがある）
- 頭上の表示などは物理演算のあと（`POST_UPDATE`）に位置を合わせる
- Phaser 4 の注意：`setTintFill` は廃止 → `setTint(c).setTintMode(Phaser.TintModes.FILL)`／`Math.TAU` は 2π／`Geom.Point` は廃止 → `Vector2`／`roundPixels` の既定は false
- 画面は `Scale.EXPAND`：キャンバスが画面全体に広がり（余白を触っても操作できる）、1080×1920 の範囲をカメラで中央に置く（`utils/camera.js`）

## ファイル構成
```
index.html                 スマホ向けの viewport・スクロール/ズーム禁止
vite.config.js             base: './'（GitHub Pages のサブパスで動くように）
vite.artifact.config.js    Claude 上の試遊ページ用ビルド（Phaser は CDN、ゲームのコードだけを game.js に）
artifact/                  試遊ページの元（index.html）と、CDN の Phaser を渡す phaser-global.js
.github/workflows/deploy.yml  PR ではテスト＋ビルド、main への push で Pages に公開
src/
  main.js                  Phaser.Game の設定（EXPAND・重力・シーン・?debug）
  config.js                ★調整用の数値
  constants.js             シーン名・テクスチャ名・描画順
  scenes/                  BootScene（仮素材の生成）TitleScene GameScene（本編）ResultScene
  objects/                 Player（走る・ジャンプ）Prey（状態ごとのAI）Stage（穴のある床・岩・柵）Cage Campfire
  systems/                 PlayerStats（上限・速度・一時効果）cooking（料理の効果抽選・可否）stageLayout（ステージの判定）
  input/OneHandControls.js 片手操作（フローティングスティック・はじいてジャンプ・タップ攻撃・キーボード）
  ui/                      Hud（上部の表示）text（文字・浮き文字）
  utils/                   camera（中央合わせ）bestScore（localStorage）format（残り時間などの表示）
tests/                     playerStats / cooking / stageLayout / format の単体テスト
```

## Claude 上で試遊（アーティファクト）
- 試遊ページ：https://claude.ai/artifact/92vc5RTCCxj2NJ2Fz1LJF5 （非公開。オーナーと、共有した人だけが開ける）
- 更新：`npm run build:artifact` を実行し、`dist-artifact/index.html` を同じアーティファクトに再公開する（`files` に `game.js` → `dist-artifact/game.js`）。別の会話からは上の URL を `url` に指定して再公開する
- アーティファクトは決まった CDN からしかライブラリを読めないため、Phaser は jsDelivr（`phaser@4.2.1`）から読み、`artifact/phaser-global.js` で `import Phaser from 'phaser'` を置き換えている。Phaser の版を上げるときは `artifact/index.html` の URL も合わせて変える
- ページの元は `artifact/index.html`（`<!doctype>`・`<head>`・`<body>` はアーティファクト側で付くので書かない）

## 公開（GitHub Pages）
- main に push（またはマージ）すると `.github/workflows/deploy.yml` がテスト・ビルドして公開する。Actions タブの「Run workflow」で手動実行もできる
- GitHub 側で一度だけ必要な設定：**Settings → Pages → Build and deployment → Source を「GitHub Actions」にする**
- 公開されるのは main からだけ（作業ブランチでは公開されない）

## 今後の予定
1. 実機で遊んで数値を調整（制限時間・ジャンプの高さ・床の穴の位置と幅・料理の消費数と効果時間・反撃の強さなど）
2. ドンキーコングらしい要素：転がってくる障害物（当たると獲物が逃げる、など）、ステージの追加、獲物の種類
3. 見た目・手触り：本番の絵、効果音・BGM、攻撃・捕獲・被弾の演出、反撃前の予備動作（溜め）
4. 遊びやすさ：初回のチュートリアル、横向きにしたときの「縦にしてください」表示、ホーム画面への追加

### 未決事項
- 料理の消費数（仮2匹）・効果時間（仮15秒）・効果中の重ねがけを許すか
- 「獲物を一定数消費して一時的にアップ」は料理に統合した。料理とは別の「選べる強化」が必要か
- 捕まえた獲物を運んでいる間、ジャンプの高さも下げるか（今は速さだけ）

## 仕様の経緯
- 2026-10-12：見下ろし型で作り始め、途中でドンキーコング風の横視点ジャンプゲームに変更。檻と焚き火は一番上の床、その近くには獲物が来ないようにした
- 料理は「檻の獲物（スコア）を消費して焚き火で作る」に決定。攻撃はタップ（自動攻撃は設定で切り替え）
- はしごは難しいので廃止。ジャンプで一段上の床へ登り、床の穴から飛び降りて下の段へ降りる形にした
- 床を下から通り抜けられないようにし、穴を広げた（140→260px）。上の段へは穴をジャンプで通り抜ける。ジャンプの高さは 390→420px
- 獲物が強すぎるので、1回の攻撃で気絶するようにした（体力 3→1）。出発地点を一番上の檻のそばに。制限時間を5分に
