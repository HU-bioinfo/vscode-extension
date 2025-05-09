import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as sinon from 'sinon';
import assert from 'assert';
import * as vscodeTypes from 'vscode';

// 環境変数でモックモードと統合テストモードを切り替え
const USE_MOCK = process.env.VSCODE_MOCK === '1';
console.log(`テストヘルパー: ${USE_MOCK ? 'モックモード' : '実際のVS Code APIを使用'}`);

// テスト用にvscodeの型定義を提供
interface VSCodeNamespace {
    window: {
        showInformationMessage: any;
        showErrorMessage: any;
        showInputBox: any;
        showOpenDialog: any;
        activeTerminal: any;
        createOutputChannel?: any;
        showWarningMessage?: any;
    };
    commands: {
        executeCommand: any;
        registerCommand: any;
    };
    extensions: {
        getExtension: any;
    };
    env: {
        openExternal: any;
    };
    Uri: any;
    ExtensionContext: any;
    workspace?: any;
}

let vscodeModule: VSCodeNamespace;

// モックモードの場合はモックを使用、そうでない場合は実際のVS Code APIを使用
if (USE_MOCK) {
    // モックモード - Sinonスタブを使用
    vscodeModule = {
        window: {
            showInformationMessage: sinon.stub(),
            showErrorMessage: sinon.stub(),
            showInputBox: sinon.stub(),
            showOpenDialog: sinon.stub(),
            activeTerminal: null,
            createOutputChannel: sinon.stub().returns({
                appendLine: sinon.stub(),
                append: sinon.stub(),
                show: sinon.stub(),
                dispose: sinon.stub()
            }),
            showWarningMessage: sinon.stub()
        },
        commands: {
            executeCommand: sinon.stub(),
            registerCommand: sinon.stub()
        },
        extensions: {
            getExtension: sinon.stub()
        },
        env: {
            openExternal: sinon.stub()
        },
        Uri: {
            file: sinon.stub(),
            parse: sinon.stub(),
            joinPath: sinon.stub()
        },
        ExtensionContext: {},
        workspace: {
            getConfiguration: sinon.stub().returns({
                get: sinon.stub(),
                update: sinon.stub()
            }),
            workspaceFolders: []
        }
    };
} else {
    // 統合テストモード - 実際のVS Code APIを使用
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        vscodeModule = require('vscode');
        console.log('実際のVS Code APIを読み込みました');
    } catch (error) {
        console.error('VS Code APIの読み込みに失敗しました:', error);
        // エラー時はモックにフォールバック
        vscodeModule = {
            window: {
                showInformationMessage: () => Promise.resolve(undefined),
                showErrorMessage: () => Promise.resolve(undefined),
                showInputBox: () => Promise.resolve(undefined),
                showOpenDialog: () => Promise.resolve(undefined),
                activeTerminal: null
            },
            commands: {
                executeCommand: () => Promise.resolve(undefined),
                registerCommand: () => ({ dispose: () => {} })
            },
            extensions: {
                getExtension: () => undefined
            },
            env: {
                openExternal: () => Promise.resolve(false)
            },
            Uri: {
                file: (path: string) => ({ fsPath: path }),
                parse: (uri: string) => ({ toString: () => uri }),
                joinPath: (...args: any[]) => ({ fsPath: args.join('/') })
            },
            ExtensionContext: {}
        };
    }
}

// vscodeをエクスポート
export const vscode = vscodeModule;

// テスト用の拡張機能コンテキスト型
interface ExtensionContext {
    subscriptions: Array<{ dispose(): any }>;
    extensionUri: { fsPath: string };
    globalStorageUri: { fsPath: string };
    // グローバルステート（設定リセットテスト用）
    globalState?: {
        update: sinon.SinonStub;
        get?: sinon.SinonStub;
    };
}

const execPromise = promisify(exec);

// エラーハンドリングのテスト用に内部関数を公開
export {
    showDockerNotInstalledError,
    checkDockerPermissions,
    showDockerPermissionError,
    setupDevContainer,
    openFolderInContainer
};

// VSCodeモジュールのモックを提供するヘルパーファイル

