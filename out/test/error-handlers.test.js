"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
// work-envエクステンションのエラーハンドリングテスト
describe('Work Env Error Handlers', function () {
    // Docker関連エラー
    describe('Docker関連エラーハンドリング', () => {
        it('Dockerコマンドが見つからない場合のエラー処理', () => {
            const errorHandler = (error) => {
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
            const errorHandler = (error) => {
                if (error.message.includes('permission denied')) {
                    // プラットフォームによって異なるメッセージを表示
                    const platform = process.platform;
                    let helpMessage = '';
                    if (platform === 'linux') {
                        helpMessage = 'ユーザーをdockerグループに追加してください';
                    }
                    else if (platform === 'darwin') {
                        helpMessage = 'Docker Desktopを再起動してください';
                    }
                    else {
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
            const validateProjectPath = (path) => {
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
            const validateGithubToken = (token) => {
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
//# sourceMappingURL=error-handlers.test.js.map