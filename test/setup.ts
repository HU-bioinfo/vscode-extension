// Mochaのグローバル関数とテスト実行環境の設定
import { shouldSkipTestInIntegrationMode } from './integration-test-config';

// テストモードを列挙型として定義
export enum TEST_MODE {
  UNIT = 'ユニットテスト',
  WORKFLOW = 'ワークフローテスト',
  // 後方互換性のために追加
  MOCK = 'ユニットテスト',
  INTEGRATION = 'ワークフローテスト',
  E2E = 'ワークフローテスト'
}

// 環境変数からテストモードを決定
export const CURRENT_TEST_MODE = process.env.RUN_WORKFLOW_TESTS === 'true' 
  ? TEST_MODE.WORKFLOW 
  : TEST_MODE.UNIT;

// テストモードの情報をコンソールに出力
console.log(`テストモード: ${CURRENT_TEST_MODE}`); 

// ワークフローテストモードで特定のテストをスキップするためのMochaフック
if (CURRENT_TEST_MODE === TEST_MODE.WORKFLOW) {
  beforeEach(function() {
    // テストタイトルを取得し、ワークフローテストとして実行すべきか判定
    if (this.currentTest && !this.currentTest.title.includes('ワークフロー')) {
      console.log(`ワークフローテストでないためスキップ: ${this.currentTest.title}`);
      this.skip();
    }
  });
} 