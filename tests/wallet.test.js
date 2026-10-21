import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from '../src/systems/Wallet.js';

test('売ると所持金と稼いだ合計が増える', () => {
  const wallet = new Wallet();
  wallet.earn(30);
  wallet.earn(40);
  assert.equal(wallet.money, 70);
  assert.equal(wallet.earned, 70);
  assert.equal(wallet.spent, 0);
});

test('払うと所持金が減り、使った合計が増える（記録は残ったお金）', () => {
  const wallet = new Wallet();
  wallet.earn(50);
  assert.equal(wallet.spend(20), true);
  assert.equal(wallet.money, 30);
  assert.equal(wallet.earned, 50);
  assert.equal(wallet.spent, 20);
});

test('足りなければ払えず、所持金は変わらない', () => {
  const wallet = new Wallet();
  wallet.earn(10);
  assert.equal(wallet.spend(20), false);
  assert.equal(wallet.money, 10);
  assert.equal(wallet.spent, 0);
  assert.equal(wallet.spend(10), true); // ちょうどなら払える
  assert.equal(wallet.money, 0);
});
