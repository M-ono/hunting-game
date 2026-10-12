import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';

/**
 * 片手操作
 * - 画面のどこでもドラッグ：指を置いた位置に仮想スティックが出る
 *   - 左右に倒す：移動
 *   - 上にはじく：ジャンプ（一段上の床まで届く）。下の段へは床の穴から飛び降りる
 * - 短くタップ：攻撃
 * - PC：←→/AD で移動、↑/W/Space でジャンプ、Z/J で攻撃
 */
export class OneHandControls {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.cfg = CONFIG.controls;
    this.enabled = true;

    this.pointerId = null; // スティック操作中の指
    this.origin = new Phaser.Math.Vector2(); // スティックの中心
    this.stick = new Phaser.Math.Vector2(); // 指による入力（長さ0か1の向き）
    this.maxMove = 0; // 今回のタッチで指が動いた最大距離（タップ判定用）
    this.upLatched = false; // 上に倒したままか（倒しっぱなしで連続ジャンプしないように）
    this.jumpQueued = false;
    this.attackQueued = false;
    this.input = { x: 0, jump: false, attack: false };

    // スティックの見た目。カメラの位置に関係なく指の位置に出すため scrollFactor 0
    const radius = this.cfg.joystickRadius;
    this.base = scene.add
      .circle(0, 0, radius, 0xffffff, 0.12)
      .setStrokeStyle(4, 0xffffff, 0.4)
      .setScrollFactor(0)
      .setDepth(DEPTH.controls)
      .setVisible(false);
    this.knob = scene.add
      .circle(0, 0, radius * 0.45, 0xffffff, 0.4)
      .setScrollFactor(0)
      .setDepth(DEPTH.controls)
      .setVisible(false);

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);

    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys('W,A,D,UP,LEFT,RIGHT,SPACE,Z,J');
    }

    // タブ切り替えなどで指の状態が分からなくなったら離したことにする
    scene.game.events.on(Phaser.Core.Events.BLUR, this.release, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  /**
   * 今フレームの入力。ジャンプと攻撃は1回読んだら消える。
   * @returns {{ x: number, jump: boolean, attack: boolean }} x はスティックの横方向（-1〜1）
   */
  read() {
    const input = this.input;
    input.x = this.stick.x;
    input.jump = this.jumpQueued;
    input.attack = this.attackQueued;
    this.jumpQueued = false;
    this.attackQueued = false;

    if (this.keys) {
      const k = this.keys;
      const JustDown = Phaser.Input.Keyboard.JustDown;
      const x = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      if (x !== 0) input.x = x;
      if (JustDown(k.UP) || JustDown(k.W) || JustDown(k.SPACE)) input.jump = true;
      if (JustDown(k.Z) || JustDown(k.J)) input.attack = true;
    }

    if (!this.enabled) {
      input.x = 0;
      input.jump = false;
      input.attack = false;
    }
    return input;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /** 指を離した状態に戻す */
  release() {
    this.pointerId = null;
    this.stick.set(0, 0);
    this.upLatched = false;
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  onPointerDown(pointer) {
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = pointer.id;
    this.origin.set(pointer.x, pointer.y);
    this.maxMove = 0;
    this.stick.set(0, 0);
    this.upLatched = false;
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.knob.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  onPointerMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    const { joystickRadius, deadZone, jumpThreshold, jumpMinDistance } = this.cfg;
    this.maxMove = Math.max(this.maxMove, Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.x, pointer.y));

    let dx = pointer.x - this.origin.x;
    let dy = pointer.y - this.origin.y;
    let distance = Math.hypot(dx, dy);

    // 指がスティックの外まで行ったら、スティックごと指についてくる
    if (distance > joystickRadius) {
      const pull = distance - joystickRadius;
      this.origin.x += (dx / distance) * pull;
      this.origin.y += (dy / distance) * pull;
      dx = pointer.x - this.origin.x;
      dy = pointer.y - this.origin.y;
      distance = joystickRadius;
      this.base.setPosition(this.origin.x, this.origin.y);
    }
    this.knob.setPosition(pointer.x, pointer.y);

    if (distance > deadZone) {
      this.stick.set(dx / distance, dy / distance);
    } else {
      this.stick.set(0, 0);
    }

    // 上に倒した瞬間にジャンプ（倒したままでは1回だけ。少し戻すとまた跳べる）
    const up = -dy >= jumpMinDistance && this.stick.y <= -jumpThreshold;
    if (up && !this.upLatched) this.jumpQueued = true;
    if (up) this.upLatched = true;
    else if (-dy < jumpMinDistance * 0.6 || this.stick.y > -jumpThreshold + 0.2) this.upLatched = false;
  }

  onPointerUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    const duration = pointer.upTime - pointer.downTime;
    if (duration <= this.cfg.tapMaxMs && this.maxMove <= this.cfg.tapMaxMove) {
      this.attackQueued = true;
    }
    this.release();
  }

  destroy() {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
  }
}
