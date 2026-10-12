// ステージ（床・はしご・障害物）の形と、位置の判定。
// Phaser に依存しないので、node --test で単体テストできる。

/**
 * 設定からステージの形を作る。
 * @param {typeof import('../config.js').CONFIG} config
 */
export function buildStage(config) {
  const floors = config.floors.map((floor, index) => ({
    index,
    y: floor.y, // 床の上面
    x1: floor.x1,
    x2: floor.x2,
    thickness: floor.thickness ?? config.floorThickness,
  }));
  const ladders = config.ladders.map((ladder) => ({
    x: ladder.x,
    from: ladder.from,
    to: ladder.to,
    topY: floors[ladder.to].y, // 上の床の上面
    bottomY: floors[ladder.from].y, // 下の床の上面
  }));
  const obstacles = config.obstacles.map((obstacle) => ({
    floor: obstacle.floor,
    x: obstacle.x,
    y: floors[obstacle.floor].y - obstacle.h / 2, // 中心
    w: obstacle.w,
    h: obstacle.h,
  }));
  // 獲物が入れない範囲（檻と焚き火のまわり）。y2 は床の上面より少し下まで
  const margin = config.prey.keepOutMargin;
  const { cage, campfire } = config;
  const cageFloorY = floors[cage.floor].y;
  const fireFloorY = floors[campfire.floor].y;
  const noPreyZones = [
    {
      x1: cage.x - cage.width / 2 - margin,
      x2: cage.x + cage.width / 2 + margin,
      y1: cageFloorY - cage.height - margin,
      y2: cageFloorY + 10,
    },
    {
      x1: campfire.x - campfire.radius - margin,
      x2: campfire.x + campfire.radius + margin,
      y1: fireFloorY - campfire.radius * 2 - margin,
      y2: fireFloorY + 10,
    },
  ];
  return { floors, ladders, obstacles, noPreyZones };
}

/** 獲物が入れない範囲に入っているか。入っていればその範囲を返す */
export function noPreyZoneAt(stage, x, feetY) {
  return stage.noPreyZones.find((z) => x >= z.x1 && x <= z.x2 && feetY >= z.y1 && feetY <= z.y2) ?? null;
}

/** 足元（feetY）にある床。なければ null */
export function floorAt(stage, x, feetY, tolerance = 8) {
  return stage.floors.find((f) => x >= f.x1 && x <= f.x2 && Math.abs(feetY - f.y) <= tolerance) ?? null;
}

/** 登り始められるはしご（はしごの近くにいて、足が下端から上端の手前までの間にある） */
export function ladderToClimbUp(stage, x, feetY, grabDistance) {
  return (
    stage.ladders.find((l) => Math.abs(x - l.x) <= grabDistance && feetY > l.topY + 2 && feetY <= l.bottomY + 6) ??
    null
  );
}

/** 降り始められるはしご（はしごの上端に立っている） */
export function ladderToClimbDown(stage, x, feetY, grabDistance) {
  return stage.ladders.find((l) => Math.abs(x - l.x) <= grabDistance && Math.abs(feetY - l.topY) <= 12) ?? null;
}

/** 同じ段にいるとみなせるか（足の高さの差で判定） */
export function onSameLevel(feetA, feetB, tolerance = 40) {
  return Math.abs(feetA - feetB) <= tolerance;
}

/** その床の上で、幅 halfWidth×2 のものを置いても障害物と重ならないか */
export function isClearOfObstacles(stage, floorIndex, x, halfWidth) {
  return !stage.obstacles.some((o) => o.floor === floorIndex && Math.abs(x - o.x) < o.w / 2 + halfWidth);
}
