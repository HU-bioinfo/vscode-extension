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
const sinon = __importStar(require("sinon"));
const test_helper_1 = require("../src/test-helper");
// VS Code モジュールを実際にモックする前に、元のモジュールを保存
const originalRequire = require;
// モックを使って実際のVSCodeをシミュレートするための設定
const mockRequire = function (moduleName) {
    if (moduleName === 'vscode') {
        return test_helper_1.mockVscode;
    }
    return originalRequire(moduleName);
};
// requireをモックで上書き
global.require = mockRequire;
// 基本的なエラーハンドリングのテスト
describe('Basic Error Handling Tests', function () {
    beforeEach(function () {
        (0, test_helper_1.resetAllMocks)();
    });
    afterEach(function () {
        sinon.restore();
    });
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
    // VSCodeのAPIを使用したエラーハンドリングのテスト
    it('VSCode APIを使ったエラーメッセージ表示のテスト', () => {
        // エラーメッセージを表示する関数
        function showError(message) {
            test_helper_1.mockVscode.window.showErrorMessage(message);
        }
        // 関数を呼び出し
        showError('テストエラーメッセージ');
        // スタブが正しく呼び出されたことを確認
        assert.strictEqual(test_helper_1.mockVscode.window.showErrorMessage.called, true);
        assert.strictEqual(test_helper_1.mockVscode.window.showErrorMessage.calledWith('テストエラーメッセージ'), true);
    });
});
//# sourceMappingURL=basic.test.js.map