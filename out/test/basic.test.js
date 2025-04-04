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
// 基本的なエラーハンドリングのテスト
describe('Basic Error Handling Tests', function () {
    // テストタイムアウトを延長
    this.timeout(5000);
    it('エラーの有無で条件分岐する処理をテストする', () => {
        // エラーの有無で処理を分ける関数を定義
        function handleDockerInstall(error) {
            if (error) {
                return 'Dockerがインストールされていません';
            }
            else {
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
        function parseDockerError(errorMessage) {
            if (errorMessage.includes('permission denied')) {
                return '権限エラー';
            }
            else if (errorMessage.includes('not found')) {
                return 'インストールエラー';
            }
            else {
                return '不明なエラー';
            }
        }
        // 異なるエラーメッセージのテスト
        assert.strictEqual(parseDockerError('permission denied'), '権限エラー');
        assert.strictEqual(parseDockerError('command not found'), 'インストールエラー');
        assert.strictEqual(parseDockerError('unexpected error'), '不明なエラー');
    });
});
//# sourceMappingURL=basic.test.js.map