// VSCodeの基本的なAPIをモックしたオブジェクト
export const mockVscode = {
  window: {
    showInformationMessage: sinon.stub(),
    showErrorMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    createOutputChannel: sinon.stub().returns({
      appendLine: sinon.stub(),
      append: sinon.stub(),
      show: sinon.stub(),
      dispose: sinon.stub()
    }),
    showQuickPick: sinon.stub(),
    showInputBox: sinon.stub()
  },
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub()
  },
  workspace: {
    getConfiguration: sinon.stub().returns({
      get: sinon.stub(),
      update: sinon.stub()
    }),
    workspaceFolders: []
  },
  extensions: {
    getExtension: sinon.stub()
  },
  ExtensionContext: function() {
    return {
      subscriptions: [],
      extensionPath: '/mock/extension/path',
      globalState: {
        get: sinon.stub(),
        update: sinon.stub()
      },
      workspaceState: {
        get: sinon.stub(),
        update: sinon.stub()
      }
    };
  }
};

// VSCodeモジュールの代わりにモックを設定
// typescriptではこの実装方法は少し違います
// jest.mock('vscode', () => mockVscode, { virtual: true });

// テストユーティリティ関数
export function resetAllMocks() {
  // モックモードの場合のみモックをリセット
  if (USE_MOCK) {
    // すべてのモック関数をリセット
    sinon.reset();
    
    // 特定のメソッドを明示的にリセット
    if (vscode.window.showErrorMessage?.resetHistory) {
      vscode.window.showErrorMessage.resetHistory();
    }
    if (vscode.window.showInformationMessage?.resetHistory) {
      vscode.window.showInformationMessage.resetHistory();
    }
    if (vscode.commands.executeCommand?.resetHistory) {
      vscode.commands.executeCommand.resetHistory();
    }
    if (vscode.extensions.getExtension?.resetHistory) {
      vscode.extensions.getExtension.resetHistory();
    }
    // 必要に応じて他のメソッドもリセット
  } else {
    // 統合テストモードではリセット不要（実際のAPIを使用）
    console.log('統合テストモードではモックをリセットしません');
  }
}

// 非同期処理のテスト用ユーティリティ
export function waitForPromise(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Dockerがインストールされているかを確認する関数
export async function isDockerInstalled(): Promise<boolean> {
  // テスト中は常にtrueを返す
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  // 実際の実装（テスト対象外）
  try {
    await execPromise('docker --version');
    return true;
  } catch (error) {
    return false;
  }
}

// Dockerがインストールされていない場合のエラーメッセージを表示
function showDockerNotInstalledError() {
    const message = 'Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
    const installButton = 'インストールガイド';
    
    vscodeModule.window.showErrorMessage(message, installButton).then((selection: string | undefined) => {
        if (selection === installButton) {
            vscodeModule.env.openExternal(vscodeModule.Uri.parse('https://docs.docker.com/get-docker/'));
        }
    });
}

// Dockerの権限を確認する関数
async function checkDockerPermissions(): Promise<boolean> {
    try {
        await execPromise('docker info');
        return true;
    } catch (error) {
        // エラーメッセージに権限関連の文字列が含まれているか確認
        const errorMessage = (error as Error).toString().toLowerCase();
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('access')) {
            return false;
        }
        // 他のエラーの場合はDockerの問題ではない可能性があるため、インストールされていない扱いにする
        return false;
    }
}

// Dockerの権限エラーの場合のメッセージを表示
function showDockerPermissionError() {
    const message = 'Dockerの実行権限がありません。';
    const helpButton = '対処方法を確認';
    
    let helpMessage = '';
    if (os.platform() === 'linux') {
        helpMessage = 'ユーザーをdockerグループに追加してください: sudo usermod -aG docker $USER\nその後、ログアウトして再度ログインしてください。';
    } else if (os.platform() === 'darwin') {
        helpMessage = 'macOSでDockerの権限エラーが発生した場合は、Docker Desktopを再起動してみてください。';
    } else {
        helpMessage = 'Dockerの実行権限を確認してください。管理者権限で実行するか、適切なユーザー権限を設定してください。';
    }
    
    vscodeModule.window.showErrorMessage(message, helpButton).then((selection: string | undefined) => {
        if (selection === helpButton) {
            vscode.window.showInformationMessage(helpMessage);
        }
    });
}

function setupDevContainer(context: ExtensionContext, targetPath: string, cacheDirPath: string = '/test/cache', projectsDirPath: string = '/test/project') {
    // モックモードではファイルはコピーしないがログは出力
    console.log(`[TEST] setupDevContainer called with targetPath=${targetPath}, cacheDirPath=${cacheDirPath}, projectsDirPath=${projectsDirPath}`);
    
    // 実際のファイルシステム操作はテスト中はモックするか、省略する
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }
    
    // 操作成功をシミュレート
    vscodeModule.window.showInformationMessage("devcontainer設定を作成しました");
    
    // 非同期操作をシミュレートするためにPromiseを返す
    return Promise.resolve();
}

