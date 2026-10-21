import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { SCENES, TEXTURES, preyTextureKey } from '../constants.js';

/**
 * 起動直後のシーン。仮素材（図形）のテクスチャを作ってタイトルへ進む。
 * 本番の絵にするときは、preload() で同じテクスチャ名の画像を読み込み、ここでの生成をやめればよい。
 * 絵は右向きで描く（左向きは反転して表示する）。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create() {
    this.makePlayerTexture();
    this.makePreyTextures();
    this.scene.start(SCENES.title);
  }

  /** ハンター（横向き）：帽子・体・目 */
  makePlayerTexture() {
    const { width: w, height: h } = CONFIG.player;
    const { player, playerEdge } = CONFIG.colors;
    const g = this.add.graphics();
    g.fillStyle(player, 1).fillRoundedRect(2, 14, w - 4, h - 16, 14);
    g.lineStyle(5, playerEdge, 1).strokeRoundedRect(2.5, 14.5, w - 5, h - 17, 14);
    g.fillStyle(0x6b4423, 1).fillRect(4, 6, w - 8, 14).fillRect(w / 2 - 4, 0, w / 2, 10); // 帽子
    g.fillStyle(0xffffff, 1).fillCircle(w - 18, 34, 8);
    g.fillStyle(0x1a2a55, 1).fillCircle(w - 15, 34, 4);
    g.generateTexture(TEXTURES.player, w, h);
    g.destroy();
  }

  /** 獲物（横向きの小動物）：耳・体・目・しっぽ。種類ごとに色と大きさを変える（形は 60×44 を基準に拡大） */
  makePreyTextures() {
    CONFIG.prey.types.forEach((type, index) => {
      const { width: w, height: h, color, edge } = type;
      const sx = w / 60;
      const sy = h / 44;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillTriangle(w - 26 * sx, 14 * sy, w - 18 * sx, 0, w - 12 * sx, 14 * sy); // 耳
      g.fillTriangle(w - 16 * sx, 14 * sy, w - 8 * sx, 2 * sy, w - 4 * sx, 16 * sy);
      g.fillEllipse(w / 2 + 2 * sx, h / 2 + 6 * sy, w - 8 * sx, h - 12 * sy); // 体
      g.fillCircle(6 * sx, h / 2 + 2 * sy, 6 * sx); // しっぽ
      g.lineStyle(4, edge, 1).strokeEllipse(w / 2 + 2 * sx, h / 2 + 6 * sy, w - 10 * sx, h - 14 * sy);
      g.fillStyle(0x2b1a0e, 1).fillCircle(w - 14 * sx, h / 2 + 2 * sy, 4 * sx); // 目
      g.fillStyle(edge, 1).fillCircle(w - 6 * sx, h / 2 + 9 * sy, 3 * sx); // 鼻
      g.generateTexture(preyTextureKey(index), w, h);
      g.destroy();
    });
  }
}
