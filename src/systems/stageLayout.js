// ステージ（床・床の穴・障害物・獲物が入れない範囲）の形と、位置の判定。床は下から通り抜けられず、穴を通って上下に移動する。
// コースが遊べるかの判定（checkCourse）と、一番上以外のランダムな配置（randomCourse）もここ。
// Phaser に依存しないので、node --test で単体テストできる。

/**
 * 床の範囲 x1〜x2 から穴を除いた、足場の切れ端（左から順）を返す。
 * @param {number} x1
 * @param {number} x2
 * @param {{ x: number, width: number }[]} holes 穴（x は中心）
 */
export function floorSegments(x1, x2, holes = []) {
  const sorted = [...holes].sort((a, b) => a.x - b.x);
  const segments = [];
  let left = x1;
  for (const hole of sorted) {
    const holeLeft = Math.max(x1, hole.x - hole.width / 2);
    const holeRight = Math.min(x2, hole.x + hole.width / 2);
    if (holeLeft > left) segments.push({ x1: left, x2: holeLeft });
    left = Math.max(left, holeRight);
  }
  if (x2 > left) segments.push({ x1: left, x2 });
  return segments;
}

/**
 * 設定からステージの形を作る。
 * @param {typeof import('../config.js').CONFIG} config
 */
export function buildStage(config) {
  const fieldX1 = config.field.x;
  const fieldX2 = config.field.x + config.field.width;
  const floors = config.floors.map((floor, index) => {
    const x1 = floor.x1 ?? fieldX1;
    const x2 = floor.x2 ?? fieldX2;
    const holes = (floor.holes ?? []).map((hole) => ({ x: hole.x, width: hole.width }));
    return {
      index,
      y: floor.y, // 床の上面
      x1,
      x2,
      thickness: floor.thickness ?? config.floorThickness,
      holes,
      segments: floorSegments(x1, x2, holes),
    };
  });
  const obstacles = config.obstacles.map((obstacle) => ({
    floor: obstacle.floor,
    x: obstacle.x,
    y: floors[obstacle.floor].y - obstacle.h / 2, // 中心
    w: obstacle.w,
    h: obstacle.h,
  }));
  // 獲物が入れない範囲（ギルドと食堂のまわり）。y2 は床の上面より少し下まで
  const margin = config.prey.keepOutMargin;
  const noPreyZones = [config.guild, config.diner].map((building) => {
    const floorY = floors[building.floor].y;
    return {
      x1: building.x - building.width / 2 - margin,
      x2: building.x + building.width / 2 + margin,
      y1: floorY - building.height - margin,
      y2: floorY + 10,
    };
  });
  return { floors, obstacles, noPreyZones };
}

/** 獲物が入れない範囲に入っているか。入っていればその範囲を返す */
export function noPreyZoneAt(stage, x, feetY) {
  return stage.noPreyZones.find((z) => x >= z.x1 && x <= z.x2 && feetY >= z.y1 && feetY <= z.y2) ?? null;
}

/** 足元（feetY）にある床。穴の上や床の外なら null */
export function floorAt(stage, x, feetY, tolerance = 8) {
  return (
    stage.floors.find(
      (f) => Math.abs(feetY - f.y) <= tolerance && f.segments.some((segment) => x >= segment.x1 && x <= segment.x2),
    ) ?? null
  );
}

/** 同じ段にいるとみなせるか（足の高さの差で判定） */
export function onSameLevel(feetA, feetB, tolerance = 40) {
  return Math.abs(feetA - feetB) <= tolerance;
}

/** その床の上で、幅 halfWidth×2 のものを置いても障害物と重ならないか */
export function isClearOfObstacles(stage, floorIndex, x, halfWidth) {
  return !stage.obstacles.some((o) => o.floor === floorIndex && Math.abs(x - o.x) < o.w / 2 + halfWidth);
}

/** 床のすき間（穴と、画面の端と床の間）を左から順に返す */
export function floorGaps(floor, fieldX1, fieldX2) {
  const gaps = [];
  let left = fieldX1;
  for (const segment of floor.segments) {
    if (segment.x1 > left) gaps.push({ x1: left, x2: segment.x1 });
    left = Math.max(left, segment.x2);
  }
  if (fieldX2 > left) gaps.push({ x1: left, x2: fieldX2 });
  return gaps;
}

