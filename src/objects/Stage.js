import { CONFIG } from '../config.js';
import { DEPTH } from '../constants.js';

/**
 * 床（鉄骨）・はしご・障害物を描き、当たり判定を作る。
 * @param {Phaser.Scene} scene
 * @param {ReturnType<import('../systems/stageLayout.js').buildStage>} stage
 * @returns {{ floors: Phaser.Physics.Arcade.StaticGroup, obstacles: Phaser.Physics.Arcade.StaticGroup, preyFences: Phaser.Physics.Arcade.StaticGroup }}
 */
export function createStageObjects(scene, stage) {
  const { colors, field } = CONFIG;

  scene.add
    .rectangle(field.x + field.width / 2, field.y + field.height / 2, field.width, field.height, colors.field)
    .setDepth(DEPTH.field);

  // はしご（床の後ろに描く）
  const half = CONFIG.ladder.width / 2;
  const ladders = scene.add.graphics().setDepth(DEPTH.stage - 2);
  for (const ladder of stage.ladders) {
    ladders.lineStyle(8, colors.ladder, 1);
    ladders.lineBetween(ladder.x - half, ladder.topY, ladder.x - half, ladder.bottomY);
    ladders.lineBetween(ladder.x + half, ladder.topY, ladder.x + half, ladder.bottomY);
    ladders.lineStyle(6, colors.ladder, 1);
    for (let y = ladder.bottomY - 28; y > ladder.topY; y -= 40) {
      ladders.lineBetween(ladder.x - half, y, ladder.x + half, y);
    }
  }

  // 床（鉄骨）。上からだけ乗れて、下からはすり抜けられる
  const floors = scene.physics.add.staticGroup();
  const pattern = scene.add.graphics().setDepth(DEPTH.stage + 1);
  for (const floor of stage.floors) {
    const width = floor.x2 - floor.x1;
    const girder = scene.add
      .rectangle(floor.x1 + width / 2, floor.y + floor.thickness / 2, width, floor.thickness, colors.girder)
      .setDepth(DEPTH.stage);
    floors.add(girder);
    const check = girder.body.checkCollision;
    check.down = false;
    check.left = false;
    check.right = false;

    // 鉄骨の模様
    const band = Math.min(floor.thickness, 36);
    pattern.lineStyle(4, colors.girderEdge, 1);
    pattern.strokeRect(floor.x1, floor.y, width, band);
    for (let x = floor.x1; x + 36 <= floor.x2; x += 36) {
      pattern.lineBetween(x, floor.y + band, x + 18, floor.y);
      pattern.lineBetween(x + 18, floor.y, x + 36, floor.y + band);
    }
  }

  // 障害物（ジャンプで飛び越える岩）
  const obstacles = scene.physics.add.staticGroup();
  for (const o of stage.obstacles) {
    const rock = scene.add
      .rectangle(o.x, o.y, o.w, o.h, colors.obstacle)
      .setStrokeStyle(6, colors.obstacleEdge)
      .setDepth(DEPTH.stage + 2);
    obstacles.add(rock);
  }

  // 檻・焚き火のまわりの見えない柵。獲物だけがぶつかる（処理落ちしても獲物が入り込まないように）
  const preyFences = scene.physics.add.staticGroup();
  for (const zone of stage.noPreyZones) {
    const bottom = zone.y2 - 10; // 床の上面
    preyFences.add(scene.add.zone((zone.x1 + zone.x2) / 2, (zone.y1 + bottom) / 2, zone.x2 - zone.x1, bottom - zone.y1));
  }

  return { floors, obstacles, preyFences };
}
