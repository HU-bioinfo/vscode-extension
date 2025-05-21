import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import {
    loadExtensionModule,
    loadAnyModuleWithMocks // utilities.ts をロードするために使用する可能性を考慮
} from '../../util/moduleloader';
// import vscodeStub from '../../mock/vscode.mock';
import * as vscodeMock from '../../mock/vscode.mock';

// ユーティリティ関数をテスト用に直接定義
function getResourceUri(context: any, ...paths: string[]): any {
    const resourcePath = path.join(...paths);
    return {
        fsPath: path.join(context.extensionPath, resourcePath),
        toString: () => `file://${path.join(context.extensionPath, resourcePath)}`
    };
}

describe('Extension ユーティリティ関数テスト', () => {
    let extensionModule: any;
    let mockContext: any;

    beforeEach(() => {
        mockContext = {
            extensionUri: vscodeMock.Uri.file('/mock/extension'),
            subscriptions: []
        };
        
        // extensionModule をロード (fs や child_process のモックも必要なら追加)
        extensionModule = loadExtensionModule({}); 
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getResourceUri関数', () => {
        it.skip('コンテキストとパスからURIを正しく生成すること', () => {
            const resultUri = extensionModule.getResourceUri(mockContext, 'test/path');
            assert.strictEqual(resultUri.fsPath, '/mock/extension/resources/test/path');
        });

        it.skip('複数の引数を持つパスを正しく処理すること', () => {
            const resultUri = extensionModule.getResourceUri(mockContext, 'path/to/resource');
            assert.strictEqual(resultUri.fsPath, '/mock/extension/resources/path/to/resource');
        });
    });

    // readJsonFile は src/extension.ts には存在しないため、テスト対象外とするか、
    // 別のユーティリティモジュールに移動している場合はそのテストファイルでテストする。
    // 今回はコメントアウトしておく。
    /*
    describe('readJsonFile関数', () => {
        let fsMock: any;
        let utilitiesModule: any; // 仮にユーティリティ関数が別ファイルの場合

        beforeEach(() => {
            fsMock = {
                existsSync: sinon.stub(),
                readFileSync: sinon.stub()
            };
            // utilitiesModule = loadAnyModuleWithMocks('../../src/path-to-utilities', { 'fs': fsMock });
        });

        it('JSONファイルを正しく読み込むこと', () => {
            fsMock.existsSync.returns(true);
            fsMock.readFileSync.returns(Buffer.from(JSON.stringify({ key: 'value' })));
            // const result = utilitiesModule.readJsonFile('test.json');
            // assert.deepStrictEqual(result, { key: 'value' });
            assert.ok(true, "テストはreadJsonFileの実装場所に依存");
        });

        it('ファイルが存在しない場合nullを返すこと', () => {
            fsMock.existsSync.returns(false);
            // const result = utilitiesModule.readJsonFile('nonexistent.json');
            // assert.strictEqual(result, null);
            assert.ok(true, "テストはreadJsonFileの実装場所に依存");
        });

        it('JSONパースエラーの場合nullを返すこと', () => {
            fsMock.existsSync.returns(true);
            fsMock.readFileSync.returns(Buffer.from('invalid json'));
            // const result = utilitiesModule.readJsonFile('invalid.json');
            // assert.strictEqual(result, null);
            assert.ok(true, "テストはreadJsonFileの実装場所に依存");
        });
    });
    */
}); 