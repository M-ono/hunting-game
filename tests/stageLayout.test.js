import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  buildStage,
  canJumpUp,
  floorAt,
  floorGaps,
  floorSegments,
  isClearOfObstacles,
  noPreyZoneAt,
  onSameLevel,
} from '../src/systems/stageLayout.js';

const stage = buildStage(CONFIG);

// テスト用の小さなステージ（設定値を変えてもテストが壊れないように）
const mini = buildStage({
  field: { x: 0, width: 1000 },
  floorThickness: 30,
  prey: { keepOutMargin: 100 },
  cage: { floor: 1, x: 100, width: 100, height: 80 },
  campfire: { floor: 1, x: 700, radius: 40 },
  floors: [
    { y: 1000 }, // 端から端まで
    { y: 700, x2: 800, holes: [{ x: 400, width: 100 }] },
  ],
  obstacles: [{ floor: 0, x: 600, w: 60, h: 60 }],
});

test('床の穴を除いた足場の切れ端', () => {
  assert.deepEqual(floorSegments(0, 1000, []), [{ x1: 0, x2: 1000 }]);
  assert.deepEqual(floorSegments(0, 1000, [{ x: 500, width: 100 }]), [
    { x1: 0, x2: 450 },
    { x1: 550, x2: 1000 },
  ]);
  assert.deepEqual(floorSegments(0, 1000, [{ x: 30, width: 100 }]), [{ x1: 80, x2: 1000 }]); // 端の穴
  assert.deepEqual(floorSegments(0, 1000, [{ x: 600, width: 100 }, { x: 200, width: 100 }]), [
    { x1: 0, x2: 150 },
    { x1: 250, x2: 550 },
    { x1: 650, x2: 1000 },
  ]);
});

test('床と障害物の形（範囲を省略すると画面の端から端まで）', () => {
  assert.deepEqual(mini.floors[0].segments, [{ x1: 0, x2: 1000 }]);
  assert.deepEqual(mini.floors[1].segments, [
    { x1: 0, x2: 350 },
    { x1: 450, x2: 800 },
  ]);
  assert.equal(mini.obstacles[0].y, 970);
  assert.equal(mini.floors[1].thickness, 30);
});

test('足元の床を見つける（穴の上・床の外では見つからない）', () => {
  assert.equal(floorAt(mini, 500, 1000).index, 0);
  assert.equal(floorAt(mini, 500, 703).index, 1);
  assert.equal(floorAt(mini, 400, 700), null); // 穴
  assert.equal(floorAt(mini, 900, 700), null); // 床の外
  assert.equal(floorAt(mini, 500, 850), null); // 段の途中
});

test('同じ段かどうか・障害物との重なり', () => {
  assert.equal(onSameLevel(1000, 980), true);
  assert.equal(onSameLevel(1000, 700), false);
  assert.equal(isClearOfObstacles(mini, 0, 600, 30), false);
  assert.equal(isClearOfObstacles(mini, 0, 700, 30), true);
  assert.equal(isClearOfObstacles(mini, 1, 600, 30), true);
});

test('床のすき間（穴と、画面の端と床の間）', () => {
  assert.deepEqual(floorGaps(mini.floors[0], 0, 1000), []);
  assert.deepEqual(floorGaps(mini.floors[1], 0, 1000), [
    { x1: 350, x2: 450 },
    { x1: 800, x2: 1000 },
  ]);
});

test('一段上に登れるか（床は下から通れないので、穴を通る）', () => {
  const [lower, upper] = mini.floors; // 上の床には 100px の穴と、右端に 200px のすき間がある
  const base = { bodyWidth: 56, fieldX1: 0, fieldX2: 1000 };
  assert.equal(canJumpUp(lower, upper, { ...base, jumpHeight: 350 }), true); // 右端の 200px のすき間を通れる
  assert.equal(canJumpUp(lower, upper, { ...base, jumpHeight: 310 }), false); // 高さが足りない
  const holeOnly = { y: 700, segments: [{ x1: 0, x2: 450 }, { x1: 550, x2: 1000 }] }; // 100px の穴だけ
  assert.equal(canJumpUp(lower, holeOnly, { ...base, jumpHeight: 350 }), false); // 穴が狭い（56 + 60 > 100）
  assert.equal(canJumpUp(lower, holeOnly, { ...base, jumpHeight: 350, margin: 20 }), true);
  const noGround = { y: 1000, segments: [{ x1: 0, x2: 440 }, { x1: 560, x2: 1000 }] }; // 穴の真下も穴
  assert.equal(canJumpUp(noGround, holeOnly, { ...base, jumpHeight: 350, margin: 20 }), false);
});

test('檻と焚き火のまわりは獲物が入れない', () => {
  assert.ok(noPreyZoneAt(mini, 100, 700)); // 檻の真下の床
  assert.ok(noPreyZoneAt(mini, 240, 700)); // 檻の端から90px
  assert.equal(noPreyZoneAt(mini, 300, 700), null); // 檻の端から150px
  assert.ok(noPreyZoneAt(mini, 700, 700)); // 焚き火
  assert.equal(noPreyZoneAt(mini, 100, 1000), null); // 下の段は関係ない
});

