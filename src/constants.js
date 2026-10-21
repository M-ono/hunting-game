// 調整用ではない固定の名前・描画順（調整用の数値は config.js）

export const SCENES = {
  boot: 'Boot',
  title: 'Title',
  game: 'Game',
  result: 'Result',
};

// 仮素材のテクスチャ名。同じ名前で画像を読み込めば、本番の絵に差し替えられる
export const TEXTURES = {
  player: 'player',
  prey: 'prey', // 獲物は種類ごとに「prey-0」「prey-1」…（CONFIG.prey.types の順。preyTextureKey で作る）
};

/** 獲物の種類ごとのテクスチャ名 */
export const preyTextureKey = (typeIndex) => `${TEXTURES.prey}-${typeIndex}`;

// 描画の重なり順（大きいほど手前）
export const DEPTH = {
  field: 0,
  stage: 10,
  prey: 20,
  player: 30,
  effect: 40,
  hud: 100,
  controls: 200,
};
