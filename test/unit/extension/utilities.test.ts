import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { loadExtensionModule } from '../../util/moduleloader';
import vscodeStub from '../../mock/vscode.mock';

describe('Extension ユーティリティ関数テスト', () => {
    let extensionModule: any;
    let mockContext: any;
    let fsMock: any;
    let pathMock: any;

    beforeEach(() => {
        // モックコンテキストの作成
        mockContext = new vscodeStub.ExtensionContext('/test/extension');
        
        // ファイルシステムのモック作成
        fsMock = {
            existsSync: sinon.stub().returns(true),
            readFileSync: sinon.stub().returns(Buffer.from('test content')),
            writeFileSync: sinon.stub()
        };
        
        // パスモジュールのモック作成
        pathMock = {
            join: (...args: string[]) => args.join('/'),
            resolve: (...args: string[]) => args.join('/'),
            dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
            basename: (p: string) => p.split('/').pop() || ''
        };
        
        // proxyquireを使ってモジュールをロード
        extensionModule = loadExtensionModule({
            'fs': fsMock,
            'path': pathMock
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getResourceUri関数', () => {
        it('コンテキストとパスからURIを正しく生成すること', () => {
            const resourcePath = 'templates/docker-compose.yml';
            
            // 関数を実行
            const uri = extensionModule.getResourceUri(mockContext, resourcePath);
            
            // 生成されたURIを検証
            assert.strictEqual(uri.fsPath, '/test/extension/templates/docker-compose.yml', 'URIが正しく生成される');
        });
        
        it('複数の引数を持つパスを正しく処理すること', () => {
            // 関数を実行
            const uri = extensionModule.getResourceUri(mockContext, 'templates', 'docker', 'compose.yml');
            
            // 生成されたURIを検証
            assert.strictEqual(uri.fsPath, '/test/extension/templates/docker/compose.yml', '複数のパス引数が正しく結合される');
        });
    });

    describe('readJsonFile関数', () => {
        it('JSONファイルを正しく読み込むこと', () => {
            // JSONデータをモック
            const jsonData = { name: 'work-env', version: '1.0.0' };
            fsMock.readFileSync.returns(JSON.stringify(jsonData));
            
            // 関数を実行
            const result = extensionModule.readJsonFile('/test/package.json');
            
            // 結果を検証
            assert.deepStrictEqual(result, jsonData, 'JSONが正しくパースされる');
            assert.ok(fsMock.readFileSync.calledWith('/test/package.json'), '正しいパスでファイルが読み込まれる');
        });
        
        it('ファイルが存在しない場合nullを返すこと', () => {
            // ファイルが存在しないようにモック
            fsMock.existsSync.returns(false);
            
            // 関数を実行
            const result = extensionModule.readJsonFile('/test/nonexistent.json');
            
            // 結果を検証
            assert.strictEqual(result, null, '存在しないファイルの場合nullが返される');
        });
        
        it('JSONパースエラーの場合nullを返すこと', () => {
            // 不正なJSONデータをモック
            fsMock.readFileSync.returns('{ invalid: json }');
            
            // 関数を実行
            const result = extensionModule.readJsonFile('/test/invalid.json');
            
            // 結果を検証
            assert.strictEqual(result, null, '不正なJSONの場合nullが返される');
        });
    });
}); 