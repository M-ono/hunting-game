/**
 * ゲームの調整用の数値は、すべてこのファイルにまとめています。
 * 数値を変えて保存すれば、`npm run dev` 中のブラウザにすぐ反映されます。
 *
 * - ドンキーコングのような横から見たステージ。何段もの床を、はしごで登り降りする
 * - 距離・大きさ・座標の単位は px（画面は 1080×1920 の縦長として設計）。y は下ほど大きい
 * - 速さは px/秒、時間は ミリ秒（ms）。1000ms = 1秒
 * - 「仮」と書いた値は仕様の仮の値。遊びながら調整してください
 */
export const CONFIG = {
  // 画面の論理サイズ（スマホ縦持ち）。これより縦長・横長の画面では周りの余白が広がるだけ
  screen: {
    width: 1080,
    height: 1920,
  },

  // 1回のプレイ
  round: {
    timeLimitSec: 60, // 制限時間（仮：60秒）
    endDelayMs: 1500, // 「タイムアップ！」を見せてからリザルトに移るまで
  },

  // 遊ぶ範囲。上の 0〜200 は時間やスコアを表示する帯
  field: {
    x: 0,
    y: 200,
    width: 1080,
    height: 1720,
  },

  physics: {
    gravity: 2400, // 重力の強さ
    maxFallSpeed: 1400, // 落ちる速さの上限
  },

  player: {
    width: 56, // 当たり判定の大きさ
    height: 88,
    runSpeed: 420, // 基本の移動速度（左右）
    climbSpeed: 300, // はしごを登り降りする基本の速さ
    jumpSpeed: 900, // ジャンプの勢い（高さ ≒ jumpSpeed² ÷ (2 × 重力) ≒ 169px）
    coyoteMs: 90, // 床から足が離れた直後でもジャンプできる猶予
    jumpBufferMs: 120, // 着地の少し前に入れたジャンプを受け付ける猶予
    startFloor: 0, // 最初に立つ床（下から0, 1, 2…）
    startX: 140,
    invincibleMs: 1000, // 攻撃を受けた直後の無敵時間（仮：1秒）
  },

  // プレイヤーの攻撃（周囲をまとめて攻撃）
  attack: {
    range: 150, // プレイヤーの中心から獲物の中心まで、この距離以内なら当たる
    cooldownMs: 350, // 次に攻撃できるまでの間隔
    damage: 1,
    knockback: 380, // 当たった獲物が飛ばされる速さ
    knockbackMs: 150, // 飛ばされる時間
  },

  // 持ち運び
  carry: {
    baseCapacity: 1, // 一度に捕まえておける数（標準：1匹）
    slowdownPerPrey: 0.1, // 1匹持つごとに遅くなる割合（仮：0.1 = −10%）。左右移動とはしごの速さに効く
    minSpeedRate: 0.3, // どれだけ持っても基本速度の30%より遅くはならない
    escapeOnHit: 1, // 攻撃を受けたときに逃げる数（仮：1匹）
  },

  prey: {
    count: 7, // ステージにいる獲物の数（持ち運び中も含む）
    width: 60, // 当たり判定の大きさ
    height: 44,
    maxHp: 3, // 何回攻撃すると気絶するか（仮：3回）
    spawnFloors: [0, 1, 2, 3], // 獲物が出てくる床（一番上の床には出さない）
    wanderSpeed: 120, // うろうろ歩く速さ（床の端では引き返す）
    wanderTurnMs: [1000, 2600], // 向きを変える間隔（最短, 最長）
    idleChance: 0.25, // 向きを変えるときに立ち止まる確率
    fleeSpeed: 300, // 攻撃されたあと・逃げ出したあとに走って逃げる速さ
    fleeMs: 600, // 走って逃げる時間
    stunMs: 5000, // 気絶している時間。過ぎると回復して動き出す（仕様外の仮追加）
    aggroRadius: 450, // プレイヤーが獲物を持っているとき、同じ床でこれより近い獲物が向かってくる
    aggroSpeed: 260, // 向かってくる速さ
    attackCooldownMs: 1200, // 1匹が攻撃したあと、次に攻撃してくるまで
    escapeSpeed: 420, // プレイヤーの手から逃げ出すときに飛び出す速さ（横）
    escapeJump: 520, // 逃げ出すときに跳ねる勢い（上）
    respawnDelayMs: 1500, // 檻に入れたあと、新しい獲物が出てくるまで（仕様外の仮追加）
    spawnMinDistance: 350, // 新しい獲物はプレイヤーからこれ以上離れた場所に出る
    keepOutMargin: 160, // 檻と焚き火のまわり、この距離以内には獲物が入らない（出現もしない）
  },

  // 床（下から順に 0, 1, 2…）。y は床の上面の高さ、x1〜x2 が床のある範囲。
  // 床の切れ目から下の段へ飛び降りられる。床は下からすり抜けられる（はしごで登るため）
  floors: [
    { y: 1840, x1: 0, x2: 1080, thickness: 80 }, // 0: 地面
    { y: 1510, x1: 0, x2: 900 },
    { y: 1180, x1: 180, x2: 1080 },
    { y: 850, x1: 0, x2: 900 },
    { y: 520, x1: 0, x2: 1080 }, // 4: 一番上（檻と焚き火）
  ],
  floorThickness: 36, // thickness を書いていない床の厚さ

  // はしご。x は中心の位置、from の床から to の床までつながる（床の番号）
  ladders: [
    { x: 380, from: 0, to: 1 },
    { x: 820, from: 0, to: 1 },
    { x: 260, from: 1, to: 2 },
    { x: 660, from: 1, to: 2 },
    { x: 440, from: 2, to: 3 },
    { x: 800, from: 2, to: 3 },
    { x: 420, from: 3, to: 4 },
    { x: 760, from: 3, to: 4 },
  ],
  ladder: {
    width: 70, // 見た目の幅
    grabDistance: 32, // はしごの中心からこの距離以内なら、つかまれる
  },

  // 障害物（ジャンプで飛び越える岩）。floor の床の上に置く。x は中心、w と h は幅と高さ
  obstacles: [
    { floor: 0, x: 600, w: 70, h: 70 },
    { floor: 1, x: 530, w: 70, h: 70 },
    { floor: 2, x: 560, w: 70, h: 70 },
    { floor: 3, x: 600, w: 70, h: 70 },
  ],

  // 檻（触れると持っている獲物をすべて入れる。入れた数がスコア）。floor の床の上に置く
  cage: {
    floor: 4,
    x: 170, // 中心の位置
    width: 220,
    height: 150,
    touchMargin: 20, // 檻のまわり、この距離まで近づけば入れられる
  },

  // 焚き火（触れて少し待つと料理）。floor の床の上に置く
  campfire: {
    floor: 4,
    x: 920, // 中心の位置
    radius: 55,
    touchMargin: 20, // 焚き火のまわり、この距離まで近づけば料理できる
  },

  // 料理：檻の獲物（スコア）を消費して、ランダムで一時的な効果を得る
  cooking: {
    cost: 2, // 1回の料理で使う檻の獲物の数（仮：2匹）
    holdMs: 800, // 焚き火に触れたまま待つ時間（0 にすると触れた瞬間に料理）
    durationMs: 15000, // 効果が続く時間（仮：15秒）
    speedChance: 0.5, // 「移動速度アップ」になる確率。それ以外は「所持上限アップ」
    speedBonus: 0.3, // 移動速度アップの量（仮：+30%）
    capacityMin: 2, // 所持上限アップのとき、上限はこの範囲からランダム（2〜4匹）
    capacityMax: 4,
  },

  // 操作（片手）：ドラッグでスティック。左右で移動、上に倒すとジャンプ（はしごでは登る）、下ではしごを降りる。タップで攻撃
  controls: {
    autoAttack: false, // true にすると、攻撃範囲に獲物がいるとき自動で攻撃する
    joystickRadius: 110, // 仮想スティックの大きさ
    deadZone: 24, // 指をこれ以上動かすと移動を始める
    moveThreshold: 0.3, // スティックの横方向がこれ以上なら左右に移動
    climbThreshold: 0.5, // スティックの縦方向がこれ以上なら、はしごを登り降り
    jumpThreshold: 0.6, // スティックを上に倒した割合がこれ以上で…
    jumpMinDistance: 50, // …指を上へこれ以上動かしたらジャンプ（タップでジャンプしないように）
    tapMaxMs: 300, // これより短く触れて…
    tapMaxMove: 40, // …指の移動がこれ以下ならタップ（攻撃）
  },

  // 表示
  ui: {
    fontFamily:
      'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif',
  },

  // 色（仮素材）
  colors: {
    background: '#070b14', // ステージの外側
    hudBand: 0x0b1220,
    field: 0x111c2e,
    girder: 0xc0392b,
    girderEdge: 0x7b241c,
    ladder: 0x5dade2,
    obstacle: 0x8a8f98,
    obstacleEdge: 0x5b6068,
    player: 0x3d7cff,
    playerEdge: 0xffffff,
    prey: 0xd9a066,
    preyEdge: 0x6b4423,
    preyAggroTint: 0xff6b6b,
    preyStunTint: 0x9a9a9a,
    cage: 0x8b5a2b,
    cageFloor: 0x3a2a1a,
    campfire: 0xff8c1a,
    campfireCore: 0xffe066,
    attackRing: 0xffffff,
    speedAura: 0x66e0ff,
    capacityAura: 0xffd84d,
  },
};
