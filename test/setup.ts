// Mochaのグローバル関数とテスト実行環境の設定

// テストモードを列挙型として定義
export enum TEST_MODE {
  UNIT = 'ユニットテスト'
}

// 後方互換性のために別名を定義
export namespace TEST_MODE {
  export const MOCK = TEST_MODE.UNIT;
}

// テストモードを設定
export const CURRENT_TEST_MODE = TEST_MODE.UNIT;

// テストモードの情報をコンソールに出力
console.log(`テストモード: ${CURRENT_TEST_MODE}`); 