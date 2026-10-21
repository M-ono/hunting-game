# hunting-game

スマホのブラウザで、片手で遊ぶ2Dの狩りゲーム（ドンキーコング風の横視点ジャンプゲーム）。Phaser 4 + Vite で作っています。

- 遊ぶ：https://m-ono.github.io/hunting-game/ （main ブランチを GitHub Pages に自動公開）
- 遊び方：ドラッグでスティック（左右で移動、上にはじくとジャンプ）。床の穴をジャンプで通り抜けて上の段へ、穴から飛び降りて下の段へ。タップで攻撃。気絶した獲物を捕まえて、一番上の檻へ運ぶとスコア。焚き火で檻の獲物を料理すると、しばらく一度に持てる数がランダムで2〜4匹に増える
- 仕様・設計・今後の予定は [CLAUDE.md](CLAUDE.md) にまとめています

## 開発

```bash
npm install
npm run dev      # 開発サーバー（同じ Wi-Fi のスマホから表示された Network の URL で確認できる）
npm test         # 単体テスト
npm run build    # dist/ に出力
```

調整用の数値（速さ・体力・制限時間・ステージ配置など）はすべて `src/config.js` にあります。
