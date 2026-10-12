import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH, SCENES } from '../constants.js';
import { OneHandControls } from '../input/OneHandControls.js';
import { Cage } from '../objects/Cage.js';
import { Campfire } from '../objects/Campfire.js';
import { Player } from '../objects/Player.js';
import { Prey } from '../objects/Prey.js';
import { createStageObjects } from '../objects/Stage.js';
import { checkCooking, describeEffect, rollCookingEffect } from '../systems/cooking.js';
import { EFFECT_CAPACITY, EFFECT_SPEED, PlayerStats } from '../systems/PlayerStats.js';
import { buildStage, floorAt, isClearOfObstacles, noPreyZoneAt } from '../systems/stageLayout.js';
import { Hud } from '../ui/Hud.js';
import { addText, floatText } from '../ui/text.js';
import { keepCameraCentered } from '../utils/camera.js';

/** 本編：移動・ジャンプ（下の段へは床の穴から）・攻撃・捕獲・檻・反撃・料理・制限時間 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SCENES.game);
  }

  create() {
    keepCameraCentered(this);
    this.physics.resume();

    this.now = 0; // ゲーム内時刻（ms）。タブを切り替えている間は進まない
    this.score = 0; // 檻の獲物の数
    this.cookCount = 0;
    this.ended = false;
    this.nextAttackAt = 0;
    this.cookHoldMs = 0;
    this.cookMessageShown = false;
    this.messageReadyAt = 0;

    // 一度に持てる数・移動速度はここで計算する（料理の効果もここに加える）
    this.stats = new PlayerStats({
      baseCapacity: CONFIG.carry.baseCapacity,
      baseSpeed: CONFIG.player.runSpeed,
      slowdownPerPrey: CONFIG.carry.slowdownPerPrey,
      minSpeedRate: CONFIG.carry.minSpeedRate,
    });

    // ステージ（穴のある床・障害物）と、一番上の床の檻・焚き火
    const { field } = CONFIG;
    this.physics.world.setBounds(field.x, field.y, field.width, field.height);
    this.layout = buildStage(CONFIG);
    const { floors, obstacles, preyFences } = createStageObjects(this, this.layout);
    this.cage = new Cage(this, this.layout.floors[CONFIG.cage.floor].y);
    this.campfire = new Campfire(this, this.layout.floors[CONFIG.campfire.floor].y);

    this.player = new Player(this, CONFIG.player.startX, this.layout.floors[CONFIG.player.startFloor].y);

    /** @type {Prey[]} */
    this.preys = [];
    for (let i = 0; i < CONFIG.prey.count; i++) {
      const prey = new Prey(this, this.layout);
      const point = this.findSpawnPoint();
      prey.spawn(point.x, point.feetY, this.now);
      this.preys.push(prey);
    }

    // 床は上面だけに当たり判定があるので、下からジャンプですり抜けて一段上に乗れる
    this.physics.add.collider(this.player, floors);
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.preys, floors);
    this.physics.add.collider(this.preys, obstacles);
    this.physics.add.collider(this.preys, preyFences);
    this.physics.add.overlap(this.player, this.preys, this.onPlayerTouchPrey, undefined, this);

    this.controls = new OneHandControls(this);
    this.hud = new Hud(this);

    // 物理演算で位置が決まったあとに、頭の上の表示などを合わせる
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);
    });

    if (this.registry.get('debug')) this.setupDebugKeys();

    this.updateHud();
    this.showBanner('スタート！\n獲物を捕まえて一番上の檻へ');
  }

  update(_time, delta) {
    if (this.ended) return;
    const dt = Math.min(delta, 100); // 処理落ちで時間が一気に進まないように
    this.now += dt;
    const now = this.now;

    // 料理の効果の時間切れ
    if (this.stats.update(now).length > 0) {
      floatText(this, this.player.x, this.player.y - 130, '料理の効果が切れた', { size: 38 });
    }

    // 移動（持っている数が多いほど遅い。ジャンプの高さは変わらない）
    const input = this.controls.read();
    const carried = this.player.carried.length;
    const speedRate = this.stats.speedRate * this.stats.carryRate(carried);
    this.player.updateMovement(now, input, CONFIG.player.runSpeed * speedRate);

    // 攻撃
    const wantsAttack = input.attack || (CONFIG.controls.autoAttack && this.hasPreyInAttackRange());
    if (wantsAttack && now >= this.nextAttackAt) this.attack(now);

    // 獲物の動き
    for (const prey of this.preys) {
      if (prey.active) prey.think(now, this.player, carried > 0);
    }

    // 檻と焚き火（一番上の床）
    if (carried > 0 && this.cage.isTouching(this.player.body)) this.depositPrey();
    this.updateCooking(dt);

    this.updateHud();

    if (now >= CONFIG.round.timeLimitSec * 1000) this.endRound();
  }

  // ---- 獲物の出現 ----

  /** 獲物が出てもよい床の、穴・障害物・檻・焚き火から離れ、プレイヤーからも離れた場所を探す */
  findSpawnPoint() {
    const { spawnFloors, width, spawnMinDistance } = CONFIG.prey;
    const half = width / 2;
    let point = null;
    for (let i = 0; i < 80; i++) {
      const floor = this.layout.floors[Phaser.Utils.Array.GetRandom(spawnFloors)];
      const x = Phaser.Math.Between(floor.x1 + half + 10, floor.x2 - half - 10);
      point = { x, feetY: floor.y };
      const ok =
        floorAt(this.layout, x - half - 10, floor.y) &&
        floorAt(this.layout, x + half + 10, floor.y) &&
        isClearOfObstacles(this.layout, floor.index, x, half + 10) &&
        !noPreyZoneAt(this.layout, x, floor.y) &&
        Phaser.Math.Distance.Between(x, floor.y, this.player.x, this.player.feetY) >= spawnMinDistance;
      if (ok) break;
    }
    return point;
  }

  // ---- 攻撃・捕獲・反撃 ----

  hasPreyInAttackRange() {
    const { x, y } = this.player;
    return this.preys.some(
      (prey) => prey.active && prey.canBeHit && Phaser.Math.Distance.Between(x, y, prey.x, prey.y) <= CONFIG.attack.range,
    );
  }

  /** プレイヤーのまわりをまとめて攻撃 */
  attack(now) {
    const { range, cooldownMs, damage } = CONFIG.attack;
    const { x, y } = this.player;
    this.nextAttackAt = now + cooldownMs;

    const ring = this.add
      .circle(x, y, range, CONFIG.colors.attackRing, 0.18)
      .setStrokeStyle(10, CONFIG.colors.attackRing, 0.9)
      .setDepth(DEPTH.effect)
      .setScale(0.5);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 180, onComplete: () => ring.destroy() });

    for (const prey of this.preys) {
      if (!prey.active || !prey.canBeHit) continue;
      if (Phaser.Math.Distance.Between(x, y, prey.x, prey.y) > range) continue;
      if (prey.takeHit(now, x, damage)) {
        floatText(this, prey.x, prey.y - 70, '気絶！', { color: '#ffe066', size: 40 });
      }
    }
  }

  /** プレイヤーと獲物が重なっている間、毎フレーム呼ばれる */
  onPlayerTouchPrey(player, prey) {
    if (this.ended) return;
    if (prey.isStunned) {
      this.tryCapture(prey);
    } else if (prey.isAggro && player.carried.length > 0 && !player.isInvincible(this.now)) {
      this.onPlayerHit(prey);
    }
  }

  tryCapture(prey) {
    const player = this.player;
    if (player.carried.length >= this.stats.capacity) {
      this.say(player.x, player.y - 130, 'いっぱい！檻へ運ぼう', '#ffe066');
      return;
    }
    prey.capture();
    player.carried.push(prey);
    floatText(this, player.x, player.y - 130, '捕まえた！', { size: 40 });
  }

  /** 向かってきた獲物の攻撃を受けた：持っている獲物が逃げる */
  onPlayerHit(attacker) {
    const now = this.now;
    const player = this.player;
    player.startInvincible(now);
    attacker.afterAttack(now, player);
    this.cameras.main.shake(140, 0.006);

    const { field } = CONFIG;
    const half = CONFIG.prey.width / 2;
    const count = Math.min(CONFIG.carry.escapeOnHit, player.carried.length);
    for (let i = 0; i < count; i++) {
      const prey = player.carried.pop();
      // 攻撃してきた獲物と反対側へ跳ねて逃げる。檻・焚き火のまわりには逃がさない
      let dir = player.x >= attacker.x ? 1 : -1;
      const startX = (d) =>
        Phaser.Math.Clamp(player.x + d * (CONFIG.player.width / 2 + half), field.x + half, field.x + field.width - half);
      if (noPreyZoneAt(this.layout, startX(dir), player.feetY)) dir = -dir;
      prey.escape(startX(dir), player.y, dir, now);
    }
    if (count > 0) floatText(this, player.x, player.y - 130, '逃げられた！', { color: '#ff6b6b' });
  }

  // ---- 檻 ----

  /** 持っている獲物をすべて檻に入れる */
  depositPrey() {
    const player = this.player;
    const count = player.carried.length;
    for (const prey of player.carried) {
      prey.cage();
      this.time.delayedCall(CONFIG.prey.respawnDelayMs, () => this.respawn(prey));
    }
    player.carried.length = 0;
    this.score += count;
    this.cage.setCount(this.score);
    this.cage.bounce();
    floatText(this, CONFIG.cage.x, this.cage.label.y - 120, `+${count}`, { color: '#ffe066', size: 72 });
  }

  /** 檻に入れた獲物の代わりを、別の場所に出す */
  respawn(prey) {
    if (this.ended) return;
    const point = this.findSpawnPoint();
    prey.spawn(point.x, point.feetY, this.now);
    prey.setAlpha(0);
    this.tweens.add({ targets: prey, alpha: 1, duration: 300 });
  }

  // ---- 料理 ----

  /** 焚き火に触れている間、料理の待ち時間を進める */
  updateCooking(dt) {
    const cooking = CONFIG.cooking;
    if (!this.campfire.isTouching(this.player.body)) {
      this.cookHoldMs = 0;
      this.cookMessageShown = false;
      this.campfire.setProgress(0);
      return;
    }

    const check = checkCooking({ score: this.score, cost: cooking.cost, effectActive: this.stats.hasEffects });
    if (!check.ok) {
      this.cookHoldMs = 0;
      this.campfire.setProgress(0);
      if (!this.cookMessageShown) {
        // 触れるたびに1回だけ、料理できない理由を出す
        this.cookMessageShown = true;
        const text = check.reason === 'active' ? '料理の効果中は作れない' : `檻の獲物があと${check.missing}匹必要`;
        floatText(this, this.campfire.x - 120, this.campfire.y - 140, text, { size: 40 });
      }
      return;
    }

    this.cookHoldMs += dt;
    this.campfire.setProgress(cooking.holdMs > 0 ? this.cookHoldMs / cooking.holdMs : 1);
    if (this.cookHoldMs >= cooking.holdMs) this.cook();
  }

  /** 檻の獲物を消費して料理し、ランダムな効果を得る */
  cook() {
    const cooking = CONFIG.cooking;
    this.cookHoldMs = 0;
    this.cookMessageShown = true; // 焚き火から離れるまで「効果中」の表示は出さない
    this.campfire.setProgress(0);

    this.score -= cooking.cost;
    this.cookCount += 1;
    this.cage.setCount(this.score);
    this.cage.bounce();

    const effect = rollCookingEffect(cooking);
    this.stats.addEffect(effect.type, effect.value, cooking.durationMs, this.now);
    this.campfire.burst();
    this.showBanner(`料理完成！\n${describeEffect(effect)}（${cooking.durationMs / 1000}秒）`, '#ffe066');
  }

  /** 効いている料理の効果に合わせて、プレイヤーのまわりの輪の色を変える */
  refreshAura() {
    const types = this.stats.activeEffects(this.now).map((effect) => effect.type);
    if (types.includes(EFFECT_CAPACITY)) this.player.setAura(CONFIG.colors.capacityAura);
    else if (types.includes(EFFECT_SPEED)) this.player.setAura(CONFIG.colors.speedAura);
    else this.player.setAura(null);
  }

  // ---- 終了 ----

  endRound() {
    this.ended = true;
    this.controls.setEnabled(false);
    this.physics.pause();
    this.campfire.setProgress(0);
    this.updateHud();
    addText(this, CONFIG.screen.width / 2, 1000, 'タイムアップ！', { size: 112, color: '#ffe066', stroke: 12 }).setDepth(
      DEPTH.effect + 1,
    );
    this.time.delayedCall(CONFIG.round.endDelayMs, () => {
      this.scene.start(SCENES.result, { score: this.score, cookCount: this.cookCount });
    });
  }

  // ---- 表示 ----

  syncAttachments() {
    this.player.syncAttachments();
    for (const prey of this.preys) {
      if (prey.active) prey.syncOverlay(this.now);
    }
  }

  updateHud() {
    const carried = this.player.carried.length;
    const capacity = this.stats.capacity;
    this.player.drawCarryIcons(capacity);
    this.refreshAura();
    this.hud.update({
      remainingMs: Math.max(0, CONFIG.round.timeLimitSec * 1000 - this.now),
      score: this.score,
      carried,
      capacity,
      speedRate: this.stats.speedRate * this.stats.carryRate(carried),
      effects: this.stats.activeEffects(this.now),
    });
  }

  /** 画面中央に大きく出して消える文字 */
  showBanner(text, color = '#ffffff') {
    const banner = addText(this, CONFIG.screen.width / 2, 1000, text, { size: 64, color, stroke: 10 })
      .setDepth(DEPTH.effect + 1)
      .setLineSpacing(12);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1200, duration: 400, onComplete: () => banner.destroy() });
  }

  /** 同じ場所に重なり続けても、文字を連発しない */
  say(x, y, text, color) {
    if (this.now < this.messageReadyAt) return;
    this.messageReadyAt = this.now + 700;
    floatText(this, x, y, text, { color, size: 40 });
  }

  /** ?debug のときだけ：C キーで料理の効果を即付与（檻の獲物は消費しない） */
  setupDebugKeys() {
    this.input.keyboard?.on('keydown-C', () => {
      const effect = rollCookingEffect(CONFIG.cooking);
      this.stats.addEffect(effect.type, effect.value, CONFIG.cooking.durationMs, this.now);
      this.showBanner(`[debug] ${describeEffect(effect)}`, '#66e0ff');
    });
  }
}
