// ステージ（床・床の穴・障害物・獲物が入れない範囲）の形と、位置の判定。床は下から通り抜けられず、穴を通って上下に移動する。
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
