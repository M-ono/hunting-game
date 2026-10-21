// 所持金。ギルドで獲物を売ると増え、食堂で使うと減る。記録になるのは最後に残ったお金。
// Phaser に依存しないので、node --test で単体テストできる。

export class Wallet {
  constructor() {
    this.money = 0; // 今の所持金
    this.earned = 0; // 稼いだお金の合計
    this.spent = 0; // 使ったお金の合計
  }

  /** 獲物を売ってお金をもらう */
  earn(amount) {
    this.money += amount;
    this.earned += amount;
  }

  /**
   * お金を払う。足りなければ払わない。
   * @returns {boolean} 払えたら true
   */
  spend(amount) {
    if (amount > this.money) return false;
    this.money -= amount;
    this.spent += amount;
    return true;
  }
}
