/**
 * VSCode拡張機能テスト用のモジュールローダー
 * 
 * このユーティリティは、proxyquireを使用してmodule.requireを上書きし、
 * テスト時にvscodeモジュールをモック化したものに置き換えます。
 */

// proxyquireを正しくインポート
import proxyquire from 'proxyquire';
import * as vscodeMockObject from '../mock/vscode.mock';
import * as sinon from 'sinon';

/**
 * テスト用モックオブジェクトの構造を定義
 */
export interface MockObjects {
    [key: string]: any;
}

/**
 * VSCodeモジュールをモック化したうえで、指定されたモジュールを読み込みます
 * @param modulePath 読み込むモジュールのパス
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたモジュール
 */
export function loadModuleWithVSCodeMock(modulePath: string, additionalStubs: Record<string, any> = {}): any {
    // 環境変数でVSCODE_MOCKが設定されているか確認
    const isMockMode = process.env.VSCODE_MOCK === '1';
    console.log(`テストヘルパー: ${isMockMode ? 'モックモード' : '実モード'}`);
    console.log(`テストモード: ${process.env.NODE_ENV === 'test' ? 'ユニットテスト' : '統合テスト'}`);
    console.log('');

    // vscodeモジュールとその他のスタブを結合
    const stubs = {
        'vscode': vscodeMockObject,
        ...additionalStubs
    };
    
    try {
        // proxyquireのオプション設定とモジュール読み込み
        const noCallThru = proxyquire.noCallThru();
        return noCallThru(modulePath, stubs);
    } catch (error) {
        console.error(`モジュールのロードに失敗: ${modulePath}`, error);
        throw error;
    }
}

/**
 * デフォルトのモックオブジェクトを取得する
 * 多くのモジュールで共通して使われる依存関係のモックを提供
 */
export function getDefaultMocks(): MockObjects {
    // 重要: ここではsinonのstubを使う代わりに、直接メソッドを定義したモックオブジェクトを作成
    return {
        'fs': {
            existsSync: sinon.stub().returns(true),
            mkdirSync: sinon.stub(),
            writeFileSync: sinon.stub(),
            readFileSync: sinon.stub().returns(Buffer.from('test content')),
            unlinkSync: sinon.stub()
        },
        'child_process': {
            exec: sinon.stub().yields(null, { stdout: 'Success' }),
            execSync: sinon.stub().returns(Buffer.from('Success'))
        },
        'os': {
            platform: sinon.stub().returns('linux'),
            homedir: sinon.stub().returns('/home/test')
        },
        'path': {
            join: (...args: string[]) => args.join('/'),
            dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
            basename: (p: string) => p.split('/').pop() || '',
            resolve: (...args: string[]) => args.join('/')
        }
    };
}

/**
 * モジュールの依存性を完全に置き換えてモックする
 * sinonのスタブの代わりにプロキシオブジェクトを使用し、non-configurable属性の問題を回避
 * @param originalModule オリジナルのモジュール
 * @param mocksToApply 適用するモック
 * @returns モック化されたモジュール
 */
export function mockModuleDependencies(originalModule: any, mocksToApply: Record<string, any>): any {
    // オリジナルモジュールのプロパティをコピー
    const mockedModule = { ...originalModule };
    
    // モックをマージ
    Object.keys(mocksToApply).forEach(key => {
        mockedModule[key] = mocksToApply[key];
    });
    
    return mockedModule;
}

/**
 * テスト用にextension.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたextensionモジュール
 */
export function loadExtensionModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/extension', combinedStubs);
}

/**
 * テスト用にerror-handlers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたerror-handlersモジュール
 */
export function loadErrorHandlersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/error-handlers', combinedStubs);
}

/**
 * テスト用にtemplate-processor.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたtemplate-processorモジュール
 */
export function loadTemplateProcessorModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/template-processor', combinedStubs);
}

/**
 * 任意のモジュールをVSCodeモックとともに読み込み
 * @param modulePath モジュールのパス（相対パスまたは絶対パス）
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたモジュール
 */
export function loadAnyModuleWithMocks(modulePath: string, additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock(modulePath, combinedStubs);
}

/**
 * テスト用にui-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたui-helpersモジュール
 */
export function loadUiHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/ui-helpers', combinedStubs);
}

/**
 * テスト用にfs-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたfs-helpersモジュール
 */
export function loadFsHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/fs-helpers', combinedStubs);
}

/**
 * テスト用にdocker-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたdocker-helpersモジュール
 */
export function loadDockerHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/docker-helpers', combinedStubs);
} 