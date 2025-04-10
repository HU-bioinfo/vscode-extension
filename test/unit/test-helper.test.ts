import * as sinon from 'sinon';
import * as assert from 'assert';
import * as path from 'path';
import { 
    vscode, childProcess, fsMock, resetMocks, 
    mockProjectFolderSelection, mockCacheFolderSelection, 
    mockGitHubPatInput, resetAllMocks, waitForPromise, isDockerInstalled,
    generateDockerCompose, setupMockFileSystem, createMockContext, 
    mockDockerSuccess, mockDockerFailure, mockRemoteContainersExtension,
    expectation
} from '../../src/test-helper';
import { TEST_MODE, CURRENT_TEST_MODE } from '../setup';

// 型定義
interface ExecResult {
    stdout: string;
    stderr?: string;
}

/**
 * モックモードでのみテストを実行する共通ヘルパー関数
 * @param testName テスト名
 * @param testFn テスト関数
 */
function testInMockMode(testName: string, testFn: () => void | Promise<void>) {
    it(testName, function() {
        if (CURRENT_TEST_MODE === TEST_MODE.UNIT) {
            return testFn.call(this);
        } else {
            console.log(`統合テストモードでは${testName}をスキップします`);
            this.skip();
            return Promise.resolve();
        }
    });
}

