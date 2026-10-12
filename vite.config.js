import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages（https://<ユーザー名>.github.io/hunting-game/）でも動くように相対パスで出力する
  base: './',
  build: {
    // Phaser 本体だけで約1.2MBあるため、チャンクサイズ警告のしきい値を上げておく
    chunkSizeWarningLimit: 2000,
  },
});
