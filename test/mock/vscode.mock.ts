/**
 * VSCode APIのモックモジュール
 * 
 * このモジュールは、VS Code拡張機能のテスト時にVS Code APIをモック化するためのものです。
 * require('vscode')の代わりとして使用し、テスト環境での依存性を解決します。
 */

import * as sinon from 'sinon';

class Uri {
    static file(path: string): any {
        return {
            fsPath: path,
            scheme: 'file'
        };
    }

    static parse(uri: string): any {
        return {
            toString: () => uri,
            fsPath: uri.replace(/^file:\/\//, '')
        };
    }

    static joinPath(uri: any, ...pathSegments: string[]): any {
        const base = uri.fsPath || '';
        return {
            fsPath: `${base}/${pathSegments.join('/')}`.replace(/\/\//g, '/'),
            scheme: uri.scheme || 'file'
        };
    }
}

const window = {
    showInformationMessage: sinon.stub().resolves(),
    showErrorMessage: sinon.stub().resolves(),
    showWarningMessage: sinon.stub().resolves(),
    showInputBox: sinon.stub().resolves(),
    showOpenDialog: sinon.stub().resolves([]),
    createTerminal: sinon.stub().returns({
        sendText: sinon.stub(),
        show: sinon.stub(),
        dispose: sinon.stub()
    }),
    createOutputChannel: sinon.stub().returns({
        appendLine: sinon.stub(),
        append: sinon.stub(),
        show: sinon.stub(),
        dispose: sinon.stub(),
        clear: sinon.stub()
    }),
    activeTerminal: null,
    terminals: [],
    onDidChangeActiveTerminal: sinon.stub()
};

const workspace = {
    getConfiguration: sinon.stub().returns({
        get: sinon.stub(),
        update: sinon.stub().resolves(),
        has: sinon.stub().returns(true)
    }),
    workspaceFolders: [],
    openTextDocument: sinon.stub().resolves({
        getText: sinon.stub().returns(''),
        save: sinon.stub().resolves(true),
        fileName: '',
        lineAt: sinon.stub().returns({ text: '' })
    }),
    onDidChangeTextDocument: sinon.stub(),
    applyEdit: sinon.stub().resolves(true),
    onDidSaveTextDocument: sinon.stub()
};

const commands = {
    registerCommand: sinon.stub().returns({
        dispose: sinon.stub()
    }),
    executeCommand: sinon.stub().resolves()
};

const env = {
    openExternal: sinon.stub().resolves(true),
    clipboard: {
        writeText: sinon.stub()
    },
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
    language: 'ja'
};

const extensions = {
    getExtension: sinon.stub().returns(undefined),
    all: []
};

// Context mocks
class ExtensionContext {
    subscriptions: Array<{ dispose(): any }>;
    extensionPath: string;
    extensionUri: any;
    globalStorageUri: any;
    workspaceState: any;
    globalState: any;
    secrets: any;
    extensionMode: number;
    environmentVariableCollection: any;

    constructor(extensionPath = '/extension/path') {
        this.subscriptions = [];
        this.extensionPath = extensionPath;
        this.extensionUri = Uri.file(extensionPath);
        this.globalStorageUri = Uri.file(`${extensionPath}/globalStorage`);
        this.workspaceState = {
            get: sinon.stub(),
            update: sinon.stub().resolves()
        };
        this.globalState = {
            get: sinon.stub(),
            update: sinon.stub().resolves(),
            setKeysForSync: sinon.stub()
        };
        this.secrets = {
            get: sinon.stub().resolves(''),
            store: sinon.stub().resolves(),
            delete: sinon.stub().resolves()
        };
        this.extensionMode = 1; // Development
        this.environmentVariableCollection = {
            persistent: false,
            replace: sinon.stub(),
            append: sinon.stub(),
            prepend: sinon.stub(),
            get: sinon.stub(),
            forEach: sinon.stub(),
            delete: sinon.stub(),
            clear: sinon.stub()
        };
    }
}

const ThemeColor = function(id: string) {
    return { id };
};

const ThemeIcon = function(id: string, color?: any) {
    return { id, color };
};

// Export mock VSCode API
export default {
    window,
    workspace,
    commands,
    env,
    extensions,
    Uri,
    ExtensionContext,
    ThemeColor,
    ThemeIcon,
    // Event関連
    EventEmitter: class {
        event: any;
        constructor() {
            this.event = () => ({ dispose: () => {} });
        }
        fire() {}
        dispose() {}
    },
    // 各種定数
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ViewColumn: {
        Active: -1,
        Beside: -2,
        One: 1,
        Two: 2,
        Three: 3
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    }
}; 