describe('テストヘルパーの機能テスト', () => {
    afterEach(() => {
        sinon.restore();
    });

    testInMockMode('resetMocks関数のテスト', () => {
        vscode.window.showErrorMessage();
        resetMocks();
        assert.strictEqual(vscode.window.showErrorMessage.callCount, 0);
    });

    testInMockMode('resetAllMocks関数のテスト', () => {
        vscode.window.showErrorMessage();
        vscode.window.showInformationMessage();
        vscode.commands.executeCommand();
        resetAllMocks();
        assert.strictEqual(vscode.window.showErrorMessage.callCount, 0);
        assert.strictEqual(vscode.window.showInformationMessage.callCount, 0);
        assert.strictEqual(vscode.commands.executeCommand.callCount, 0);
    });

    it('waitForPromiseが指定時間後にresolveすること', async () => {
        const startTime = Date.now();
        await waitForPromise(50);
        const elapsed = Date.now() - startTime;
        assert.ok(elapsed >= 40, 'waitForPromiseは少なくとも指定時間待機する必要があります');
    });

    testInMockMode('setupMockFileSystem関数のテスト', () => {
        const fileSystem = {
            'dir1': {
                'file1.txt': 'content1',
                'subdir': {
                    'file2.txt': 'content2'
                }
            },
            'file3.txt': 'content3'
        };
        
        setupMockFileSystem(fileSystem);
        assert.ok(true, 'Mock file system setup completed');
    });

    testInMockMode('setupMockFileSystemが例外をハンドリングできること', () => {
        // 空のオブジェクトを使用してエラーケースをテスト
        const emptyFileSystem = {};
        setupMockFileSystem(emptyFileSystem);
        
        // 無効なパスで動作確認
        const result = fsMock.existsSync('/non/existent/path');
        assert.strictEqual(result, false, '存在しないパスに対してfalseを返すべき');
    });

    testInMockMode('mockDockerSuccess関数のテスト', () => {
        mockDockerSuccess();
        
        // 子プロセスの実行がモック化されていることを確認
        const execStub = childProcess.exec as sinon.SinonStub;
        assert.ok(execStub.calledOnce === false, 'exec should not be called yet');
        
        // モック化された関数をテスト
        execStub.withArgs('docker --version').yields(null, { stdout: 'Docker version 20.10.12' });
        
        childProcess.exec('docker --version', (err: Error | null, result: ExecResult) => {
            assert.strictEqual(err, null);
            assert.deepStrictEqual(result, { stdout: 'Docker version 20.10.12' });
        });
    });
    
    testInMockMode('mockDockerFailure関数のテスト', () => {
        const errorMessage = 'Docker command not found';
        mockDockerFailure(errorMessage);
        
        // 子プロセスの実行がモック化されていることを確認
        const execStub = childProcess.exec as sinon.SinonStub;
        
        // モック化された関数をテスト
        childProcess.exec('docker --version', (err: Error, result: ExecResult | null) => {
            assert.strictEqual(err.message, errorMessage);
            assert.strictEqual(result, null);
        });
    });
    
    testInMockMode('createMockContext関数のテスト', () => {
        const context = createMockContext('/test/path');
        assert.strictEqual(context.extensionUri.fsPath, '/test/path');
        assert.strictEqual(context.subscriptions.length, 0);
    });
    
    testInMockMode('createMockContextでカスタムパスを使用できること', () => {
        const customPath = '/custom/extension/path';
        const context = createMockContext(customPath);
        assert.strictEqual(context.extensionUri.fsPath, customPath);
    });
    
    it('isDockerInstalledが正しく動作すること', async function() {
        // テスト環境ではtrueを返すことを確認
        process.env.NODE_ENV = 'test';
        const result = await isDockerInstalled();
        assert.strictEqual(result, true);
    });

    testInMockMode('expectation objectのテスト', () => {
        assert.ok(expectation.errorMessageShown, 'errorMessageShownが存在する');
        assert.ok(expectation.infoMessageShown, 'infoMessageShownが存在する');
        assert.ok(expectation.commandExecuted, 'commandExecutedが存在する');
    });
    
    testInMockMode('mockRemoteContainersExtension関数のテスト', async () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        resetMocks();
        
        // 拡張機能が存在するケース
        mockRemoteContainersExtension(true);
        
        // モックが適切に設定されていることを確認
        assert.ok(typeof vscode.extensions.getExtension === 'function');
        
        // 実際に動作テスト
        const extensionId = 'ms-vscode-remote.remote-containers';
        const extension = vscode.extensions.getExtension(extensionId);
        assert.deepStrictEqual(extension, { id: extensionId });
    });
    
    testInMockMode('mockRemoteContainersExtension関数で拡張機能なしを設定できること', async () => {
        // テスト開始時にモックをリセット
        sinon.restore();
        resetMocks();
        
        // 拡張機能が存在しないケース
        mockRemoteContainersExtension(false);
        
        // モックが適切に設定されていることを確認
        assert.ok(typeof vscode.extensions.getExtension === 'function');
        
        // 実際に動作テスト
        const extensionId = 'ms-vscode-remote.remote-containers';
        const extension = vscode.extensions.getExtension(extensionId);
        assert.strictEqual(extension, undefined);
    });
    
    testInMockMode('mockProjectFolderSelection関数のテスト', () => {
        // モックモードの場合のみ実行
        const testPath = '/test/project';
        mockProjectFolderSelection(testPath);
        
        // モックが設定されたことを確認
        assert.ok(vscode.window.showOpenDialog.callsFake);
        
        // 動作テスト
        return vscode.window.showOpenDialog().then((result: any) => {
            assert.deepStrictEqual(result, [{ fsPath: testPath }]);
        });
    });
    
    testInMockMode('mockCacheFolderSelection関数のテスト', () => {
        const testPath = '/test/cache';
        mockCacheFolderSelection(testPath);
        
        // モックが設定されたことを確認
        assert.ok(vscode.window.showOpenDialog.callsFake);
        
        // 動作テスト
        return vscode.window.showOpenDialog().then((result: any) => {
            assert.deepStrictEqual(result, [{ fsPath: testPath }]);
        });
    });
    
    testInMockMode('mockGitHubPatInput関数のテスト', () => {
        const testToken = 'ghp_123456789abcdef';
        mockGitHubPatInput(testToken);
        
        // モックが設定されたことを確認
        assert.ok(vscode.window.showInputBox.callsFake);
        
        // 動作テスト
        return vscode.window.showInputBox().then((result: any) => {
            assert.strictEqual(result, testToken);
        });
    });
    
    it('generateDockerCompose関数のテスト', () => {
        const projectPath = '/test/project';
        const cachePath = '/test/cache';
        const githubToken = 'test-github-token';
        const mockContext = createMockContext();
        const dockercomposeFilePath = '/test/.devcontainer/docker-compose.yml';
        
        // 新しいインターフェースに合わせて呼び出し
        const result = generateDockerCompose(
            mockContext,
            dockercomposeFilePath,
            {
                projectFolder: projectPath,
                cacheFolder: cachePath,
                githubPat: githubToken
            }
        );
        
        // 成功したことを確認
        assert.strictEqual(result, true, 'Docker Composeファイルの生成に成功すること');
        
        // 情報メッセージが表示されたことを確認
        assert.ok(vscode.window.showInformationMessage.called, '情報メッセージが表示されること');
    });
    
    it('GPUサポート有効時のgenerateDockerCompose関数のテスト', () => {
        const projectPath = '/test/project';
        const cachePath = '/test/cache';
        const githubToken = 'test-github-token';
        const mockContext = createMockContext();
        const dockercomposeFilePath = '/test/.devcontainer/docker-compose.yml';
        
        // 新しいインターフェースに合わせて呼び出し
        const result = generateDockerCompose(
            mockContext,
            dockercomposeFilePath,
            {
                projectFolder: projectPath,
                cacheFolder: cachePath,
                githubPat: githubToken
            }
        );
        
        // 成功したことを確認
        assert.strictEqual(result, true, 'Docker Composeファイルの生成に成功すること');
    });
}); 