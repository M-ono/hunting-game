import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';
import { joystickLayout, leftJumpZone, stickDirection } from './controlLayout.js';
import { addPanelBackground, drawArrows } from './controlPanel.js';
import { addControlKeys, applyControlKeys } from './keyboard.js';

/**
 * ジョイスティック操作。倒して移動、上にはじいてジャンプ（斜め上で移動しながら）、軽くタップで攻撃。親指1本で全部できる
 * - panel: true（controls.mode: 'joystick'）：ゲーム画面の下の操作パネルに置く。ふだんは右下に出しておき、
 *   パネルのどこを触っても触った位置に出る。ゲーム画面を触っても何も起きない
 * - panel: false（controls.mode: 'stick'）：画面のどこを触っても、触った位置に出る（最初の版）
 * - 触った位置が中心になるので、触った瞬間に動き出したりはしない（倒した向きだけで決まる）
 * - 指がジョイスティックの外まで行くと、ジョイスティックごとついてくる（逆向きにすぐ切り返せる）
 * - PC：←→/AD で移動、↑/W/Space でジャンプ、Z/J で攻撃
 */
export class StickControls {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ panel: boolean }} options
   */
  constructor(scene, { panel }) {
    this.scene = scene;
    this.cfg = CONFIG.controls;
    this.layout = panel ? joystickLayout(CONFIG) : null;
    this.enabled = true;

    this.pointerId = null; // ジョイスティックを操作中の指
    this.origin = new Phaser.Math.Vector2(); // ジョイスティックの中心（ステージの座標）
    this.knob = new Phaser.Math.Vector2(); // つまみ（指の位置）
    this.downAt = new Phaser.Math.Vector2(); // 触り始めた位置（タップ判定用）
    this.maxMove = 0; // 今回のタッチで指が動いた最大距離（タップ判定用）
    this.direction = { x: 0, jump: false }; // 今倒している向き
    this.jumpLatched = false; // 上にはじいたままか（はじいたままでは1回しか跳ばない）
    this.jumpQueued = false;
    this.attackQueued = false;
    this.flashUntil = 0; // タップで攻撃したとき、つまみを少し光らせる
    this.input = { x: 0, jump: false, attack: false };

    if (this.layout) {
      const { top, bottom, hint } = this.layout;
      addPanelBackground(scene, top, bottom);
      addText(scene, hint.x, hint.y, '倒す … 移動\n上にはじく … ジャンプ\n軽くタップ … 攻撃', {
        size: 36,
        bold: false,
        stroke: 6,
      })
        .setLineSpacing(14)
        .setAlpha(0.75)
        .setDepth(DEPTH.controls);
    }
    this.graphics = scene.add.graphics().setDepth(DEPTH.controls + 1);
    this.release();

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
    this.keys = addControlKeys(scene);

    // タブ切り替えなどで指の状態が分からなくなったら離したことにする
    scene.game.events.on(Phaser.Core.Events.BLUR, this.release, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  /**
   * 今フレームの入力。ジャンプと攻撃は1回読んだら消える。
   * @returns {{ x: number, jump: boolean, attack: boolean }} x は左右（-1, 0, 1）
   */
  read() {
    const input = this.input;
    input.x = this.direction.x;
    input.jump = this.jumpQueued;
    input.attack = this.attackQueued;
    this.jumpQueued = false;
    this.attackQueued = false;
    applyControlKeys(this.keys, input);

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

  /** 指を離した状態に戻す（操作パネルでは、ジョイスティックをいつもの場所に戻す） */
  release() {
    this.pointerId = null;
    this.direction = { x: 0, jump: false };
    this.jumpLatched = false;
    if (this.layout) {
      const { home } = this.layout;
      this.origin.set(home.x, home.y);
      this.knob.set(home.x, home.y);
    }
    this.redraw();
  }

  // ---- 指 ----

  /** 指の位置をステージの座標にする（ゲーム画面は縮小して表示していることがある） */
  toWorld(pointer) {
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  onPointerDown(pointer) {
    if (!this.enabled || this.pointerId !== null) return;
    const p = this.toWorld(pointer);
    if (this.layout && p.y < this.layout.top) return; // ゲーム画面を触っても何もしない
    this.pointerId = pointer.id;
    this.origin.set(p.x, p.y);
    this.knob.set(p.x, p.y);
    this.downAt.set(p.x, p.y);
    this.maxMove = 0;
    this.direction = { x: 0, jump: false };
    this.jumpLatched = false;
    this.redraw();
  }

  onPointerMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    const p = this.toWorld(pointer);
    const radius = this.cfg.joystickRadius;
    this.maxMove = Math.max(this.maxMove, Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y));

    let dx = p.x - this.origin.x;
    let dy = p.y - this.origin.y;
    const distance = Math.hypot(dx, dy);
    // 指がジョイスティックの外まで行ったら、ジョイスティックごと指についてくる
    if (distance > radius) {
      this.origin.x += (dx / distance) * (distance - radius);
      this.origin.y += (dy / distance) * (distance - radius);
      dx = p.x - this.origin.x;
      dy = p.y - this.origin.y;
    }
    this.knob.set(p.x, p.y);
    this.direction = stickDirection(dx, dy, this.cfg);

    // 上にはじいた瞬間にジャンプ（はじいたままでは1回だけ。少し戻すとまた跳べる）
    if (this.direction.jump && !this.jumpLatched) this.jumpQueued = true;
    if (this.direction.jump) this.jumpLatched = true;
    else if (leftJumpZone(dx, dy, this.cfg)) this.jumpLatched = false;
    this.redraw();
  }

  onPointerUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    const duration = pointer.upTime - pointer.downTime;
    if (duration <= this.cfg.tapMaxMs && this.maxMove <= this.cfg.tapMaxMove) {
      this.attackQueued = true;
      this.flashUntil = this.scene.time.now + 150;
      this.scene.time.delayedCall(160, () => this.redraw());
    }
    this.release();
  }

  // ---- 見た目 ----

  /** ジョイスティックの台・矢印（倒している向きを光らせる）・つまみを描き直す */
  redraw() {
    const g = this.graphics.clear();
    const pressed = this.pointerId !== null;
    if (!pressed && !this.layout) return; // 画面のどこでも版は、触っていないときは見せない
    const radius = this.cfg.joystickRadius;
    g.fillStyle(0xffffff, 0.08).fillCircle(this.origin.x, this.origin.y, radius);
    g.lineStyle(5, 0xffffff, 0.35).strokeCircle(this.origin.x, this.origin.y, radius);
    drawArrows(g, this.origin, radius * 0.8, pressed ? this.direction : null, 26, 0.4);
    const flashing = this.scene.time.now < this.flashUntil;
    g.fillStyle(flashing ? CONFIG.colors.attackButton : 0xffffff, flashing ? 0.9 : 0.4);
    g.fillCircle(this.knob.x, this.knob.y, radius * 0.42);
  }

  destroy() {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
  }
}
