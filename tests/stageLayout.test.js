import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  buildStage,
  canJumpUp,
  floorAt,
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

test('ジャンプで一段上に届くか（高さと、足場の重なり）', () => {
  const [lower, upper] = mini.floors;
  assert.equal(canJumpUp(lower, upper, 350), true);
  assert.equal(canJumpUp(lower, upper, 310), false); // 高さが足りない
  const narrow = { y: 700, segments: [{ x1: 950, x2: 1080 }] };
  assert.equal(canJumpUp(lower, narrow, 350), false); // 足場の重なりが狭い
});

test('檻と焚き火のまわりは獲物が入れない', () => {
  assert.ok(noPreyZoneAt(mini, 100, 700)); // 檻の真下の床
  assert.ok(noPreyZoneAt(mini, 240, 700)); // 檻の端から90px
  assert.equal(noPreyZoneAt(mini, 300, 700), null); // 檻の端から150px
  assert.ok(noPreyZoneAt(mini, 700, 700)); // 焚き火
  assert.equal(noPreyZoneAt(mini, 100, 1000), null); // 下の段は関係ない
});

test('設定のステージ：どの床からも、ジャンプで一段上の床に乗れる（一番上まで行ける）', () => {
  const floors = [...stage.floors].sort((a, b) => b.y - a.y); // 下から順
  for (let i = 0; i + 1 < floors.length; i++) {
    assert.ok(
      canJumpUp(floors[i], floors[i + 1], CONFIG.player.jumpHeight),
      `床${floors[i].index} → 床${floors[i + 1].index} にジャンプで届かない（間隔 ${floors[i].y - floors[i + 1].y}px、ジャンプ ${CONFIG.player.jumpHeight}px）`,
    );
  }
  assert.equal(floors.at(-1).index, CONFIG.cage.floor, '檻は一番上の床にある');
});

test('設定のステージ：地面以外のどの床にも、飛び降りられる穴がある', () => {
  const lowest = Math.max(...stage.floors.map((f) => f.y));
  for (const floor of stage.floors) {
    if (floor.y === lowest) continue;
    const gaps = [];
    if (floor.segments[0].x1 > CONFIG.field.x) gaps.push(floor.segments[0].x1 - CONFIG.field.x);
    for (let i = 0; i + 1 < floor.segments.length; i++) gaps.push(floor.segments[i + 1].x1 - floor.segments[i].x2);
    const right = CONFIG.field.x + CONFIG.field.width;
    if (floor.segments.at(-1).x2 < right) gaps.push(right - floor.segments.at(-1).x2);
    assert.ok(
      gaps.some((gap) => gap >= CONFIG.player.width + 40),
      `床${floor.index}にプレイヤーが落ちられる幅の穴がない`,
    );
  }
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
