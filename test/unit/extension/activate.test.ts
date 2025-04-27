import * as assert from 'assert';
import * as sinon from 'sinon';
import { loadExtensionModule } from '../../util/moduleloader';
import vscodeStub from '../../mock/vscode.mock';

describe('Extension アクティベーションテスト', () => {
    let extensionModule: any;
    let mockContext: any;
    let fsMock: any;
    let childProcessMock: any;

    beforeEach(() => {
        // VSCode拡張コンテキストのモックを作成
        mockContext = new vscodeStub.ExtensionContext();
        mockContext.subscriptions = [];
        
        // ファイルシステムのモック作成
        fsMock = {
            existsSync: sinon.stub().returns(true),
            readFileSync: sinon.stub().returns(Buffer.from('test content')),
            writeFileSync: sinon.stub()
        };

        // 子プロセスのモック作成
        childProcessMock = {
            exec: sinon.stub().yields(null, { stdout: 'Success' }),
            execSync: sinon.stub().returns(Buffer.from('Success'))
        };
        
        // proxyquireを使ってモジュールをロード
        extensionModule = loadExtensionModule({
            'fs': fsMock,
            'child_process': childProcessMock
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    it('アクティベーション時にコマンドが正しく登録されること', () => {
        // VSCodeのコマンド登録関数をスパイ
        const registerCommandSpy = sinon.spy(vscodeStub.commands, 'registerCommand');
        
        // アクティベーション関数を呼び出す
        extensionModule.activate(mockContext);
        
        // コマンドが登録されたことを確認
        assert.ok(registerCommandSpy.calledWith('work-env.start-work-env'), 'work-env.start-work-envコマンドが登録される');
        assert.ok(registerCommandSpy.calledWith('work-env.reset-config'), 'work-env.reset-configコマンドが登録される');
        
        // サブスクリプションに追加されたことを確認
        assert.strictEqual(mockContext.subscriptions.length, 2, '2つのコマンドがサブスクリプションに追加される');
    });

    it('サブスクリプションにコマンドが追加されること', () => {
        // アクティベーション関数を呼び出す
        extensionModule.activate(mockContext);
        
        // サブスクリプションにコマンドが追加されていることを確認
        assert.strictEqual(mockContext.subscriptions.length, 2, '2つのコマンドがサブスクリプションに追加される');
    });

    it('設定ファイルが存在しない場合に作成されること', () => {
        // ファイルが存在しないようにモック
        fsMock.existsSync.returns(false);
        
        // アクティベーション関数を呼び出す
        extensionModule.activate(mockContext);
        
        // 設定ファイルが作成されたことを確認
        assert.ok(fsMock.writeFileSync.called, '設定ファイルが作成される');
    });

    it('エラー発生時にエラーハンドラが呼ばれること', () => {
        // エラーを発生させるようにモック
        fsMock.existsSync.throws(new Error('テストエラー'));
        
        // エラーハンドラをスパイ
        const errorHandlerSpy = sinon.spy(extensionModule, 'handleActivationError');
        
        // アクティベーション関数を呼び出す
        extensionModule.activate(mockContext);
        
        // エラーハンドラが呼ばれたことを確認
        assert.ok(errorHandlerSpy.called, 'エラーハンドラが呼ばれる');
    });
}); 