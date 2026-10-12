import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Claude のアーティファクト（claude.ai 上の非公開ページ）で試遊するためのビルド：npm run build:artifact
// アーティファクトは決まった CDN からしかライブラリを読み込めないため、Phaser は CDN（artifact/index.html）から読み、
// ここではゲームのコードだけを dist-artifact/game.js にまとめて、ページ（index.html）を横に置く。
const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: { phaser: fromHere('./artifact/phaser-global.js') },
  },
  publicDir: false,
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    minify: false, // 公開前に中身を読めるように圧縮しない
    lib: {
      entry: fromHere('./src/main.js'),
      formats: ['es'],
      fileName: () => 'game.js',
    },
  },
  plugins: [
    {
      name: 'artifact-page',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: readFileSync(fromHere('./artifact/index.html'), 'utf8'),
        });
      },
    },
  ],
});
