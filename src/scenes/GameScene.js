import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH, SCENES } from '../constants.js';
import { PadControls } from '../input/PadControls.js';
import { StickControls } from '../input/StickControls.js';
import { Diner } from '../objects/Diner.js';
import { Guild } from '../objects/Guild.js';
import { Player } from '../objects/Player.js';
import { Prey } from '../objects/Prey.js';
import { createStageObjects } from '../objects/Stage.js';
import { checkMeal, describeEffect, rollMealEffect } from '../systems/meal.js';
import { EFFECT_CAPACITY, PlayerStats } from '../systems/PlayerStats.js';
import { buildStage, floorAt, isClearOfObstacles, noPreyZoneAt, randomCourse } from '../systems/stageLayout.js';
import { Wallet } from '../systems/Wallet.js';
import { Hud } from '../ui/Hud.js';
import { addText, floatText } from '../ui/text.js';
import { guardBackNavigation } from '../utils/backGuard.js';
import { keepCameraCentered } from '../utils/camera.js';
import { formatMoney, formatMoneyChange } from '../utils/format.js';

/** 本編：移動・ジャンプ（床の穴を通って上下の段へ）・攻撃・捕獲・ギルドで売る・反撃・食堂・制限時間 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SCENES.game);
  }

  create() {
    // 操作パネル（ジョイスティック・十字キー）はゲーム画面の下に足す。収まらない画面では、全体を少し縮小して表示する
    const { mode, panelHeight } = CONFIG.controls;
    keepCameraCentered(this, CONFIG.screen.height + (mode === 'stick' ? 0 : panelHeight));
    this.physics.resume();

    this.now = 0; // ゲーム内時刻（ms）。タブを切り替えている間は進まない
    this.wallet = new Wallet(); // 所持金（獲物を売ると増え、食堂で使うと減る）
    this.mealCount = 0;
    this.ended = false;
    this.nextAttackAt = 0;
    this.mealHoldMs = 0;
    this.mealMessageShown = false;
    this.messageReadyAt = 0;

    // 一度に持てる数・移動速度はここで計算する（定食の効果もここに加える）
    this.stats = new PlayerStats({
      baseCapacity: CONFIG.carry.baseCapacity,
      baseSpeed: CONFIG.player.runSpeed,
      slowdownPerPrey: CONFIG.carry.slowdownPerPrey,
      minSpeedRate: CONFIG.carry.minSpeedRate,
    });

    // ステージ（穴のある床・障害物）と、一番上の床のギルド・食堂。
    // 一番上以外の穴と岩は、プレイのたびにランダム（遊べる配置が作れなければ設定の配置）
    const { field } = CONFIG;
    this.physics.world.setBounds(field.x, field.y, field.width, field.height);
    const course = CONFIG.course.random ? randomCourse(CONFIG) : null;
    this.layout = buildStage(course ? { ...CONFIG, ...course } : CONFIG);
    const { floors, obstacles, preyFences } = createStageObjects(this, this.layout);
    this.guild = new Guild(this, this.layout.floors[CONFIG.guild.floor].y);
    this.diner = new Diner(this, this.layout.floors[CONFIG.diner.floor].y);

    this.player = new Player(this, CONFIG.player.startX, this.layout.floors[CONFIG.player.startFloor].y);

    /** @type {Prey[]} */
    this.preys = [];
    for (let i = 0; i < CONFIG.prey.count; i++) {
      const prey = new Prey(this, this.layout);
      const point = this.findSpawnPoint();
      prey.spawn(point.x, point.feetY, this.now, point.typeIndex);
      this.preys.push(prey);
    }

    // 床はどの面も固い。上の段へは穴をジャンプで通り抜け、下の段へは穴から飛び降りる
    this.physics.add.collider(this.player, floors);
    this.physics.add.collider(this.player, obstacles);
    this.physics.add.collider(this.preys, floors);
    this.physics.add.collider(this.preys, obstacles);
    this.physics.add.collider(this.preys, preyFences);
    this.physics.add.overlap(this.player, this.preys, this.onPlayerTouchPrey, undefined, this);

    this.controls = mode === 'pad' ? new PadControls(this) : new StickControls(this, { panel: mode === 'joystick' });
    this.hud = new Hud(this);

    // 物理演算で位置が決まったあとに、頭の上の表示などを合わせる
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);

    // 遊んでいる途中の「戻る」操作（画面の端からのスワイプなど）やアプリの切り替えでは、ページを離れずに一時停止する
    const pause = () => this.pauseGame();
    const releaseControls = () => this.controls.release(); // 再開したとき、止まる前に押していた指は離したことにする
    const unguardBack = guardBackNavigation(pause);
    this.game.events.on(Phaser.Core.Events.HIDDEN, pause);
    this.game.events.on(Phaser.Core.Events.BLUR, pause);
    this.events.on(Phaser.Scenes.Events.RESUME, releaseControls);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncAttachments, this);
      this.events.off(Phaser.Scenes.Events.RESUME, releaseControls);
      unguardBack();
      this.game.events.off(Phaser.Core.Events.HIDDEN, pause);
      this.game.events.off(Phaser.Core.Events.BLUR, pause);
    });

    if (this.registry.get('debug')) this.setupDebugKeys();

    this.updateHud();
    this.showBanner('スタート！\n穴から降りて獲物を捕まえ\nギルドへ届けよう');
  }

  update(_time, delta) {
    if (this.ended) return;
    const dt = Math.min(delta, 100); // 処理落ちで時間が一気に進まないように
    this.now += dt;
    const now = this.now;

    // 定食の効果の時間切れ
    if (this.stats.update(now).length > 0) {
      floatText(this, this.player.x, this.player.y - 130, '定食の効果が切れた', { size: 38 });
    }

    // 移動（持っている数が多いほど遅い。ジャンプの高さは変わらない）
    const input = this.controls.read();
    const carried = this.player.carried.length;
    this.player.updateMovement(now, input, this.stats.moveSpeed(carried));

    // 攻撃
    const wantsAttack = input.attack || (CONFIG.controls.autoAttack && this.hasPreyInAttackRange());
    if (wantsAttack && now >= this.nextAttackAt) this.attack(now);

    // 獲物の動き
    for (const prey of this.preys) {
      if (prey.active) prey.think(now, this.player, carried > 0);
    }

    // ギルドと食堂（一番上の床）
    if (carried > 0 && this.guild.isTouching(this.player.body)) this.deliverPrey();
    this.updateMeal(dt);

    this.updateHud();

    if (now >= CONFIG.round.timeLimitSec * 1000) this.endRound();
  }

  // ---- 獲物の出現 ----

  /**
   * 新しい獲物の種類と場所を決める。種類ごとに決まった床の、穴・障害物・ギルド・食堂から離れ、
   * プレイヤーからも離れた場所を探す
   * @returns {{ x: number, feetY: number, typeIndex: number }}
   */
  findSpawnPoint() {
    const { types, spawnMinDistance } = CONFIG.prey;
    let point = null;
    for (let i = 0; i < 80; i++) {
      const typeIndex = Phaser.Math.Between(0, types.length - 1);
      const floor = this.layout.floors[types[typeIndex].floor];
      const half = types[typeIndex].width / 2;
      const x = Phaser.Math.Between(floor.x1 + half + 10, floor.x2 - half - 10);
      point = { x, feetY: floor.y, typeIndex };
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
      this.say(player.x, player.y - 130, 'いっぱい！ギルドへ運ぼう', '#ffe066');
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
    const count = Math.min(CONFIG.carry.escapeOnHit, player.carried.length);
    for (let i = 0; i < count; i++) {
      const prey = player.carried.pop();
      const half = prey.type.width / 2;
      // 攻撃してきた獲物と反対側へ跳ねて逃げる。ギルド・食堂のまわりには逃がさない
      let dir = player.x >= attacker.x ? 1 : -1;
      const startX = (d) =>
        Phaser.Math.Clamp(player.x + d * (CONFIG.player.width / 2 + half), field.x + half, field.x + field.width - half);
      if (noPreyZoneAt(this.layout, startX(dir), player.feetY)) dir = -dir;
      prey.escape(startX(dir), player.y, dir, now);
    }
    if (count > 0) floatText(this, player.x, player.y - 130, '逃げられた！', { color: '#ff6b6b' });
  }

  // ---- ギルド ----

  /** 持っている獲物をすべてギルドに売って、お金をもらう */
  deliverPrey() {
    const player = this.player;
    const total = player.carried.reduce((sum, prey) => sum + prey.type.price, 0);
    for (const prey of player.carried) {
      prey.deliver();
      this.time.delayedCall(CONFIG.prey.respawnDelayMs, () => this.respawn(prey));
    }
    player.carried.length = 0;
    this.wallet.earn(total);
    this.guild.bounce();
    this.hud.flashMoney(CONFIG.colors.moneyGain, this.now);
    // 上の帯に隠れないように、建物のすぐ上から少しだけ浮かせる
    floatText(this, this.guild.x, this.guild.top - 10, formatMoneyChange(total, CONFIG.money.unit), {
      color: CONFIG.colors.moneyGain,
      size: 72,
      rise: 60,
      duration: 1100,
    });
  }

  /** ギルドに届けた獲物の代わりを、別の場所に出す（種類も決め直す） */
  respawn(prey) {
    if (this.ended) return;
    const point = this.findSpawnPoint();
    prey.spawn(point.x, point.feetY, this.now, point.typeIndex);
    prey.setAlpha(0);
    this.tweens.add({ targets: prey, alpha: 1, duration: 300 });
  }

  // ---- 食堂 ----

  /** 食堂に触れている間、食べるまでの待ち時間を進める */
  updateMeal(dt) {
    const meal = CONFIG.meal;
    if (!this.diner.isTouching(this.player.body)) {
      this.mealHoldMs = 0;
      this.mealMessageShown = false;
      this.diner.setProgress(0);
      return;
    }

    const check = checkMeal({ money: this.wallet.money, price: meal.price, effectActive: this.stats.hasEffects });
    if (!check.ok) {
      this.mealHoldMs = 0;
      this.diner.setProgress(0);
      if (!this.mealMessageShown) {
        // 触れるたびに1回だけ、食べられない理由を出す
        this.mealMessageShown = true;
        const text =
          check.reason === 'active'
            ? '定食の効果中は食べられない'
            : `お金が足りない（あと${formatMoney(check.missing, CONFIG.money.unit)}）`;
        floatText(this, this.diner.x - 120, this.diner.top + this.diner.height / 2, text, { size: 40 });
      }
      return;
    }

    this.mealHoldMs += dt;
    this.diner.setProgress(meal.holdMs > 0 ? this.mealHoldMs / meal.holdMs : 1);
    if (this.mealHoldMs >= meal.holdMs) this.eatMeal();
  }

  /** お金を払って日替わり定食を食べ、ランダムな効果を得る */
  eatMeal() {
    const meal = CONFIG.meal;
    this.mealHoldMs = 0;
    this.mealMessageShown = true; // 食堂から離れるまで「効果中」の表示は出さない
    this.diner.setProgress(0);

    this.wallet.spend(meal.price);
    this.mealCount += 1;
    this.hud.flashMoney(CONFIG.colors.moneyLoss, this.now);
    floatText(this, this.diner.x, this.diner.top - 10, formatMoneyChange(-meal.price, CONFIG.money.unit), {
      color: CONFIG.colors.moneyLoss,
      size: 72,
      rise: 60,
      duration: 1100,
    });

    const effect = rollMealEffect(meal);
    this.stats.addEffect(effect.type, effect.value, meal.durationMs, this.now);
    this.diner.burst();
    this.showBanner(`日替わり定食！\n${describeEffect(effect)}（${meal.durationMs / 1000}秒）`, '#ffe066');
  }

  /** 効いている定食の効果に合わせて、プレイヤーのまわりの輪の色を変える */
  refreshAura() {
    const types = this.stats.activeEffects(this.now).map((effect) => effect.type);
    this.player.setAura(types.includes(EFFECT_CAPACITY) ? CONFIG.colors.capacityAura : null);
  }

  // ---- 一時停止・終了 ----

  /** 一時停止して、上に「一時停止（タップで再開）」を重ねる。時間・獲物・効果の残り時間も止まる */
  pauseGame() {
    if (this.ended || !this.scene.isActive()) return;
    this.controls.release();
    this.scene.pause();
    this.scene.launch(SCENES.pause);
  }

  endRound() {
    this.ended = true;
    this.controls.setEnabled(false);
    this.physics.pause();
    this.diner.setProgress(0);
    this.updateHud();
    addText(this, CONFIG.screen.width / 2, 1000, 'タイムアップ！', { size: 112, color: '#ffe066', stroke: 12 }).setDepth(
      DEPTH.effect + 1,
    );
    this.time.delayedCall(CONFIG.round.endDelayMs, () => {
      const { money, earned, spent } = this.wallet;
      this.scene.start(SCENES.result, { money, earned, spent, mealCount: this.mealCount });
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
      now: this.now,
      remainingMs: Math.max(0, CONFIG.round.timeLimitSec * 1000 - this.now),
      money: this.wallet.money,
      carried,
      capacity,
      speedRate: this.stats.carryRate(carried),
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

  /** ?debug のときだけ：C キーで定食の効果を即付与（お金は減らない） */
  setupDebugKeys() {
    this.input.keyboard?.on('keydown-C', () => {
      const effect = rollMealEffect(CONFIG.meal);
      this.stats.addEffect(effect.type, effect.value, CONFIG.meal.durationMs, this.now);
      this.showBanner(`[debug] ${describeEffect(effect)}`, '#66e0ff');
    });
  }
}
