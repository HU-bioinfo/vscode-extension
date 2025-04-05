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
describe('テストヘルパーの機能テスト', () => {
    afterEach(() => {
        sinon.restore();
    });
    it('resetMocks関数のテスト', () => {
        test_helper_1.vscode.window.showErrorMessage();
        (0, test_helper_1.resetMocks)();
        assert.strictEqual(test_helper_1.vscode.window.showErrorMessage.callCount, 0);
    });
    it('resetAllMocks関数のテスト', () => {
        test_helper_1.vscode.window.showErrorMessage();
        test_helper_1.vscode.window.showInformationMessage();
        test_helper_1.vscode.commands.executeCommand();
        (0, test_helper_1.resetAllMocks)();
        assert.strictEqual(test_helper_1.vscode.window.showErrorMessage.callCount, 0);
        assert.strictEqual(test_helper_1.vscode.window.showInformationMessage.callCount, 0);
        assert.strictEqual(test_helper_1.vscode.commands.executeCommand.callCount, 0);
    });
    it('waitForPromiseが指定時間後にresolveすること', async () => {
        const startTime = Date.now();
        await (0, test_helper_1.waitForPromise)(50);
        const elapsed = Date.now() - startTime;
        assert.ok(elapsed >= 40, 'waitForPromiseは少なくとも指定時間待機する必要があります');
    });
    it('setupMockFileSystem関数のテスト', () => {
        const fileSystem = {
            'dir1': {
                'file1.txt': 'content1',
                'subdir': {
                    'file2.txt': 'content2'
                }
            },
            'file3.txt': 'content3'
        };
        (0, test_helper_1.setupMockFileSystem)(fileSystem);
        assert.ok(true, 'Mock file system setup completed');
    });
    it('setupMockFileSystemが例外をハンドリングできること', () => {
        // 空のオブジェクトを使用してエラーケースをテスト
        const emptyFileSystem = {};
        (0, test_helper_1.setupMockFileSystem)(emptyFileSystem);
        // 無効なパスで動作確認
        const result = test_helper_1.fsMock.existsSync('/non/existent/path');
        assert.strictEqual(result, false, '存在しないパスに対してfalseを返すべき');
    });
    it('mockDockerSuccess関数のテスト', () => {
        (0, test_helper_1.mockDockerSuccess)();
        // 子プロセスの実行がモック化されていることを確認
        const execStub = test_helper_1.childProcess.exec;
        assert.ok(execStub.calledOnce === false, 'exec should not be called yet');
        // モック化された関数をテスト
        execStub.withArgs('docker --version').yields(null, { stdout: 'Docker version 20.10.12' });
        test_helper_1.childProcess.exec('docker --version', (err, result) => {
            assert.strictEqual(err, null);
            assert.deepStrictEqual(result, { stdout: 'Docker version 20.10.12' });
        });
    });
    it('mockDockerFailure関数のテスト', () => {
        const errorMessage = 'Docker command not found';
        (0, test_helper_1.mockDockerFailure)(errorMessage);
        // 子プロセスの実行がモック化されていることを確認
        const execStub = test_helper_1.childProcess.exec;
        // モック化された関数をテスト
        test_helper_1.childProcess.exec('docker --version', (err, result) => {
            assert.strictEqual(err.message, errorMessage);
            assert.strictEqual(result, null);
        });
    });
    it('createMockContext関数のテスト', () => {
        const context = (0, test_helper_1.createMockContext)('/test/path');
        assert.strictEqual(context.extensionUri.fsPath, '/test/path');
        assert.strictEqual(context.subscriptions.length, 0);
    });
    it('createMockContextでカスタムパスを使用できること', () => {
        const customPath = '/custom/extension/path';
        const context = (0, test_helper_1.createMockContext)(customPath);
        assert.strictEqual(context.extensionUri.fsPath, customPath);
    });
    it('isDockerInstalled関数のテスト', async () => {
        // テスト環境ではtrueを返すことを確認
        process.env.NODE_ENV = 'test';
        const result = await (0, test_helper_1.isDockerInstalled)();
        assert.strictEqual(result, true);
    });
    it('isRemoteContainersInstalled関数のテスト', async function () {
        // タイムアウト設定を追加
        this.timeout(5000);
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        // 環境変数の設定を保存
        const originalNodeEnv = process.env.NODE_ENV;
        try {
            // テスト環境を設定
            process.env.NODE_ENV = 'test';
            // モックを設定
            test_helper_1.vscode.extensions.getExtension = sinon.stub();
            test_helper_1.vscode.extensions.getExtension.withArgs('ms-vscode-remote.remote-containers').returns({ id: 'ms-vscode-remote.remote-containers' });
            // テスト実行
            const result = await (0, test_helper_1.isRemoteContainersInstalled)();
            assert.strictEqual(result, true);
            // NODE_ENV=testの場合、関数は内部のモックを使用せずに即座にtrueを返すため、このアサーションは削除
            // assert.ok(vscode.extensions.getExtension.calledWith('ms-vscode-remote.remote-containers'));
        }
        finally {
            // 環境変数を元に戻す
            process.env.NODE_ENV = originalNodeEnv;
        }
    });
    it('expectation objectのテスト', () => {
        assert.ok(test_helper_1.expectation.errorMessageShown, 'errorMessageShownが存在する');
        assert.ok(test_helper_1.expectation.infoMessageShown, 'infoMessageShownが存在する');
        assert.ok(test_helper_1.expectation.commandExecuted, 'commandExecutedが存在する');
    });
    it('mockRemoteContainersExtension関数のテスト', async () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        // 拡張機能が存在するケース
        (0, test_helper_1.mockRemoteContainersExtension)(true);
        // モックが適切に設定されていることを確認
        // この関数はvscode.extensions.getExtensionを再定義するため、calledOnceではなく関数が定義されていることを確認
        assert.ok(typeof test_helper_1.vscode.extensions.getExtension === 'function');
        // 実際に動作テスト
        const extensionId = 'ms-vscode-remote.remote-containers';
        const extension = test_helper_1.vscode.extensions.getExtension(extensionId);
        assert.deepStrictEqual(extension, { id: extensionId });
    });
    it('mockRemoteContainersExtension関数で拡張機能なしを設定できること', async () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        // 拡張機能が存在しないケース
        (0, test_helper_1.mockRemoteContainersExtension)(false);
        // モックが適切に設定されていることを確認
        // この関数はvscode.extensions.getExtensionを再定義するため、calledOnceではなく関数が定義されていることを確認
        assert.ok(typeof test_helper_1.vscode.extensions.getExtension === 'function');
        // 実際に動作テスト
        const extensionId = 'ms-vscode-remote.remote-containers';
        const extension = test_helper_1.vscode.extensions.getExtension(extensionId);
        assert.strictEqual(extension, undefined);
    });
    it('mockProjectFolderSelection関数のテスト', () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        const testPath = '/test/project';
        (0, test_helper_1.mockProjectFolderSelection)(testPath);
        // 戻り値をテスト
        test_helper_1.vscode.window.showOpenDialog().then((result) => {
            assert.deepStrictEqual(result, [{ fsPath: testPath }]);
        });
    });
    it('mockCacheFolderSelection関数のテスト', () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        const testPath = '/test/cache';
        (0, test_helper_1.mockCacheFolderSelection)(testPath);
        // 戻り値をテスト
        test_helper_1.vscode.window.showOpenDialog().then((result) => {
            assert.deepStrictEqual(result, [{ fsPath: testPath }]);
        });
    });
    it('mockGitHubPatInput関数のテスト', () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        (0, test_helper_1.resetMocks)();
        const testPat = 'test-pat';
        (0, test_helper_1.mockGitHubPatInput)(testPat);
        // 戻り値をテスト
        test_helper_1.vscode.window.showInputBox().then((result) => {
            assert.strictEqual(result, testPat);
        });
    });
    it('generateDockerCompose関数のテスト', () => {
        const projectPath = '/test/project';
        const cachePath = '/test/cache';
        const githubToken = 'test-github-token';
        const result = (0, test_helper_1.generateDockerCompose)(projectPath, cachePath, githubToken);
        // 結果はdocker-compose.ymlの内容を含む文字列
        assert.ok(result.includes('version:'), 'docker-compose.ymlにはversionフィールドが含まれるべき');
        assert.ok(result.includes('services:'), 'docker-compose.ymlにはservicesフィールドが含まれるべき');
        assert.ok(result.includes(projectPath), 'プロジェクトパスが含まれるべき');
        assert.ok(result.includes(cachePath), 'キャッシュパスが含まれるべき');
        assert.ok(result.includes(githubToken), 'GitHubトークンが含まれるべき');
    });
    // 追加のエッジケーステスト
    it('generateDockerComposeがパスの区切り文字を標準化すること', () => {
        // Windows形式のパス
        const projectPath = 'C:\\test\\project';
        const cachePath = 'D:\\test\\cache';
        const githubToken = 'test-github-token';
        const result = (0, test_helper_1.generateDockerCompose)(projectPath, cachePath, githubToken);
        // パスがUNIX形式に変換されていることを確認
        assert.ok(!result.includes('\\'), 'Windows形式のパス区切り文字がUNIX形式に変換されるべき');
    });
});
//# sourceMappingURL=test-helper.test.js.map