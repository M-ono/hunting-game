import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatDuration } from '../src/utils/format.js';

test('残り時間は「分:秒」で、端数は切り上げ', () => {
  assert.equal(formatClock(300000), '5:00');
  assert.equal(formatClock(299001), '5:00');
  assert.equal(formatClock(299000), '4:59');
  assert.equal(formatClock(65000), '1:05');
  assert.equal(formatClock(9500), '0:10');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(-100), '0:00');
});

test('制限時間の言葉', () => {
  assert.equal(formatDuration(300), '5分');
  assert.equal(formatDuration(60), '1分');
  assert.equal(formatDuration(90), '1分30秒');
  assert.equal(formatDuration(45), '45秒');
});