/**
 * 床 lower から一段上の床 upper へ登れるか。床は下から通り抜けられないので、穴を通ってジャンプする。
 * - 高さ：ジャンプで upper の上面より clearance 以上高く上がれる
 * - 穴：upper に「体の幅 + margin」以上のすき間があり、その真下の lower に体の幅以上の足場がある
 */
export function canJumpUp(lower, upper, { jumpHeight, bodyWidth, fieldX1, fieldX2, clearance = 20, margin = 60 }) {
  const rise = lower.y - upper.y;
  if (rise <= 0 || rise + clearance > jumpHeight) return false;
  return floorGaps(upper, fieldX1, fieldX2).some((gap) => {
    if (gap.x2 - gap.x1 < bodyWidth + margin) return false;
    const ground = Math.max(
      0,
      ...lower.segments.map((segment) => Math.min(segment.x2, gap.x2) - Math.max(segment.x1, gap.x1)),
    );
    return ground >= bodyWidth;
  });
}

/**
 * コースが遊べるかを調べる。問題があれば説明の一覧を返す（遊べれば空の配列）。設定の配置にもランダムな配置にも使う。
 * - どの床からも、穴を通って一段上の床に乗れる（一番上まで行ける）
 * - 地面以外のどの床にも、飛び降りられる穴がある
 * - 上下の段の穴が横に重ならない（穴から落ちると必ず一段下に着く）
 * - 足場が狭すぎない（course.minFooting 以上）
 * - 岩は穴にかからず、一段上の穴の真下（落ちたところ・跳び上がるところ）にもない
 * - 獲物の種類ごとに、出られる場所がある
 * @param {ReturnType<typeof buildStage>} stage
 * @param {typeof import('../config.js').CONFIG} config
 * @returns {string[]}
 */
export function checkCourse(stage, config) {
  const problems = [];
  const fieldX1 = config.field.x;
  const fieldX2 = config.field.x + config.field.width;
  const { width: bodyWidth, jumpHeight } = config.player;
  const gaps = (floor) => floorGaps(floor, fieldX1, fieldX2);
  const overlaps = (a, b) => Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1);
  const bottomUp = [...stage.floors].sort((a, b) => b.y - a.y); // 下から順（先頭が地面）
  const above = (floor) => bottomUp[bottomUp.indexOf(floor) + 1];

  bottomUp.forEach((floor, i) => {
    const upper = above(floor);
    if (upper && !canJumpUp(floor, upper, { jumpHeight, bodyWidth, fieldX1, fieldX2 })) {
      problems.push(`床${floor.index} → 床${upper.index} に登れない（間隔 ${floor.y - upper.y}px、ジャンプ ${jumpHeight}px、穴の幅と真下の足場を確認）`);
    }
    if (i > 0 && !gaps(floor).some((gap) => gap.x2 - gap.x1 >= bodyWidth + 40)) {
      problems.push(`床${floor.index}にプレイヤーが落ちられる幅の穴がない`);
    }
    if (i > 0 && upper) {
      for (const a of gaps(upper)) {
        for (const b of gaps(floor)) {
          if (overlaps(a, b)) problems.push(`床${upper.index}の穴 ${a.x1}〜${a.x2} と、床${floor.index}の穴 ${b.x1}〜${b.x2} が重なっている`);
        }
      }
    }
    for (const segment of floor.segments) {
      if (segment.x2 - segment.x1 < config.course.minFooting) {
        problems.push(`床${floor.index}の足場 ${segment.x1}〜${segment.x2} が狭すぎる`);
      }
    }
  });

  for (const rock of stage.obstacles) {
    const span = { x1: rock.x - rock.w / 2, x2: rock.x + rock.w / 2 };
    const floor = stage.floors[rock.floor];
    if (!floor.segments.some((segment) => span.x1 >= segment.x1 && span.x2 <= segment.x2)) {
      problems.push(`床${rock.floor}の岩（x=${rock.x}）が穴にかかっている`);
    }
    const upper = above(floor);
    if (upper && gaps(upper).some((gap) => overlaps(gap, span))) {
      problems.push(`床${rock.floor}の岩（x=${rock.x}）が一段上の穴の真下にある`);
    }
  }

  for (const type of config.prey.types) {
    const floor = stage.floors[type.floor];
    let free = 0;
    for (let x = floor.x1 + 40; x <= floor.x2 - 40; x += 20) {
      if (
        floorAt(stage, x - type.width / 2, floor.y) &&
        floorAt(stage, x + type.width / 2, floor.y) &&
        !noPreyZoneAt(stage, x, floor.y) &&
        isClearOfObstacles(stage, type.floor, x, type.width / 2)
      ) {
        free++;
      }
    }
    if (free <= 5) problems.push(`床${type.floor}に獲物（${type.price}）の出られる場所がない`);
  }
  return problems;
}

