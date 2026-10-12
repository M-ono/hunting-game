import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  buildStage,
  floorAt,
  isClearOfObstacles,
  ladderToClimbDown,
  ladderToClimbUp,
  noPreyZoneAt,
  onSameLevel,
} from '../src/systems/stageLayout.js';

const stage = buildStage(CONFIG);
const grab = CONFIG.ladder.grabDistance;

// テスト用の小さなステージ（設定値を変えてもテストが壊れないように）
const mini = buildStage({
  floorThickness: 30,
  prey: { keepOutMargin: 100 },
  cage: { floor: 1, x: 100, width: 100, height: 80 },
  campfire: { floor: 1, x: 700, radius: 40 },
  floors: [
    { y: 1000, x1: 0, x2: 1000 },
    { y: 700, x1: 0, x2: 800 },
  ],
  ladders: [{ x: 300, from: 0, to: 1 }],
  obstacles: [{ floor: 0, x: 600, w: 60, h: 60 }],
});

test('はしごの上端・下端は、つながる床の高さになる', () => {
  assert.deepEqual(mini.ladders[0], { x: 300, from: 0, to: 1, topY: 700, bottomY: 1000 });
  assert.equal(mini.obstacles[0].y, 970);
  assert.equal(mini.floors[1].thickness, 30);
});

test('足元の床を見つける（床の切れ目では見つからない）', () => {
  assert.equal(floorAt(mini, 500, 1000).index, 0);
  assert.equal(floorAt(mini, 500, 703).index, 1);
  assert.equal(floorAt(mini, 900, 700), null);
  assert.equal(floorAt(mini, 500, 850), null);
});

test('はしごの下にいれば登れ、上端に立っていれば降りられる', () => {
  assert.equal(ladderToClimbUp(mini, 310, 1000, 32)?.x, 300);
  assert.equal(ladderToClimbUp(mini, 360, 1000, 32), null); // 離れている
  assert.equal(ladderToClimbUp(mini, 300, 700, 32), null); // もう上にいる
  assert.equal(ladderToClimbDown(mini, 295, 700, 32)?.x, 300);
  assert.equal(ladderToClimbDown(mini, 300, 1000, 32), null);
});

test('同じ段かどうか・障害物との重なり', () => {
  assert.equal(onSameLevel(1000, 980), true);
  assert.equal(onSameLevel(1000, 700), false);
  assert.equal(isClearOfObstacles(mini, 0, 600, 30), false);
  assert.equal(isClearOfObstacles(mini, 0, 700, 30), true);
  assert.equal(isClearOfObstacles(mini, 1, 600, 30), true);
});

test('設定のステージ：はしごの両端に床があり、障害物と重ならない', () => {
  for (const ladder of stage.ladders) {
    assert.ok(floorAt(stage, ladder.x, ladder.topY), `はしご x=${ladder.x} の上に床がない`);
    assert.ok(floorAt(stage, ladder.x, ladder.bottomY), `はしご x=${ladder.x} の下に床がない`);
    assert.ok(ladder.topY < ladder.bottomY);
    for (const floorIndex of [ladder.from, ladder.to]) {
      assert.ok(isClearOfObstacles(stage, floorIndex, ladder.x, CONFIG.ladder.width / 2), `はしご x=${ladder.x} が障害物と重なる`);
    }
  }
});

test('設定のステージ：一番上の床まではしごでたどり着ける', () => {
  const top = stage.floors.length - 1;
  const reachable = new Set([CONFIG.player.startFloor]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const ladder of stage.ladders) {
      if (reachable.has(ladder.from) && !reachable.has(ladder.to)) {
        reachable.add(ladder.to);
        grew = true;
      }
    }
  }
  assert.ok(reachable.has(top));
  assert.ok(grab > 0);
});

test('檻と焚き火のまわりは獲物が入れない', () => {
  assert.ok(noPreyZoneAt(mini, 100, 700)); // 檻の真下の床
  assert.ok(noPreyZoneAt(mini, 240, 700)); // 檻の端から90px
  assert.equal(noPreyZoneAt(mini, 300, 700), null); // 檻の端から150px
  assert.ok(noPreyZoneAt(mini, 700, 700)); // 焚き火
  assert.equal(noPreyZoneAt(mini, 100, 1000), null); // 下の段は関係ない
});

test('設定のステージ：獲物が出る床のどこかに、入れない範囲の外がある', () => {
  for (const floorIndex of CONFIG.prey.spawnFloors) {
    const floor = stage.floors[floorIndex];
    let free = 0;
    for (let x = floor.x1 + 40; x <= floor.x2 - 40; x += 20) {
      if (!noPreyZoneAt(stage, x, floor.y) && isClearOfObstacles(stage, floorIndex, x, CONFIG.prey.width / 2)) free++;
    }
    assert.ok(free > 5, `床${floorIndex}に獲物の出られる場所がない`);
  }
});