function openFolderInContainer(folderPath: string) {
    const folderUri = vscode.Uri.file(folderPath);
    console.log(`[TEST] openFolderInContainer called with folderPath=${folderPath}`);
    
    // テスト環境では操作をシミュレート
    console.log(`[TEST] Would open folder as regular folder first: ${folderPath}`);
    console.log(`[TEST] Then would reopen in container`);
    
    // 成功をシミュレート
    vscodeModule.window.showInformationMessage("コンテナで開発環境を起動しました");
    
    // Promiseを返す
    return Promise.resolve();
}

// プロジェクトテンプレートを展開する関数
export async function setupProjectTemplate(context: any, projectFolder: string): Promise<boolean> {
  console.log(`[TEST] setupProjectTemplate called with projectFolder=${projectFolder}`);
  
  // テスト環境ではファイルシステム操作をスキップする
  if (process.env.NODE_ENV !== 'test') {
    // ディレクトリ作成をシミュレート
    if (!fs.existsSync(projectFolder)) {
      fs.mkdirSync(projectFolder, { recursive: true });
    }
  } else {
    // テスト環境では成功したとみなす
    console.log(`[TEST] would create directory: ${projectFolder}`);
  }
  
  // 成功をシミュレート
  vscodeModule.window.showInformationMessage("プロジェクトテンプレートを展開しました");
  
  return true;
}

// Docker Composeテンプレートを生成する関数 (テスト用シンプル実装)
export function generateDockerCompose(
  context: any,
  dockercomposeFilePath: string, 
  config: {projectFolder: string, cacheFolder: string, githubPat: string}
): boolean {
  console.log(`[TEST] generateDockerCompose called with:
    dockercomposeFilePath=${dockercomposeFilePath}
    projectFolder=${config.projectFolder}
    cacheFolder=${config.cacheFolder}
    githubPat=${config.githubPat}`);
  
  // Windows形式のパスをUNIX形式に変換
  const normalizedProjectPath = config.projectFolder.replace(/\\/g, '/');
  const normalizedCachePath = config.cacheFolder.replace(/\\/g, '/');
  
  const composeContent = `version: '3'
services:
  workspace:
    image: hubioinfows/base_env:latest
    volumes:
      - "${normalizedProjectPath}:/workspace"
      - "${normalizedCachePath}:/cache"
    environment:
      - GITHUB_TOKEN=${config.githubPat}
    command: sleep infinity`;
  
  // テスト環境ではファイルシステム操作をスキップする
  if (process.env.NODE_ENV !== 'test') {
    // テスト目的で出力ディレクトリが存在するか確認
    if (!fs.existsSync(path.dirname(dockercomposeFilePath))) {
      fs.mkdirSync(path.dirname(dockercomposeFilePath), { recursive: true });
    }
  } else {
    // テスト環境では成功したとみなす
    console.log(`[TEST] would create directory: ${path.dirname(dockercomposeFilePath)}`);
  }
  
  // ファイルシステム操作は実際には行わないがシミュレート
  console.log(`[TEST] Would write content to ${dockercomposeFilePath}`);
  
  // 成功をシミュレート
  vscodeModule.window.showInformationMessage("Docker Compose設定を生成しました");
  
  return true;
}

