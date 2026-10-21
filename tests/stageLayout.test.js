import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  buildStage,
  canJumpUp,
  checkCourse,
  floorAt,
  floorGaps,
  floorSegments,
  isClearOfObstacles,
  noPreyZoneAt,
  onSameLevel,
  randomCourse,
} from '../src/systems/stageLayout.js';

const stage = buildStage(CONFIG);

// テスト用の小さなステージ（設定値を変えてもテストが壊れないように）
const mini = buildStage({
  field: { x: 0, width: 1000 },
  floorThickness: 30,
  prey: { keepOutMargin: 100 },
  guild: { floor: 1, x: 100, width: 100, height: 80 },
  diner: { floor: 1, x: 700, width: 80, height: 80 },
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

test('ギルドと食堂のまわりは獲物が入れない', () => {
  assert.ok(noPreyZoneAt(mini, 100, 700)); // ギルドの真下の床
  assert.ok(noPreyZoneAt(mini, 240, 700)); // ギルドの端から90px
  assert.equal(noPreyZoneAt(mini, 300, 700), null); // ギルドの端から150px
  assert.ok(noPreyZoneAt(mini, 700, 700)); // 食堂
  assert.ok(noPreyZoneAt(mini, 830, 700)); // 食堂の端から90px
  assert.equal(noPreyZoneAt(mini, 100, 1000), null); // 下の段は関係ない
});

// 決まった種（seed）から毎回同じ並びの乱数を作る（ランダムなコースのテストを毎回同じ結果にするため）
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const courseStage = (course) => buildStage({ ...CONFIG, ...course });

test('設定の配置のコースは遊べる（登れる・一段下に落ちる・足場・岩・獲物の出る場所）', () => {
  assert.deepEqual(checkCourse(stage, CONFIG), []);
  const top = [...stage.floors].sort((a, b) => a.y - b.y)[0];
  assert.equal(top.index, CONFIG.guild.floor, 'ギルドは一番上の床にある');
  assert.equal(top.index, CONFIG.diner.floor, '食堂は一番上の床にある');
});

test('遊べないコースは checkCourse で見つかる', () => {
  const floorsWith = (index, holes) => CONFIG.floors.map((floor, i) => (i === index ? { ...floor, holes } : floor));
  // 上下の段の穴が重なる（2段続けて落ちてしまう）
  const overlap = checkCourse(courseStage({ floors: floorsWith(3, [{ x: 540, width: 260 }]) }), CONFIG);
  assert.ok(overlap.some((problem) => problem.includes('重なっている')), overlap.join(' / '));
  // 穴が狭くて登れない
  const narrow = checkCourse(courseStage({ floors: floorsWith(2, [{ x: 280, width: 80 }]) }), CONFIG);
  assert.ok(narrow.some((problem) => problem.includes('登れない')), narrow.join(' / '));
  // 岩が一段上の穴の真下にある
  const rock = checkCourse(courseStage({ obstacles: [{ floor: 3, x: 540, w: 70, h: 70 }] }), CONFIG);
  assert.ok(rock.some((problem) => problem.includes('真下')), rock.join(' / '));
});

test('ランダムなコース：1000通りすべて遊べて、一番上の床・地面・床の高さは変わらない', () => {
  const random = seededRandom(1);
  const top = CONFIG.floors.length - 1;
  const [minRocks, maxRocks] = CONFIG.course.rocksPerFloor;
  for (let i = 0; i < 1000; i++) {
    const course = randomCourse(CONFIG, random);
    assert.ok(course, `${i}回目：遊べるコースが作れなかった`);
    const randomStage = courseStage(course);
    assert.deepEqual(checkCourse(randomStage, CONFIG), [], `${i}回目：${JSON.stringify(course)}`);
    assert.deepEqual(randomStage.floors[top], stage.floors[top], '一番上の床が変わった');
    assert.deepEqual(randomStage.floors[0].segments, stage.floors[0].segments, '地面に穴があいた');
    assert.deepEqual(
      course.floors.map((floor) => floor.y),
      CONFIG.floors.map((floor) => floor.y),
      '床の高さが変わった',
    );
    for (let floor = 0; floor < top; floor++) {
      const rocks = course.obstacles.filter((obstacle) => obstacle.floor === floor).length;
      assert.ok(rocks >= minRocks && rocks <= maxRocks, `床${floor}の岩が${rocks}個`);
    }
  }
});

test('ランダムなコース：毎回同じにはならない（穴の位置がいろいろ出る）', () => {
  const random = seededRandom(2);
  const layouts = new Set();
  const holeXs = CONFIG.floors.map(() => new Set());
  for (let i = 0; i < 200; i++) {
    const course = randomCourse(CONFIG, random);
    layouts.add(JSON.stringify(course));
    course.floors.forEach((floor, index) => (floor.holes ?? []).forEach((hole) => holeXs[index].add(hole.x)));
  }
  assert.ok(layouts.size > 150, `コースが${layouts.size}通りしか出ない`);
  for (let index = 1; index < CONFIG.floors.length - 1; index++) {
    assert.ok(holeXs[index].size >= 4, `床${index}の穴の位置が${holeXs[index].size}通りしか出ない`);
  }
});

test('設定のステージ：出発地点は一番上の床のギルドのそば（穴の上ではない）', () => {
  const { startFloor, startX, width } = CONFIG.player;
  assert.equal(startFloor, CONFIG.guild.floor, 'ギルドと同じ床から出発する');
  const floor = stage.floors[startFloor];
  assert.ok(floorAt(stage, startX - width / 2, floor.y) && floorAt(stage, startX + width / 2, floor.y), '出発地点が穴にかかっている');
  assert.ok(Math.abs(startX - CONFIG.guild.x) <= 250, '出発地点がギルドから離れすぎている');
});

test('設定のステージ：ギルドと食堂は穴の上に置かれていない', () => {
  const top = stage.floors[CONFIG.guild.floor];
  const onFloor = (x1, x2) => top.segments.some((segment) => x1 >= segment.x1 && x2 <= segment.x2);
  for (const [name, building] of [['ギルド', CONFIG.guild], ['食堂', CONFIG.diner]]) {
    assert.ok(onFloor(building.x - building.width / 2, building.x + building.width / 2), `${name}が穴にかかっている`);
  }
});

test('設定の獲物：深い段ほど高く売れて、体も大きい', () => {
  const byDepth = [...CONFIG.prey.types].sort((a, b) => b.floor - a.floor); // 上の段から順
  for (let i = 1; i < byDepth.length; i++) {
    const [upper, lower] = [byDepth[i - 1], byDepth[i]];
    assert.ok(lower.floor < upper.floor, `床${lower.floor}に2種類の獲物がいる`);
    assert.ok(lower.price > upper.price, `床${lower.floor}の獲物が床${upper.floor}の獲物より高くない`);
    assert.ok(lower.width > upper.width && lower.height > upper.height, `床${lower.floor}の獲物が床${upper.floor}の獲物より大きくない`);
  }
  assert.equal(new Set(CONFIG.prey.types.map((type) => type.color)).size, CONFIG.prey.types.length, '同じ色の獲物がいる');
});

test('設定の獲物：ギルドのある一番上の床には出ない', () => {
  for (const type of CONFIG.prey.types) {
    assert.ok(stage.floors[type.floor], `床${type.floor}がない`);
    assert.notEqual(type.floor, CONFIG.guild.floor, '一番上の床に獲物が出る');
  }
});
