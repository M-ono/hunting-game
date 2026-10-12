import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH, TEXTURES } from '../constants.js';
import { ladderToClimbDown, ladderToClimbUp } from '../systems/stageLayout.js';

/** プレイヤー。左右移動・ジャンプ・はしご・無敵時間・持っている獲物の管理 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} feetY 足元の高さ
   */
  constructor(scene, x, feetY) {
    super(scene, x, feetY - CONFIG.player.height / 2, TEXTURES.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cfg = CONFIG.player;
    this.body.setSize(this.cfg.width, this.cfg.height);
    this.body.setMaxVelocityY(CONFIG.physics.maxFallSpeed);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.player);

    /** つかまっているはしご（なければ null） */
    this.climbing = null;
    this.lastGroundedAt = -Infinity;
    this.jumpRequestedAt = -Infinity;

    /** 持っている獲物 @type {import('./Prey.js').Prey[]} */
    this.carried = [];
    this.invincibleUntil = 0;

    // 頭の上に「持てる数」の枠と「持っている数」を表示
    this.carryIcons = scene.add.graphics().setDepth(DEPTH.player + 1);
    this.iconsKey = '';

    // 料理の効果中に体のまわりに出す輪
    this.auraColor = null;
    this.aura = scene.add
      .ellipse(x, this.y, this.cfg.width + 40, this.cfg.height + 40)
      .setStrokeStyle(8, 0xffffff, 0.8)
      .setDepth(DEPTH.player - 1)
      .setVisible(false);
  }

  /** 足元の高さ */
  get feetY() {
    return this.body.bottom;
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  /**
   * 入力に合わせて動かす。毎フレーム呼ぶ。
   * @param {number} now ゲーム内時刻
   * @param {{ x: number, y: number, jump: boolean }} input スティック（-1〜1）とジャンプ入力
   * @param {{ run: number, climb: number }} speeds 今の移動速度
   * @param {ReturnType<import('../systems/stageLayout.js').buildStage>} stage
   */
  updateMovement(now, input, speeds, stage) {
    const { moveThreshold, climbThreshold } = CONFIG.controls;
    const grab = CONFIG.ladder.grabDistance;
    if (this.onGround) this.lastGroundedAt = now;
    if (input.jump) this.jumpRequestedAt = now;

    if (this.climbing) {
      this.updateClimbing(input, speeds.climb);
      return;
    }

    // はしごにつかまる（上に倒すと登る、上端で下に倒すと降りる）
    if (input.y <= -climbThreshold) {
      const ladder = ladderToClimbUp(stage, this.x, this.feetY, grab);
      if (ladder) return this.startClimbing(ladder);
    } else if (input.y >= climbThreshold && this.onGround) {
      const ladder = ladderToClimbDown(stage, this.x, this.feetY, grab);
      if (ladder) return this.startClimbing(ladder);
    }

    // 左右（スティックを少し倒すだけで最高速）
    const dir = Math.abs(input.x) >= moveThreshold ? Math.sign(input.x) : 0;
    this.setVelocityX(dir * speeds.run);
    if (dir !== 0) this.setFlipX(dir < 0);

    // ジャンプ（着地直前の入力と、床から落ちた直後の入力も受け付ける）
    const jumpWanted = now - this.jumpRequestedAt <= this.cfg.jumpBufferMs;
    const canJump = now - this.lastGroundedAt <= this.cfg.coyoteMs;
    if (jumpWanted && canJump) {
      this.setVelocityY(-this.cfg.jumpSpeed);
      this.jumpRequestedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
    }
  }

  // 位置を直接合わせるときは body.reset を使う（x, y の代入だと、そのフレームの移動量があとから足されてずれる）

  startClimbing(ladder) {
    this.climbing = ladder;
    this.jumpRequestedAt = -Infinity;
    this.body.setAllowGravity(false);
    this.body.reset(ladder.x, this.y);
  }

  updateClimbing(input, speed) {
    const ladder = this.climbing;
    const { climbThreshold } = CONFIG.controls;
    let vy = 0;
    if (input.y <= -climbThreshold) vy = -speed;
    else if (input.y >= climbThreshold) vy = speed;
    if (this.x !== ladder.x) this.body.reset(ladder.x, this.y);
    this.setVelocity(0, vy);

    // 上端・下端に着いたら床に降り立つ
    if (vy < 0 && this.feetY <= ladder.topY) this.stopClimbing(ladder.topY);
    else if (vy > 0 && this.feetY >= ladder.bottomY) this.stopClimbing(ladder.bottomY);
  }

  stopClimbing(feetY) {
    this.climbing = null;
    this.body.setAllowGravity(true);
    this.body.reset(this.x, feetY - this.cfg.height / 2);
  }

  isInvincible(now) {
    return now < this.invincibleUntil;
  }

  /** 攻撃を受けた：無敵時間の開始と点滅 */
  startInvincible(now) {
    const duration = this.cfg.invincibleMs;
    this.invincibleUntil = now + duration;
    this.blinkTween?.stop();
    this.blinkTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      duration: 90,
      yoyo: true,
      repeat: Math.max(0, Math.floor(duration / 180) - 1),
      onComplete: () => this.setAlpha(1),
      onStop: () => this.setAlpha(1),
    });
  }

  /** 頭の上の表示と体のまわりの輪を、プレイヤーの位置に合わせる（物理演算で位置が決まったあとに呼ぶ） */
  syncAttachments() {
    this.carryIcons.setPosition(this.x, this.y - this.cfg.height / 2 - 30);
    this.aura.setPosition(this.x, this.y);
  }

  /** 料理の効果の輪（color = null で消す）。色が変わったときだけ描き直す */
  setAura(color) {
    if (color === this.auraColor) return;
    this.auraColor = color;
    if (color === null) {
      this.aura.setVisible(false);
    } else {
      this.aura.setStrokeStyle(8, color, 0.85).setVisible(true);
    }
  }

  /** 頭の上の表示を更新（変化があったときだけ描き直す） */
  drawCarryIcons(capacity) {
    const carried = this.carried.length;
    const key = `${carried}/${capacity}`;
    if (key === this.iconsKey) return;
    this.iconsKey = key;

    const slots = Math.max(capacity, carried);
    const gap = 34;
    const startX = (-(slots - 1) * gap) / 2;
    const g = this.carryIcons.clear();
    for (let i = 0; i < slots; i++) {
      const x = startX + i * gap;
      if (i < carried) {
        g.fillStyle(CONFIG.colors.prey, 1).fillCircle(x, 0, 13);
        g.lineStyle(4, CONFIG.colors.preyEdge, 1).strokeCircle(x, 0, 13);
      } else {
        g.lineStyle(4, 0xffffff, 0.7).strokeCircle(x, 0, 13);
      }
    }
  }

  destroy(fromScene) {
    this.carryIcons?.destroy();
    this.aura?.destroy();
    super.destroy(fromScene);
  }
}
