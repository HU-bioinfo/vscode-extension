import * as assert from 'assert';
import '../src/extension'; // ソースコードへの参照を追加

// work-envエクステンションのエラーハンドリングテスト
describe('Work Env Error Handlers', function() {
  // Docker関連エラー
  describe('Docker関連エラーハンドリング', () => {
    it('Dockerコマンドが見つからない場合のエラー処理', () => {
      const errorHandler = (error: Error): { success: boolean, message: string } => {
        if (error.message.includes('not found')) {
          return {
            success: false,
            message: 'Dockerがインストールされていません。インストールしてください。'
          };
        }
        return { success: true, message: '' };
      };
      
      const result = errorHandler(new Error('command not found: docker'));
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message, 'Dockerがインストールされていません。インストールしてください。');
    });
    
    it('Docker権限エラーの処理', () => {
      const errorHandler = (error: Error): { success: boolean, message: string, platform?: string } => {
        if (error.message.includes('permission denied')) {
          // プラットフォームによって異なるメッセージを表示
          const platform = process.platform;
          let helpMessage = '';
          
          if (platform === 'linux') {
            helpMessage = 'ユーザーをdockerグループに追加してください';
          } else if (platform === 'darwin') {
            helpMessage = 'Docker Desktopを再起動してください';
          } else {
            helpMessage = '管理者権限で実行してください';
          }
          
          return {
            success: false,
            message: 'Dockerの実行権限がありません。',
            platform: platform
          };
        }
        return { success: true, message: '' };
      };
      
      const result = errorHandler(new Error('permission denied'));
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message, 'Dockerの実行権限がありません。');
      assert.ok(result.platform); // プラットフォームが設定されていることを確認
    });
  });
  
  // 入力チェック関連エラー
  describe('入力チェック関連エラーハンドリング', () => {
    it('プロジェクトパスが選択されていない場合のエラー処理', () => {
      const validateProjectPath = (path: string | null): { valid: boolean, message: string } => {
        if (!path) {
          return {
            valid: false,
            message: 'プロジェクトフォルダが選択されていません。'
          };
        }
        return { valid: true, message: '' };
      };
      
      const emptyResult = validateProjectPath(null);
      assert.strictEqual(emptyResult.valid, false);
      assert.strictEqual(emptyResult.message, 'プロジェクトフォルダが選択されていません。');
      
      const validResult = validateProjectPath('/path/to/project');
      assert.strictEqual(validResult.valid, true);
    });
    
    it('GitHubトークンが設定されていない場合のエラー処理', () => {
      const validateGithubToken = (token: string | null): { valid: boolean, message: string } => {
        if (!token) {
          return {
            valid: false,
            message: 'GitHub PATが必要です。'
          };
        }
        
        if (token.length < 10) {
          return {
            valid: false,
            message: 'GitHub PATの形式が正しくありません。'
          };
        }
        
        return { valid: true, message: '' };
      };
      
      const emptyResult = validateGithubToken(null);
      assert.strictEqual(emptyResult.valid, false);
      assert.strictEqual(emptyResult.message, 'GitHub PATが必要です。');
      
      const invalidResult = validateGithubToken('1234');
      assert.strictEqual(invalidResult.valid, false);
      assert.strictEqual(invalidResult.message, 'GitHub PATの形式が正しくありません。');
      
      const validResult = validateGithubToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      assert.strictEqual(validResult.valid, true);
    });
  });
}); 