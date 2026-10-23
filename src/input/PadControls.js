import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';
import { addText } from '../ui/text.js';
import { addControlKeys, applyControlKeys } from './keyboard.js';
import { onPadSide, padDirection, padLayout } from './padLayout.js';

/**
 * 固定の操作パネル（controls.mode: 'pad'）。ゲーム画面の下に置く
 * - 十字キー（右下）：◀ ▶ で移動、▲ でジャンプ、斜め上で移動しながらジャンプ。
 *   触った位置で向きが決まる（指をずらさなくてよい）。上を触ったままでは1回だけ跳ぶ
 * - 攻撃ボタン（十字キーの左）：押すと攻撃。押したままなら連続で攻撃
 * - パネルの十字キー側を触ると十字キー、反対側は攻撃ボタンとして効く（多少外れて触っても効く）。
 *   触り始めた側の操作が、指を離すまで続く（十字キーから指がずれても攻撃にならない）
 * - ゲーム画面を触っても何も起きない（うっかり触っても操作にならない）
 * - 2本の指で、十字キーと攻撃ボタンを同時に押せる
 * - PC：←→/AD で移動、↑/W/Space でジャンプ、Z/J で攻撃
 */
export class PadControls {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.cfg = CONFIG.controls;
    this.layout = padLayout(CONFIG);
    this.enabled = true;

    this.padPointerId = null; // 十字キーを押している指
    this.attackPointerId = null; // 攻撃ボタンを押している指
    this.direction = { x: 0, jump: false }; // 十字キーの今の向き
    this.knob = null; // 十字キーを押している位置（見た目用）
    this.jumpQueued = false;
    this.attackQueued = false;
    this.input = { x: 0, jump: false, attack: false };

    this.createPanel();
    this.redraw();

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
   * 今フレームの入力。ジャンプは1回読んだら消える。攻撃ボタンは押している間ずっと攻撃（間隔は攻撃側で決まる）。
   * @returns {{ x: number, jump: boolean, attack: boolean }} x は左右（-1, 0, 1）
   */
  read() {
    const input = this.input;
    input.x = this.direction.x;
    input.jump = this.jumpQueued;
    input.attack = this.attackQueued || this.attackPointerId !== null;
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

  /** 指を離した状態に戻す */
  release() {
    this.padPointerId = null;
    this.attackPointerId = null;
    this.direction = { x: 0, jump: false };
    this.knob = null;
    this.redraw();
  }

  // ---- 指 ----

  /** 指の位置をステージの座標にする（ゲーム画面は縮小して表示していることがある） */
  toWorld(pointer) {
    return this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  onPointerDown(pointer) {
    if (!this.enabled) return;
    const p = this.toWorld(pointer);
    if (p.y < this.layout.zoneTop) return; // ゲーム画面を触っても何もしない
    if (onPadSide(this.layout, p.x)) {
      if (this.padPointerId !== null) return;
      this.padPointerId = pointer.id;
      this.updatePad(p);
    } else if (p.y >= this.layout.top) {
      if (this.attackPointerId !== null) return;
      this.attackPointerId = pointer.id;
      this.attackQueued = true; // すぐ離しても1回は攻撃する
      this.redraw();
    }
  }

  onPointerMove(pointer) {
    if (pointer.id === this.padPointerId) this.updatePad(this.toWorld(pointer));
  }

  onPointerUp(pointer) {
    if (pointer.id === this.padPointerId) {
      this.padPointerId = null;
      this.direction = { x: 0, jump: false };
      this.knob = null;
      this.redraw();
    }
    if (pointer.id === this.attackPointerId) {
      this.attackPointerId = null;
      this.redraw();
    }
  }

  /** 十字キーの向きを決める。上（ジャンプ）に入った瞬間に1回だけ跳ぶ */
  updatePad(p) {
    const { pad } = this.layout;
    const dx = p.x - pad.x;
    const dy = p.y - pad.y;
    const next = padDirection(dx, dy, this.cfg);
    if (next.jump && !this.direction.jump) this.jumpQueued = true;
    this.direction = next;
    const distance = Math.hypot(dx, dy);
    const k = distance > pad.radius ? pad.radius / distance : 1;
    this.knob = { x: pad.x + dx * k, y: pad.y + dy * k };
    this.redraw();
  }

  // ---- 見た目 ----

  createPanel() {
    const scene = this.scene;
    const { width } = CONFIG.screen;
    const { top, bottom, pad, attack } = this.layout;
    const depth = DEPTH.controls;
    // パネルの背景。ゲーム画面を縮小して左右や下に余白が見えても切れないよう、大きめに敷く
    const extra = 1000;
    scene.add
      .rectangle(width / 2, top + (bottom - top + extra) / 2, width * 3, bottom - top + extra, CONFIG.colors.hudBand)
      .setDepth(depth - 1);
    scene.add.rectangle(width / 2, top, width * 3, 4, 0xffffff, 0.15).setDepth(depth - 1);

    scene.add.circle(pad.x, pad.y, pad.radius, 0xffffff, 0.06).setStrokeStyle(5, 0xffffff, 0.3).setDepth(depth);
    this.attackButton = scene.add
      .circle(attack.x, attack.y, attack.radius, CONFIG.colors.attackButton, 0.3)
      .setStrokeStyle(6, CONFIG.colors.attackButton, 0.9)
      .setDepth(depth);
    addText(scene, attack.x, attack.y, '攻撃', { size: 48, stroke: 6 }).setDepth(depth + 1);
    this.graphics = scene.add.graphics().setDepth(depth + 1);
  }

  /** 十字キーの矢印（押している向きを光らせる）・指の位置・攻撃ボタンの押し込みを描き直す */
  redraw() {
    const g = this.graphics.clear();
    const { pad } = this.layout;
    const { x, jump } = this.direction;
    const pressed = this.padPointerId !== null;
    // deg の向きの矢印（0 = 右、90 = 上）
    const arrow = (deg, size, lit) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = -Math.sin(a);
      const cx = pad.x + ux * pad.radius * 0.62;
      const cy = pad.y + uy * pad.radius * 0.62;
      g.fillStyle(lit ? CONFIG.colors.controlLit : 0xffffff, lit ? 1 : 0.55);
      g.fillTriangle(
        cx + ux * size,
        cy + uy * size,
        cx - ux * size * 0.6 - uy * size * 0.85,
        cy - uy * size * 0.6 + ux * size * 0.85,
        cx - ux * size * 0.6 + uy * size * 0.85,
        cy - uy * size * 0.6 - ux * size * 0.85,
      );
    };
    arrow(0, 36, pressed && x > 0 && !jump);
    arrow(180, 36, pressed && x < 0 && !jump);
    arrow(90, 36, pressed && jump && x === 0);
    arrow(45, 24, pressed && jump && x > 0);
    arrow(135, 24, pressed && jump && x < 0);
    if (this.knob) g.fillStyle(0xffffff, 0.3).fillCircle(this.knob.x, this.knob.y, 44);
    this.attackButton.setFillStyle(CONFIG.colors.attackButton, this.attackPointerId !== null ? 0.75 : 0.3);
  }

  destroy() {
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
  }
}
