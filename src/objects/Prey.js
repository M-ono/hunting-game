import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH, TEXTURES } from '../constants.js';
import { floorAt, noPreyZoneAt, onSameLevel } from '../systems/stageLayout.js';
import { addText } from '../ui/text.js';

export const PREY_STATE = Object.freeze({
  WANDER: 'wander', // 床の上をうろうろ歩く
  FLEE: 'flee', // 走って逃げる（攻撃された直後・手から逃げ出した直後）
  AGGRO: 'aggro', // プレイヤーに向かってくる（プレイヤーが獲物を持っていて、同じ段にいるとき）
  STUNNED: 'stunned', // 気絶（動かない。触れると捕まえられる）
  CARRIED: 'carried', // プレイヤーが持っている
  CAGED: 'caged', // 檻の中（補充されるまで出てこない）
});

/** 獲物。状態ごとの動き（AI）と見た目を持つ */
export class Prey extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {ReturnType<import('../systems/stageLayout.js').buildStage>} stage
   */
  constructor(scene, stage) {
    super(scene, 0, 0, TEXTURES.prey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cfg = CONFIG.prey;
    this.stage = stage;
    this.body.setSize(this.cfg.width, this.cfg.height);
    this.body.setMaxVelocityY(CONFIG.physics.maxFallSpeed);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.prey);

    this.hp = this.cfg.maxHp;
    this.dir = 1; // 歩く向き（1 = 右、-1 = 左）
    this.idle = false; // うろうろ中に立ち止まっているか
    this.stateUntil = 0; // 逃走・気絶が終わる時刻
    this.burstUntil = 0; // 飛ばされている間は AI で速さを変えない
    this.nextTurnAt = 0;
    this.attackReadyAt = 0;

    // 頭の上のマーク（向かってくる「!」、気絶「★」）と、体力・気絶の残り時間の表示
    this.marker = addText(scene, 0, 0, '', { size: 52 }).setDepth(DEPTH.prey + 1).setVisible(false);
    this.overlay = scene.add.graphics().setDepth(DEPTH.prey + 1);

    this.setState(PREY_STATE.CAGED);
    this.disableBody(true, true);
  }

  get feetY() {
    return this.body.bottom;
  }

  get isStunned() {
    return this.state === PREY_STATE.STUNNED;
  }

  get isAggro() {
    return this.state === PREY_STATE.AGGRO;
  }

  /** プレイヤーの攻撃が当たる状態か */
  get canBeHit() {
    return this.state === PREY_STATE.WANDER || this.state === PREY_STATE.FLEE || this.state === PREY_STATE.AGGRO;
  }

  /** ステージに出す（最初の配置・補充） */
  spawn(x, feetY, now) {
    this.enableBody(true, x, feetY - this.cfg.height / 2, true, true);
    this.hp = this.cfg.maxHp;
    this.attackReadyAt = now;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.toWander(now);
  }

  /**
   * プレイヤーの攻撃を受けた。
   * @returns {boolean} 気絶したら true
   */
  takeHit(now, fromX, damage) {
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) {
      this.stun(now);
    } else {
      const away = this.x >= fromX ? 1 : -1;
      this.startFlee(now, away, CONFIG.attack.knockback, -280, CONFIG.attack.knockbackMs);
    }
    this.flash();
    return this.hp === 0;
  }

  /** 捕まえられた */
  capture() {
    this.setState(PREY_STATE.CARRIED);
    this.disableBody(true, true);
    this.hideOverlay();
  }

  /** プレイヤーの手から逃げ出す（体力が戻って、また動き出す） */
  escape(x, y, dir, now) {
    this.enableBody(true, x, y, true, true);
    this.hp = this.cfg.maxHp;
    this.attackReadyAt = now + this.cfg.attackCooldownMs; // 逃げた直後は襲ってこない
    this.startFlee(now, dir, this.cfg.escapeSpeed, -this.cfg.escapeJump, CONFIG.attack.knockbackMs * 2);
  }

  /** 檻に入れられた */
  cage() {
    this.setState(PREY_STATE.CAGED);
    this.disableBody(true, true);
    this.hideOverlay();
  }

  /** プレイヤーを攻撃したあとは、少し離れてから次の攻撃を狙う */
  afterAttack(now, player) {
    this.attackReadyAt = now + this.cfg.attackCooldownMs;
    const away = this.x >= player.x ? 1 : -1;
    this.startFlee(now, away, this.cfg.fleeSpeed, -200, 0);
  }

  /**
   * 毎フレームの動き。
   * @param {number} now ゲーム内時刻
   * @param {import('./Player.js').Player} player
   * @param {boolean} playerCarrying プレイヤーが獲物を持っているか
   */
  think(now, player, playerCarrying) {
    if (this.state === PREY_STATE.STUNNED) {
      if (this.body.blocked.down) this.setVelocityX(0);
      if (now >= this.stateUntil) {
        this.hp = this.cfg.maxHp;
        this.toWander(now);
      }
      return;
    }
    // 空中（飛ばされている・落ちている）や、飛ばされている間は操作しない
    if (!this.body.blocked.down || now < this.burstUntil) return;

    // 檻・焚き火のまわりに入ってしまったら、近いほうの端から出ていく
    const zone = noPreyZoneAt(this.stage, this.x, this.feetY);
    if (zone) {
      const out = this.x - zone.x1 < zone.x2 - this.x ? -1 : 1;
      this.setFlipX(out < 0);
      this.setVelocityX(out * this.cfg.fleeSpeed);
      return;
    }

    const dx = player.x - this.x;
    const sameLevel = !player.climbing && onSameLevel(player.feetY, this.feetY);
    switch (this.state) {
      case PREY_STATE.FLEE:
        if (now >= this.stateUntil) this.toWander(now);
        else this.walk(dx >= 0 ? -1 : 1, this.cfg.fleeSpeed, false);
        break;
      case PREY_STATE.AGGRO:
        if (!playerCarrying || !sameLevel || Math.abs(dx) > this.cfg.aggroRadius * 1.25) this.toWander(now);
        else this.walk(Math.sign(dx) || this.dir, this.cfg.aggroSpeed, false);
        break;
      case PREY_STATE.WANDER:
        if (playerCarrying && sameLevel && now >= this.attackReadyAt && Math.abs(dx) < this.cfg.aggroRadius) {
          this.toAggro();
        } else {
          this.wander(now);
        }
        break;
      default:
        break;
    }
  }

  /** マーク・体力・気絶の残り時間の表示を位置に合わせて描く（物理演算で位置が決まったあとに呼ぶ） */
  syncOverlay(now) {
    const top = -this.cfg.height / 2;
    this.marker.setPosition(this.x, this.y + top - 36);
    const g = this.overlay.clear().setPosition(this.x, this.y);

    if (this.isStunned) {
      // 気絶の残り時間を輪で表示（減っていく）
      const left = Phaser.Math.Clamp((this.stateUntil - now) / this.cfg.stunMs, 0, 1);
      g.lineStyle(8, 0xffe066, 0.9);
      g.beginPath();
      g.arc(0, 0, this.cfg.width / 2 + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      g.strokePath();
    } else if (this.hp < this.cfg.maxHp) {
      // 体力を点で表示
      const gap = 18;
      const startX = (-(this.cfg.maxHp - 1) * gap) / 2;
      for (let i = 0; i < this.cfg.maxHp; i++) {
        g.fillStyle(i < this.hp ? 0xff5555 : 0x333333, 1).fillCircle(startX + i * gap, top - 14, 6);
      }
    }
  }

  // ---- 内部 ----

  toWander(now) {
    this.setState(PREY_STATE.WANDER);
    this.nextTurnAt = now; // すぐに歩く向きを決める
    this.refreshLook();
  }

  toAggro() {
    this.setState(PREY_STATE.AGGRO);
    this.refreshLook();
  }

  stun(now) {
    this.setState(PREY_STATE.STUNNED);
    this.stateUntil = now + this.cfg.stunMs;
    this.burstUntil = 0;
    this.setVelocityX(0);
    this.refreshLook();
  }

  /** dir の向きへ飛ばされ（burstSpeed・上向き jumpVelocity）、そのあとプレイヤーから離れるように走る */
  startFlee(now, dir, burstSpeed, jumpVelocity, burstMs) {
    this.setState(PREY_STATE.FLEE);
    this.stateUntil = now + Math.max(this.cfg.fleeMs, burstMs);
    this.burstUntil = now + burstMs;
    this.dir = dir;
    this.setFlipX(dir < 0);
    this.setVelocity(dir * burstSpeed, jumpVelocity);
    this.refreshLook();
  }

  wander(now) {
    if (now >= this.nextTurnAt) {
      const [minMs, maxMs] = this.cfg.wanderTurnMs;
      this.nextTurnAt = now + Phaser.Math.Between(minMs, maxMs);
      this.idle = Math.random() < this.cfg.idleChance;
      if (Math.random() < 0.5) this.dir = -this.dir;
    }
    if (this.idle) {
      this.setVelocityX(0);
    } else {
      this.walk(this.dir, this.cfg.wanderSpeed, true);
    }
  }

  /**
   * 床の上を歩く。床の端・壁・檻と焚き火のまわりの手前では止まる（turnAround が true なら引き返す）。
   */
  walk(dir, speed, turnAround) {
    const blocked = dir < 0 ? this.body.blocked.left : this.body.blocked.right;
    const aheadX = this.x + dir * (this.cfg.width / 2 + 6);
    const edgeAhead = !floorAt(this.stage, aheadX, this.feetY) || noPreyZoneAt(this.stage, aheadX, this.feetY);
    if (blocked || edgeAhead) {
      if (turnAround) {
        this.dir = -dir;
        this.setFlipX(this.dir < 0);
      }
      this.setVelocityX(0);
      return;
    }
    this.dir = dir;
    this.setFlipX(dir < 0);
    this.setVelocityX(dir * speed);
  }

  /** 状態に合わせた色とマーク */
  refreshLook() {
    this.clearTint();
    if (this.state === PREY_STATE.AGGRO) {
      this.setTint(CONFIG.colors.preyAggroTint);
      this.marker.setText('!').setColor('#ff5555').setVisible(true);
    } else if (this.state === PREY_STATE.STUNNED) {
      this.setTint(CONFIG.colors.preyStunTint);
      this.marker.setText('★').setColor('#ffe066').setVisible(true);
    } else {
      this.marker.setVisible(false);
    }
  }

  /** 攻撃が当たった瞬間に白く光らせる */
  flash() {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (this.active) this.refreshLook();
    });
  }

  hideOverlay() {
    this.marker.setVisible(false);
    this.overlay.clear();
  }

  destroy(fromScene) {
    this.marker?.destroy();
    this.overlay?.destroy();
    super.destroy(fromScene);
  }
}
