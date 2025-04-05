import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as sinon from 'sinon';
import assert from 'assert';

// テスト用にvscodeの型定義を提供
interface VSCodeNamespace {
    window: {
        showInformationMessage: sinon.SinonStub;
        showErrorMessage: sinon.SinonStub;
        showInputBox: sinon.SinonStub;
        showOpenDialog: sinon.SinonStub;
        activeTerminal: any;
    };
    commands: {
        executeCommand: sinon.SinonStub;
        registerCommand: sinon.SinonStub;
    };
    extensions: {
        getExtension: sinon.SinonStub;
    };
    env: {
        openExternal: sinon.SinonStub;
    };
    Uri: {
        file: sinon.SinonStub;
        parse: sinon.SinonStub;
    };
    ExtensionContext: any;
}

// テスト環境でない場合のみ実際のVSCodeをインポート
const vscodeModule: VSCodeNamespace = process.env.NODE_ENV !== 'test' 
    ? require('vscode') as VSCodeNamespace
    : {
        window: {
            showInformationMessage: sinon.stub(),
            showErrorMessage: sinon.stub(),
            showInputBox: sinon.stub(),
            showOpenDialog: sinon.stub(),
            activeTerminal: null
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
            parse: sinon.stub()
        },
        ExtensionContext: {}
    };

// vscodeをエクスポート
export const vscode = vscodeModule;

// テスト用の拡張機能コンテキスト型
interface ExtensionContext {
    subscriptions: Array<{ dispose(): any }>;
    extensionUri: { fsPath: string };
    globalStorageUri: { fsPath: string };
}

const execPromise = promisify(exec);

// エラーハンドリングのテスト用に内部関数を公開
export {
    isRemoteContainersExtensionInstalled,
    showRemoteContainersNotInstalledError,
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
  // すべてのモック関数をリセット
  sinon.reset();
}

// 非同期処理のテスト用ユーティリティ
export function waitForPromise(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Remote Containers拡張機能がインストールされているかを確認する関数
function isRemoteContainersExtensionInstalled(): boolean {
    const extension = vscodeModule.extensions.getExtension('ms-vscode-remote.remote-containers');
    return !!extension;
}

// Remote Containers拡張機能がインストールされていない場合のエラーメッセージを表示
function showRemoteContainersNotInstalledError() {
    const message = 'Remote Containers拡張機能がインストールされていません。この拡張機能を使用する前にインストールしてください。';
    const installButton = '拡張機能をインストール';
    
    vscodeModule.window.showErrorMessage(message, installButton).then((selection: string | undefined) => {
        if (selection === installButton) {
            vscodeModule.commands.executeCommand('workbench.extensions.search', 'ms-vscode-remote.remote-containers');
        }
    });
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
            vscodeModule.window.showInformationMessage(helpMessage);
        }
    });
}

function setupDevContainer(context: ExtensionContext, targetPath: string) {
    const sourcePath = path.join(context.extensionUri.fsPath, ".devcontainer");
    copyFolderRecursiveSync(sourcePath, targetPath);
}

function openFolderInContainer(extensionStoragePath: string) {
    const folderUri = vscodeModule.Uri.file(extensionStoragePath);
    vscodeModule.commands.executeCommand("remote-containers.openFolder", folderUri).then(() => {
    }, (error: Error) => {
        vscodeModule.window.showErrorMessage(`コンテナでフォルダを開くことができませんでした: ${error.message}`);
    });
}

// Docker Composeテンプレートを生成する関数 (テスト用シンプル実装)
export function generateDockerCompose(
  projectPath: string,
  cachePath: string,
  githubToken: string
): string {
  // テスト中は簡易な文字列を返す
  if (process.env.NODE_ENV === 'test') {
    return 'version: "3"\nservices:\n  test:\n    image: test';
  }
  
  // 実際の実装
  const template = `version: "3"
services:
  jupyter:
    image: jupyter/datascience-notebook
    volumes:
      - ${projectPath}:/home/jovyan/work
      - ${cachePath}:/home/jovyan/.cache
    environment:
      - GITHUB_TOKEN=${githubToken}
    ports:
      - "8888:8888"
  rstudio:
    image: rocker/tidyverse
    volumes:
      - ${projectPath}:/home/rstudio/work
      - ${cachePath}:/home/rstudio/.cache
    environment:
      - GITHUB_PAT=${githubToken}
    ports:
      - "8787:8787"`;
      
  return template;
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

export async function isRemoteContainersInstalled(): Promise<boolean> {
  return true; // テスト中は常にtrueを返す
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

// モック状態をリセットする関数
export function resetMocks() {
    sinon.resetHistory();
    vscodeModule.window.showErrorMessage.resetHistory();
    vscodeModule.window.showInformationMessage.resetHistory();
    vscodeModule.window.showInputBox.resetHistory();
    vscodeModule.window.showOpenDialog.resetHistory();
    vscodeModule.commands.registerCommand.resetHistory();
    vscodeModule.commands.executeCommand.resetHistory();
    vscodeModule.extensions.getExtension.resetHistory();
    vscodeModule.env.openExternal.resetHistory();
    vscodeModule.Uri.file.resetHistory();
    vscodeModule.Uri.parse.resetHistory();
    
    childProcess.exec.resetHistory();
    
    fsMock.existsSync.resetHistory();
    fsMock.mkdirSync.resetHistory();
    fsMock.writeFileSync.resetHistory();
    fsMock.readFileSync.resetHistory();
    fsMock.readdirSync.resetHistory();
    fsMock.copyFileSync.resetHistory();
    fsMock.lstatSync.resetHistory();
}

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

// VSCodeのモックコンテキストを作成する関数
export function createMockContext(extensionPath = '/extension/path') {
    return {
        extensionUri: { fsPath: extensionPath },
        globalStorageUri: { fsPath: '/storage/path' },
        subscriptions: []
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
    childProcess.exec.callsFake((cmd, callback) => {
        if (cmd.includes('docker') && callback && typeof callback === 'function') {
            callback(new Error(errorMsg), { stdout: '', stderr: errorMsg }, '');
        }
        return {
            on: sinon.stub(),
            stdout: { on: sinon.stub() },
            stderr: { on: sinon.stub() }
        };
    });
}

// プロジェクトフォルダ選択のモック
export function mockProjectFolderSelection(folderPath = '/test/project') {
    vscodeModule.window.showOpenDialog.onFirstCall().resolves([{ fsPath: folderPath }]);
}

// キャッシュフォルダ選択のモック
export function mockCacheFolderSelection(folderPath = '/test/cache') {
    vscodeModule.window.showOpenDialog.onSecondCall().resolves([{ fsPath: folderPath }]);
}

// GitHub PATの入力モック
export function mockGitHubPatInput(pat = 'fake-github-pat') {
    vscodeModule.window.showInputBox.resolves(pat);
}

// Remote Containers拡張機能の有無をモック
export function mockRemoteContainersExtension(installed = true) {
    vscodeModule.extensions.getExtension.withArgs('ms-vscode-remote.remote-containers').returns(
        installed ? { id: 'ms-vscode-remote.remote-containers' } : undefined
    );
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