function copyFolderRecursiveSync(source: string, target: string) {
    if (!fs.existsSync(source)) {return;}
    if (!fs.existsSync(target)) {fs.mkdirSync(target, { recursive: true });}

    const files = fs.readdirSync(source);
    for (const file of files) {
        const srcPath = path.join(source, file);
        const destPath = path.join(target, file);
        if (fs.lstatSync(srcPath).isDirectory()) {
            copyFolderRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

export function createMockVscodeModule() {
  return mockVscode;
}

// child_processモジュールのモック化
export const childProcess = {
    exec: sinon.stub().callsFake((cmd, callback) => {
        if (callback && typeof callback === 'function') {
            callback(null, { stdout: 'success', stderr: '' }, '');
        }
        return {
            on: sinon.stub(),
            stdout: { on: sinon.stub() },
            stderr: { on: sinon.stub() }
        };
    })
};

// fsモジュールのモック化
export const fsMock = {
    existsSync: sinon.stub().returns(true),
    mkdirSync: sinon.stub(),
    writeFileSync: sinon.stub(),
    readFileSync: sinon.stub().returns(''),
    readdirSync: sinon.stub().returns([]),
    copyFileSync: sinon.stub(),
    lstatSync: sinon.stub().returns({ 
        isDirectory: sinon.stub().returns(false)
    })
};

// VSCodeモックのリセット（主要なメソッドのみ）
export function resetMocks() {
  if (USE_MOCK) {
    // モックモードの場合のみモックをリセット
    // VSCodeメソッドのモックリセット
    if (vscode.window.showErrorMessage?.resetHistory) {
      vscode.window.showErrorMessage.resetHistory();
    }
    if (vscode.window.showInformationMessage?.resetHistory) {
      vscode.window.showInformationMessage.resetHistory();
    }
    
    // デフォルト動作を再設定
    initializeDefaultStubs();
  } else {
    // 統合テストモードではリセット不要
    console.log('統合テストモードではモックをリセットしません');
  }
}

// デフォルトのスタブ値を初期化する補助関数
function initializeDefaultStubs() {
    // VSCode関連のスタブ初期化
    vscodeModule.window.showErrorMessage.returns(Promise.resolve(undefined));
    vscodeModule.window.showInformationMessage.returns(Promise.resolve(undefined));
    vscodeModule.window.showInputBox.returns(Promise.resolve(''));
    vscodeModule.window.showOpenDialog.returns(Promise.resolve(undefined));
    vscodeModule.commands.executeCommand.returns(Promise.resolve(undefined));
    
    // ファイルシステムのデフォルト値
    fsMock.existsSync.returns(true);
    fsMock.readFileSync.returns('');
    fsMock.readdirSync.returns([]);
    fsMock.lstatSync.returns({ isDirectory: sinon.stub().returns(false) });
    
    // 子プロセスの実行結果
    childProcess.exec.callsFake((cmd, callback) => {
        if (callback && typeof callback === 'function') {
            callback(null, { stdout: 'success', stderr: '' }, '');
        }
        return {
            on: sinon.stub(),
            stdout: { on: sinon.stub() },
            stderr: { on: sinon.stub() }
        };
    });
}

// VSCodeのモックコンテキストを作成する関数
export function createMockContext(extensionPath = '/extension/path') {
    return {
        extensionUri: { fsPath: extensionPath },
        globalStorageUri: { fsPath: '/storage/path' },
        subscriptions: [],
        globalState: {
            update: sinon.stub().resolves(),
            get: sinon.stub().returns(undefined)
        }
    };
}

// Dockerコマンドの成功をモックする
export function mockDockerSuccess() {
    childProcess.exec.callsFake((cmd, callback) => {
        if (cmd.includes('docker') && callback && typeof callback === 'function') {
            callback(null, { stdout: 'Docker is running', stderr: '' }, '');
        }
        return {
            on: sinon.stub(),
            stdout: { on: sinon.stub() },
            stderr: { on: sinon.stub() }
        };
    });
}

// Dockerコマンドの失敗をモックする
export function mockDockerFailure(errorMsg = 'Docker command failed') {
  // テスト間でのスタブの継承を防ぐためにすべてのモックをリセット
  sinon.restore();
  
  // child_processのexecを新しく設定
  childProcess.exec = sinon.stub();
  const error = new Error(errorMsg);

  // すべてのDockerコマンドに対して、エラーを返すように設定
  childProcess.exec.callsFake((command: string, options: any, callback: any) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    if (command.includes('docker')) {
      if (callback) {
        callback(error, null);
      }
      return { error: error };
    }

    // Dockerコマンド以外は正常に実行
    if (callback) {
      callback(null, { stdout: 'Success' });
    }
    return { error: null };
  });

  return childProcess.exec;
}

// プロジェクトフォルダ選択のモック
export function mockProjectFolderSelection(folderPath = '/test/project') {
    // モックモードの場合のみStubを操作
    if (USE_MOCK) {
        // 既存のモックをリセット
        vscode.window.showOpenDialog.reset();
        vscode.window.showOpenDialog.resolves([{ fsPath: folderPath }]);
        
        // コールバック関数を適切に設定
        vscode.window.showOpenDialog.callsFake((options: vscodeTypes.OpenDialogOptions) => {
            return Promise.resolve([{ fsPath: folderPath }]);
        });
    } else {
        console.log('統合テストモードではmockProjectFolderSelectionは実際には何もしません');
    }
}

// キャッシュフォルダ選択のモック
export function mockCacheFolderSelection(folderPath = '/test/cache') {
    // モックモードの場合のみStubを操作
    if (USE_MOCK) {
        // 既存のモックをリセット
        vscode.window.showOpenDialog.reset();
        vscode.window.showOpenDialog.resolves([{ fsPath: folderPath }]);
        
        // コールバック関数を適切に設定
        vscode.window.showOpenDialog.callsFake((options: vscodeTypes.OpenDialogOptions) => {
            return Promise.resolve([{ fsPath: folderPath }]);
        });
    } else {
        console.log('統合テストモードではmockCacheFolderSelectionは実際には何もしません');
    }
}

// GitHub PATの入力モック
export function mockGitHubPatInput(pat = 'fake-github-pat') {
    // モックモードの場合のみStubを操作
    if (USE_MOCK) {
        // 既存のモックをリセット
        vscode.window.showInputBox.reset();
        vscode.window.showInputBox.resolves(pat);
        
        // 明示的にスタブを設定
        vscode.window.showInputBox.callsFake((options: vscodeTypes.InputBoxOptions) => {
            return Promise.resolve(pat);
        });
    } else {
        console.log('統合テストモードではmockGitHubPatInputは実際には何もしません');
    }
}

// Remote Containers拡張機能の有無をモック
export function mockRemoteContainersExtension(installed = true) {
    // モックモードの場合のみStubを操作
    if (USE_MOCK) {
        // 既存のモックをリセット
        vscode.extensions.getExtension.reset();
        
        // 明示的にスタブを設定
        vscode.extensions.getExtension.callsFake((extensionId: string) => {
            if (extensionId === 'ms-vscode-remote.remote-containers') {
                return installed ? { id: 'ms-vscode-remote.remote-containers' } : undefined;
            }
            return undefined;
        });
    } else {
        console.log('統合テストモードではmockRemoteContainersExtensionは実際には何もしません');
    }
}

// アサーション用のヘルパー
export const expectation = {
    // エラーメッセージが表示されたことを確認
    errorMessageShown: (message: string) => {
        assert.ok(vscodeModule.window.showErrorMessage.calledWith(
            sinon.match(message)
        ), `Error message "${message}" was not shown`);
    },
    
    // 情報メッセージが表示されたことを確認
    infoMessageShown: (message: string) => {
        assert.ok(vscodeModule.window.showInformationMessage.calledWith(
            sinon.match(message)
        ), `Info message "${message}" was not shown`);
    },
    
    // コマンドが実行されたことを確認
    commandExecuted: (command: string, ...args: any[]) => {
        assert.ok(vscodeModule.commands.executeCommand.calledWith(
            command, ...args
        ), `Command "${command}" was not executed`);
    },
    
    // Dockerコマンドが実行されたことを確認
    dockerCommandExecuted: (command: string) => {
        assert.ok(childProcess.exec.calledWith(
            sinon.match(command)
        ), `Docker command "${command}" was not executed`);
    },
    
    // ファイルが作成されたことを確認
    fileCreated: (filePath: string, content?: string) => {
        assert.ok(fsMock.writeFileSync.calledWith(
            sinon.match(filePath),
            content ? sinon.match(content) : sinon.match.any
        ), `File "${filePath}" was not created`);
    }
};

// ダミーファイルシステムをセットアップする関数
export function setupMockFileSystem(structure: Record<string, any>) {
    fsMock.existsSync.callsFake((filePath: string) => {
        let current = structure;
        const parts = filePath.split(path.sep).filter(Boolean);
        
        for (const part of parts) {
            if (!current[part]) {return false;}
            current = current[part];
        }
        
        return true;
    });
    
    fsMock.readdirSync.callsFake((dirPath: string) => {
        let current = structure;
        const parts = dirPath.split(path.sep).filter(Boolean);
        
        for (const part of parts) {
            if (!current[part]) {return [];}
            current = current[part];
        }
        
        return Object.keys(current);
    });
    
    fsMock.lstatSync.callsFake((filePath: string) => {
        let current = structure;
        const parts = filePath.split(path.sep).filter(Boolean);
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {return { isDirectory: () => false };}
            current = current[parts[i]];
        }
        
        const lastPart = parts[parts.length - 1];
        const isDir = typeof current[lastPart] === 'object';
        
        return {
            isDirectory: () => isDir
        };
    });
}

// 親ディレクトリを選択する
export async function selectParentDirectory(): Promise<any> {
  console.log(`[TEST] selectParentDirectory called`);
  
  // モック環境では常に成功するように定義されたパスを返す
  return { fsPath: '/test/parent' };
}

// GitHub PATを入力する
export async function inputGitHubPAT(): Promise<string> {
  console.log(`[TEST] inputGitHubPAT called`);
  
  // モック環境では常に成功するようにテスト用のトークンを返す
  return 'test-github-pat';
}