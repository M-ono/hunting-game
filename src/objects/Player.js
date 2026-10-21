import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH, TEXTURES } from '../constants.js';
/** プレイヤー。左右移動・ジャンプ（床の穴を通って一段上へ）・無敵時間・持っている獲物の管理。下の段へは床の穴から飛び降りる */
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
    // ジャンプの高さから、跳び上がる勢いを計算する（高さ = 勢い² ÷ (2 × 重力)）
    this.jumpSpeed = Math.sqrt(2 * CONFIG.physics.gravity * this.cfg.jumpHeight);
    this.body.setSize(this.cfg.width, this.cfg.height);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.player);

    this.lastGroundedAt = -Infinity;
    this.jumpRequestedAt = -Infinity;
    /** 最後に立っていた床の高さ（ジャンプ中も「どの段にいるか」の判定に使う） */
    this.groundY = feetY;

    /** 持っている獲物 @type {import('./Prey.js').Prey[]} */
    this.carried = [];
    this.invincibleUntil = 0;

    // 頭の上に「持てる数」の枠と「持っている獲物」（獲物の色＝値段）を表示
    this.carryIcons = scene.add.graphics().setDepth(DEPTH.player + 1);
    this.iconsKey = '';

    // 定食の効果中に体のまわりに出す輪
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

  /** 床や岩の上に立っているか。獲物との重なり（touching）は数えない（空中で獲物に触れてもジャンプできないように） */
  get onGround() {
    return this.body.blocked.down;
  }

  /**
   * 入力に合わせて動かす。毎フレーム呼ぶ。
   * @param {number} now ゲーム内時刻
   * @param {{ x: number, jump: boolean }} input スティックの横方向（-1〜1）とジャンプ入力
   * @param {number} runSpeed 今の左右の速さ
   */
  updateMovement(now, input, runSpeed) {
    const grounded = this.onGround;
    if (grounded) {
      this.lastGroundedAt = now;
      this.groundY = this.feetY;
    }
    if (input.jump) this.jumpRequestedAt = now;

    // 左右（スティックを少し倒すだけで最高速）
    const dir = Math.abs(input.x) >= CONFIG.controls.moveThreshold ? Math.sign(input.x) : 0;
    this.setVelocityX(dir * runSpeed);
    if (dir !== 0) this.setFlipX(dir < 0);

    // ジャンプ：穴を通り抜ければ一段上の床に乗れる高さ。着地直前の入力と、床から落ちた直後の入力も受け付ける
    const jumpWanted = now - this.jumpRequestedAt <= this.cfg.jumpBufferMs;
    const canJump = now - this.lastGroundedAt <= this.cfg.coyoteMs;
    if (jumpWanted && canJump) {
      this.setVelocityY(-this.jumpSpeed);
      this.jumpRequestedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
    }

    // 落ちる速さの上限（上向きの勢いは制限しない）
    if (this.body.velocity.y > CONFIG.physics.maxFallSpeed) this.setVelocityY(CONFIG.physics.maxFallSpeed);
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

  /** 定食の効果の輪（color = null で消す）。色が変わったときだけ描き直す */
  setAura(color) {
    if (color === this.auraColor) return;
    this.auraColor = color;
    if (color === null) {
      this.aura.setVisible(false);
    } else {
      this.aura.setStrokeStyle(8, color, 0.85).setVisible(true);
    }
  }

  /** 頭の上の表示を更新（変化があったときだけ描き直す）。持っている獲物は、その獲物の色の丸で描く */
  drawCarryIcons(capacity) {
    const carried = this.carried.length;
    const key = `${this.carried.map((prey) => prey.typeIndex).join(',')}/${capacity}`;
    if (key === this.iconsKey) return;
    this.iconsKey = key;

    const slots = Math.max(capacity, carried);
    const gap = 34;
    const startX = (-(slots - 1) * gap) / 2;
    const g = this.carryIcons.clear();
    for (let i = 0; i < slots; i++) {
      const x = startX + i * gap;
      if (i < carried) {
        const { color, edge } = this.carried[i].type;
        g.fillStyle(color, 1).fillCircle(x, 0, 13);
        g.lineStyle(4, edge, 1).strokeCircle(x, 0, 13);
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