test('設定のステージ：どの床からも、穴を通って一段上の床に乗れる（一番上まで行ける）', () => {
  const floors = [...stage.floors].sort((a, b) => b.y - a.y); // 下から順
  const options = {
    jumpHeight: CONFIG.player.jumpHeight,
    bodyWidth: CONFIG.player.width,
    fieldX1: CONFIG.field.x,
    fieldX2: CONFIG.field.x + CONFIG.field.width,
  };
  for (let i = 0; i + 1 < floors.length; i++) {
    assert.ok(
      canJumpUp(floors[i], floors[i + 1], options),
      `床${floors[i].index} → 床${floors[i + 1].index} に登れない（間隔 ${floors[i].y - floors[i + 1].y}px、ジャンプ ${CONFIG.player.jumpHeight}px、穴の幅を確認）`,
    );
  }
  assert.equal(floors.at(-1).index, CONFIG.cage.floor, '檻は一番上の床にある');
});

test('設定のステージ：地面以外のどの床にも、飛び降りられる穴がある', () => {
  const lowest = Math.max(...stage.floors.map((f) => f.y));
  const right = CONFIG.field.x + CONFIG.field.width;
  for (const floor of stage.floors) {
    if (floor.y === lowest) continue;
    const widths = floorGaps(floor, CONFIG.field.x, right).map((gap) => gap.x2 - gap.x1);
    assert.ok(
      widths.some((width) => width >= CONFIG.player.width + 40),
      `床${floor.index}にプレイヤーが落ちられる幅の穴がない`,
    );
  }
});

test('設定のステージ：上下の段の穴が横に重ならない（穴から落ちると必ず一段下に着く）', () => {
  const floors = [...stage.floors].sort((a, b) => b.y - a.y); // 下から順
  const right = CONFIG.field.x + CONFIG.field.width;
  for (let i = 1; i + 1 < floors.length; i++) {
    const lowerHoles = floorGaps(floors[i], CONFIG.field.x, right);
    const upperHoles = floorGaps(floors[i + 1], CONFIG.field.x, right);
    for (const a of upperHoles) {
      for (const b of lowerHoles) {
        assert.ok(
          Math.min(a.x2, b.x2) <= Math.max(a.x1, b.x1),
          `床${floors[i + 1].index}の穴 ${a.x1}〜${a.x2} と、床${floors[i].index}の穴 ${b.x1}〜${b.x2} が重なっている`,
        );
      }
    }
  }
});

test('設定のステージ：穴のふちの足場が狭すぎない（獲物やプレイヤーが乗れる）', () => {
  for (const floor of stage.floors) {
    for (const segment of floor.segments) {
      assert.ok(segment.x2 - segment.x1 >= 120, `床${floor.index}の足場 ${segment.x1}〜${segment.x2} が狭すぎる`);
    }
  }
});

test('設定のステージ：出発地点は一番上の床の檻のそば（穴の上ではない）', () => {
  const { startFloor, startX, width } = CONFIG.player;
  assert.equal(startFloor, CONFIG.cage.floor, '檻と同じ床から出発する');
  const floor = stage.floors[startFloor];
  assert.ok(floorAt(stage, startX - width / 2, floor.y) && floorAt(stage, startX + width / 2, floor.y), '出発地点が穴にかかっている');
  assert.ok(Math.abs(startX - CONFIG.cage.x) <= 250, '出発地点が檻から離れすぎている');
});

test('設定のステージ：檻と焚き火は穴の上に置かれていない', () => {
  const top = stage.floors[CONFIG.cage.floor];
  const onFloor = (x1, x2) => top.segments.some((segment) => x1 >= segment.x1 && x2 <= segment.x2);
  const { cage, campfire } = CONFIG;
  assert.ok(onFloor(cage.x - cage.width / 2, cage.x + cage.width / 2), '檻が穴にかかっている');
  assert.ok(onFloor(campfire.x - campfire.radius, campfire.x + campfire.radius), '焚き火が穴にかかっている');
});

test('設定のステージ：獲物が出る床のどこかに、入れない範囲の外がある', () => {
  for (const floorIndex of CONFIG.prey.spawnFloors) {
    const floor = stage.floors[floorIndex];
    let free = 0;
    for (let x = floor.x1 + 40; x <= floor.x2 - 40; x += 20) {
      if (
        floorAt(stage, x, floor.y) &&
        !noPreyZoneAt(stage, x, floor.y) &&
        isClearOfObstacles(stage, floorIndex, x, CONFIG.prey.width / 2)
      ) {
        free++;
      }
    }
    assert.ok(free > 5, `床${floorIndex}に獲物の出られる場所がない`);
  }
});
