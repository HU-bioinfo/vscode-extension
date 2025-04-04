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
const vscode = __importStar(require("vscode"));
const child_process = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const helper = __importStar(require("../src/test-helper"));
describe('Extension Error Handling', function () {
    // テストタイムアウトを延長
    this.timeout(10000);
    // スタブとスパイのセットアップ
    let sandbox;
    let execStub;
    let showErrorMessageStub;
    let showInformationMessageStub;
    let getExtensionStub;
    let openExternalStub;
    let showOpenDialogStub;
    let showInputBoxStub;
    let executeCommandStub;
    let existsSyncStub;
    let readFileSyncStub;
    let writeFileSyncStub;
    // mock context
    const mockContext = {
        subscriptions: [],
        globalStorageUri: { fsPath: '/mock/storage/path' },
        extensionUri: { fsPath: '/mock/extension/path' }
    };
    beforeEach(() => {
        // サンドボックスの作成
        sandbox = sinon.createSandbox();
        // VS Code API のスタブ作成
        showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage').returns(Promise.resolve(undefined));
        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(undefined));
        getExtensionStub = sandbox.stub(vscode.extensions, 'getExtension');
        openExternalStub = sandbox.stub(vscode.env, 'openExternal').returns(Promise.resolve(true));
        showOpenDialogStub = sandbox.stub(vscode.window, 'showOpenDialog');
        showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').returns(Promise.resolve());
        // Node.js API のスタブ作成
        execStub = sandbox.stub(child_process, 'exec');
        existsSyncStub = sandbox.stub(fs, 'existsSync');
        readFileSyncStub = sandbox.stub(fs, 'readFileSync');
        writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
    });
    afterEach(() => {
        // サンドボックスのリストア
        sandbox.restore();
    });
    it('Remote Containers拡張機能がインストールされていない場合にエラーメッセージを表示する', async () => {
        // Remote Containers拡張機能がインストールされていないと設定
        getExtensionStub.withArgs('ms-vscode-remote.remote-containers').returns(undefined);
        // 関数を直接テスト
        helper.showRemoteContainersNotInstalledError();
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.ok(showErrorMessageStub.firstCall.args[0].includes('Remote Containers拡張機能がインストールされていません'));
    });
    it('Dockerがインストールされていない場合にエラーメッセージを表示する', async () => {
        // Node.jsのexecをモック
        execStub.callsFake((command, callback) => {
            if (command === 'docker --version') {
                callback(new Error('command not found: docker'), '', '');
            }
            return {};
        });
        // 関数を直接テスト
        const result = await helper.isDockerInstalled();
        assert.strictEqual(result, false);
        helper.showDockerNotInstalledError();
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.ok(showErrorMessageStub.firstCall.args[0].includes('Dockerがインストールされていません'));
    });
    it('Dockerの権限がない場合にエラーメッセージを表示する', async () => {
        // Node.jsのexecをモック
        execStub.callsFake((command, callback) => {
            if (command === 'docker --version') {
                callback(null, 'Docker version 20.10.12', '');
            }
            else if (command === 'docker info') {
                callback(new Error('permission denied'), '', '');
            }
            return {};
        });
        // 関数を直接テスト
        const result = await helper.checkDockerPermissions();
        assert.strictEqual(result, false);
        helper.showDockerPermissionError();
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.ok(showErrorMessageStub.firstCall.args[0].includes('Dockerの実行権限がありません'));
    });
    it('Dockerイメージの取得に失敗した場合にエラーメッセージを表示する', async () => {
        // Node.jsのexecをモック
        execStub.callsFake((command, callback) => {
            if (command === 'docker pull kokeh/hu_bioinfo:stable') {
                callback(new Error('Error: pull access denied'), '', '');
            }
            return {};
        });
        // テスト用にエラーが表示されることを確認
        try {
            // コマンド実行をシミュレート
            execStub.callThrough();
            await vscode.commands.executeCommand('work-env.start-work-env');
        }
        catch (error) {
            // エラーが発生することを期待
        }
        // エラーメッセージが表示されるかをチェック
        assert.ok(showErrorMessageStub.called);
    });
    it('プロジェクトフォルダが選択されていない場合にエラーメッセージを表示する', async () => {
        // showOpenDialogをモック
        showOpenDialogStub.resolves(undefined);
        // 関数を直接テスト
        const result = await helper.generateDockerCompose(mockContext, '/mock/path/docker-compose.yml');
        // 結果が失敗（false）であることを確認
        assert.strictEqual(result, false);
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.called, true);
        assert.ok(showErrorMessageStub.calledWith('プロジェクトフォルダが選択されていません。'));
    });
    it('キャッシュフォルダが選択されていない場合にエラーメッセージを表示する', async () => {
        // プロジェクトフォルダは選択されるが、キャッシュフォルダは選択されないと設定
        showOpenDialogStub.onFirstCall().resolves([{ fsPath: '/mock/project' }]);
        showOpenDialogStub.onSecondCall().resolves(undefined);
        // 関数を直接テスト
        const result = await helper.generateDockerCompose(mockContext, '/mock/path/docker-compose.yml');
        // 結果が失敗（false）であることを確認
        assert.strictEqual(result, false);
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.callCount, 1);
        assert.ok(showErrorMessageStub.calledWith('キャッシュフォルダが選択されていません。'));
    });
    it('GitHub PATが入力されていない場合にエラーメッセージを表示する', async () => {
        // フォルダは選択されるが、GitHub PATは入力されないと設定
        showOpenDialogStub.onFirstCall().resolves([{ fsPath: '/mock/project' }]);
        showOpenDialogStub.onSecondCall().resolves([{ fsPath: '/mock/cache' }]);
        showInputBoxStub.resolves(undefined);
        // 関数を直接テスト
        const result = await helper.generateDockerCompose(mockContext, '/mock/path/docker-compose.yml');
        // 結果が失敗（false）であることを確認
        assert.strictEqual(result, false);
        // エラーメッセージが表示されたことを確認
        assert.strictEqual(showErrorMessageStub.callCount, 1);
        assert.ok(showErrorMessageStub.calledWith('GitHub PATが必要です。'));
    });
});
//# sourceMappingURL=error-handling.test.js.map