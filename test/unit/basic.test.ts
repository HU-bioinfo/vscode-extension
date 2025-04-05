import * as assert from 'assert';
import * as sinon from 'sinon';
import { mockVscode, resetAllMocks } from '../../src/test-helper';

// VS Code モジュールを実際にモックする前に、元のモジュールを保存
const originalRequire = require;

// モックを使って実際のVSCodeをシミュレートするための設定
const mockRequire = function(moduleName: string) {
  if (moduleName === 'vscode') {
    return mockVscode;
  }
  return originalRequire(moduleName);
};

// requireをモックで上書き
(global as any).require = mockRequire;

// 基本的なエラーハンドリングのテスト
describe('Basic Error Handling Tests', function() {
  beforeEach(function() {
    resetAllMocks();
  });

  afterEach(function() {
    sinon.restore();
  });
  
  // テストタイムアウトを延長
  this.timeout(5000);
  
  it('エラーの有無で条件分岐する処理をテストする', () => {
    // エラーの有無で処理を分ける関数を定義
    function handleDockerInstall(error: Error | null): string {
      if (error) {
        return 'Dockerがインストールされていません';
      } else {
        return 'Dockerはインストールされています';
      }
    }
    
    // エラーがある場合の結果
    const errorResult = handleDockerInstall(new Error('command not found'));
    assert.strictEqual(errorResult, 'Dockerがインストールされていません');
    
    // エラーがない場合の結果
    const successResult = handleDockerInstall(null);
    assert.strictEqual(successResult, 'Dockerはインストールされています');
  });
  
  it('エラーメッセージをパースして適切に処理する', () => {
    // エラーメッセージを解析する関数
    function parseDockerError(errorMessage: string): string {
      if (errorMessage.includes('permission denied')) {
        return '権限エラー';
      } else if (errorMessage.includes('not found')) {
        return 'インストールエラー';
      } else {
        return '不明なエラー';
      }
    }
    
    // 異なるエラーメッセージのテスト
    assert.strictEqual(parseDockerError('permission denied'), '権限エラー');
    assert.strictEqual(parseDockerError('command not found'), 'インストールエラー');
    assert.strictEqual(parseDockerError('unexpected error'), '不明なエラー');
  });
  
  // VSCodeのAPIを使用したエラーハンドリングのテスト
  it('VSCode APIを使ったエラーメッセージ表示のテスト', () => {
    // エラーメッセージを表示する関数
    function showError(message: string): void {
      mockVscode.window.showErrorMessage(message);
    }
    
    // 関数を呼び出し
    showError('テストエラーメッセージ');
    
    // スタブが正しく呼び出されたことを確認
    assert.strictEqual(mockVscode.window.showErrorMessage.called, true);
    assert.strictEqual(mockVscode.window.showErrorMessage.calledWith('テストエラーメッセージ'), true);
  });
}); 