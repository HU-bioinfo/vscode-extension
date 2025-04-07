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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const path = __importStar(require("path"));
const mocha_1 = __importDefault(require("mocha"));
const glob_1 = require("glob");
function run() {
    // テストランナーの作成
    const mocha = new mocha_1.default({
        ui: 'bdd',
        color: true,
        timeout: 60000 // E2Eテストのためにタイムアウトを長めに設定
    });
    const testsRoot = path.resolve(__dirname, '..');
    // 環境変数からテストモードを取得
    const testMode = process.env.TEST_MODE || 'TEST';
    console.log(`テストモード: ${testMode}`);
    // E2Eワークフローテストを実行するかどうか
    const runWorkflowTests = process.env.RUN_WORKFLOW_TESTS === 'true';
    console.log(`E2Eワークフローテストの実行: ${runWorkflowTests}`);
    return new Promise((resolve, reject) => {
        // 新しいディレクトリ構造に対応したテストパターン
        // ユニットテストパターン
        const unitTestPattern = 'test/unit/**/*.test.js';
        // ワークフローテストパターン
        const workflowTestPattern = 'test/workflow/**/*.test.js';
        // 実行するテストパターンを決定
        let testPattern;
        if (runWorkflowTests) {
            // ワークフローテストのみ実行
            testPattern = workflowTestPattern;
            console.log('ワークフローテストを実行します');
        }
        else {
            // ユニットテストのみ実行
            testPattern = unitTestPattern;
            console.log('ユニットテストを実行します');
        }
        // globプロミスを使用
        (0, glob_1.glob)(testPattern, { cwd: testsRoot }).then((files) => {
            if (files.length === 0) {
                console.log(`警告: パターン ${testPattern} に一致するテストファイルが見つかりません`);
            }
            else {
                console.log(`実行するテストファイル (${files.length}件):`);
                files.forEach((file) => console.log(` - ${file}`));
            }
            // テストファイルをMochaに追加
            files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
            try {
                // テスト実行
                mocha.run((failures) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} テストが失敗しました`));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                console.error('Mochaテスト実行中のエラー:', err);
                reject(err);
            }
        }).catch((err) => {
            console.error('テストファイル検索中のエラー:', err);
            reject(err);
        });
    });
}
//# sourceMappingURL=index.js.map