/**
 * 一番上以外の床の穴と岩の位置をランダムに決める（一番上の床と地面の形はそのまま）。
 * checkCourse で遊べると確かめた配置だけを返す。何度か試しても作れなければ null（設定の配置を使う）。
 * @param {typeof import('../config.js').CONFIG} config
 * @param {() => number} random 0以上1未満を返す関数（テスト用に差し替え可能）
 * @returns {{ floors: object[], obstacles: object[] } | null} config.floors / config.obstacles と同じ形
 */
export function randomCourse(config, random = Math.random) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const course = drawCourse(config, random);
    if (course && checkCourse(buildStage({ ...config, ...course }), config).length === 0) return course;
  }
  return null;
}

/** ランダムな配置を1つ作る。置ける場所がなければ null */
function drawCourse(config, random) {
  const { holeWidth, minFooting, holeGap, rocksPerFloor, rockSize, rockClearance } = config.course;
  const pick = (list) => (list.length > 0 ? list[Math.floor(random() * list.length)] : null);
  const extent = (floor) => ({ x1: floor.x1 ?? config.field.x, x2: floor.x2 ?? config.field.x + config.field.width });
  const holeSpans = (floor) => (floor.holes ?? []).map((hole) => ({ x1: hole.x - hole.width / 2, x2: hole.x + hole.width / 2 }));
  const top = config.floors.length - 1; // 一番上の床（そのまま）。0 は地面（穴をあけない）
  const floors = config.floors.map((floor) => ({ ...floor }));

  // 穴：上の段から順に、一段上の穴と横に重ならない位置へ置く。両側に足場を残すか、壁にぴったり付ける
  for (let i = top - 1; i >= 1; i--) {
    const { x1, x2 } = extent(floors[i]);
    const upperHoles = holeSpans(floors[i + 1]);
    const lefts = [x1, x2 - holeWidth];
    for (let left = x1 + minFooting; left + holeWidth <= x2 - minFooting; left += 10) lefts.push(left);
    const left = pick(
      lefts.filter((l) => upperHoles.every((up) => l + holeWidth + holeGap <= up.x1 || l >= up.x2 + holeGap)),
    );
    if (left === null) return null;
    floors[i].holes = [{ x: left + holeWidth / 2, width: holeWidth }];
  }

  // 岩：穴・壁・ほかの岩から離し、一段上の穴の真下にも置かない。一番上の床の岩は設定のまま
  const obstacles = config.obstacles.filter((obstacle) => obstacle.floor === top);
  const [minRocks, maxRocks] = rocksPerFloor;
  for (let i = 0; i < top; i++) {
    const { x1, x2 } = extent(floors[i]);
    const keepOut = [...holeSpans(floors[i]), ...holeSpans(floors[i + 1])];
    const count = minRocks + Math.floor(random() * (maxRocks - minRocks + 1));
    const placed = [];
    for (let n = 0; n < count; n++) {
      const xs = [];
      for (let x = x1 + rockClearance + rockSize / 2; x <= x2 - rockClearance - rockSize / 2; x += 10) {
        const clearOfHoles = keepOut.every(
          (k) => x + rockSize / 2 + rockClearance <= k.x1 || x - rockSize / 2 - rockClearance >= k.x2,
        );
        if (clearOfHoles && placed.every((p) => Math.abs(p - x) >= rockSize + rockClearance)) xs.push(x);
      }
      const x = pick(xs);
      if (x === null) return null;
      placed.push(x);
      obstacles.push({ floor: i, x, w: rockSize, h: rockSize });
    }
  }
  return { floors, obstacles };
}
