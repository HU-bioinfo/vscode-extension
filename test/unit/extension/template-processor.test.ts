import * as assert from 'assert';
import * as sinon from 'sinon';
import { loadTemplateProcessorModule } from '../../util/moduleloader';
import vscodeStub from '../../mock/vscode.mock';

describe('Template Processor テスト', () => {
    let templateProcessorModule: any;
    let fsMock: any;
    let pathMock: any;
    let processingResult: Map<string, boolean>;

    beforeEach(() => {
        // テスト結果を記録するマップ
        processingResult = new Map<string, boolean>();
        
        // ファイルシステムのモック作成
        fsMock = {
            existsSync: sinon.stub().returns(true),
            mkdirSync: sinon.stub(),
            readdirSync: sinon.stub().returns(['file1.template', 'file2.template', 'subdir.template']),
            lstatSync: sinon.stub(),
            readFileSync: sinon.stub().returns('Template content with ${variable}'),
            writeFileSync: sinon.stub().callsFake((filePath: string, content: string) => {
                // writeFileSyncが呼ばれたときに処理成功としてマーク
                const fileName = filePath.split('/').pop();
                if (fileName) {
                    processingResult.set(fileName, true);
                }
            }),
            rmdirSync: sinon.stub(),
            unlinkSync: sinon.stub()
        };
        
        // lstatSyncの動作を定義
        fsMock.lstatSync.callsFake((path: string) => {
            if (path.includes('subdir')) {
                return { isDirectory: () => true, isFile: () => false };
            }
            return { isDirectory: () => false, isFile: () => true };
        });
        
        // パスモジュールのモック作成
        pathMock = {
            join: (...args: string[]) => args.join('/'),
            dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
            basename: (p: string) => p.split('/').pop() || '',
            parse: (p: string) => {
                const base = p.split('/').pop() || '';
                const ext = base.includes('.') ? '.' + base.split('.').pop() : '';
                const name = ext ? base.slice(0, -ext.length) : base;
                return { 
                    root: '', 
                    dir: p.substring(0, p.length - base.length), 
                    base,
                    ext,
                    name
                };
            }
        };
        
        // モジュールをロード
        templateProcessorModule = loadTemplateProcessorModule({
            'fs': fsMock,
            'path': pathMock
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('TemplateProcessor.removeTemplateExtension', () => {
        it('テンプレートファイル名から拡張子を削除できること', () => {
            const result = templateProcessorModule.TemplateProcessor.removeTemplateExtension('file.template');
            assert.strictEqual(result, 'file', 'テンプレート拡張子が削除されるべき');
        });
        
        it('テンプレート拡張子がない場合は元の名前を返すこと', () => {
            const result = templateProcessorModule.TemplateProcessor.removeTemplateExtension('file.txt');
            assert.strictEqual(result, 'file.txt', '非テンプレートファイルは変更されないべき');
        });
    });

    describe('TemplateProcessor.replaceVariables', () => {
        it('テンプレート内のプレースホルダーを置換できること', () => {
            const template = 'Hello, ${name}! Your project is ${project}.';
            const variables = { name: 'User', project: 'My Project' };
            
            const result = templateProcessorModule.TemplateProcessor.replaceVariables(template, variables);
            
            assert.strictEqual(result, 'Hello, User! Your project is My Project.', 'プレースホルダーが正しく置換されるべき');
        });
        
        it('未定義の変数がある場合プレースホルダーをそのまま残すこと', () => {
            const template = 'Hello, ${name}! Your project is ${project}.';
            const variables = { name: 'User' };
            
            const result = templateProcessorModule.TemplateProcessor.replaceVariables(template, variables);
            
            assert.strictEqual(result, 'Hello, User! Your project is ${project}.', '未定義変数のプレースホルダーはそのまま残るべき');
        });
    });

    describe('TemplateProcessor.expandTemplateDirectory', () => {
        it('テンプレートディレクトリを展開できること', () => {
            // テスト対象のディレクトリ
            const sourceDir = '/template-source';
            const targetDir = '/target-directory';
            const variables = { variable: 'replaced_value' };
            
            // モック動作の設定
            fsMock.readdirSync.withArgs(sourceDir).returns(['file1.template', 'file2.template', 'subdir.template']);
            fsMock.lstatSync.withArgs(`${sourceDir}/file1.template`).returns({ isDirectory: () => false, isFile: () => true });
            fsMock.lstatSync.withArgs(`${sourceDir}/file2.template`).returns({ isDirectory: () => false, isFile: () => true });
            fsMock.lstatSync.withArgs(`${sourceDir}/subdir.template`).returns({ isDirectory: () => true, isFile: () => false });
            
            // 再帰呼び出し用のモック
            fsMock.readdirSync.withArgs(`${sourceDir}/subdir.template`).returns(['subfile.template']);
            fsMock.lstatSync.withArgs(`${sourceDir}/subdir.template/subfile.template`).returns({ isDirectory: () => false, isFile: () => true });
            
            // テンプレート内容
            fsMock.readFileSync.withArgs(`${sourceDir}/file1.template`).returns('Content with ${variable}');
            fsMock.readFileSync.withArgs(`${sourceDir}/file2.template`).returns('Another content with ${variable}');
            fsMock.readFileSync.withArgs(`${sourceDir}/subdir.template/subfile.template`).returns('Subfile content with ${variable}');
            
            // 関数を実行
            templateProcessorModule.TemplateProcessor.expandTemplateDirectory(sourceDir, targetDir, variables);
            
            // ディレクトリ作成の検証
            assert.ok(fsMock.mkdirSync.calledWith(targetDir, { recursive: true }), 'ターゲットディレクトリが作成されるべき');
            assert.ok(fsMock.mkdirSync.calledWith(`${targetDir}/subdir`, { recursive: true }), 'サブディレクトリが作成されるべき');
            
            // ファイル作成の検証
            assert.ok(fsMock.writeFileSync.calledWith(`${targetDir}/file1`, 'Content with replaced_value'), 'file1が正しく処理されるべき');
            assert.ok(fsMock.writeFileSync.calledWith(`${targetDir}/file2`, 'Another content with replaced_value'), 'file2が正しく処理されるべき');
            assert.ok(fsMock.writeFileSync.calledWith(`${targetDir}/subdir/subfile`, 'Subfile content with replaced_value'), 'サブファイルが正しく処理されるべき');
            
            // プロセス結果の確認
            assert.strictEqual(processingResult.get('file1'), true, 'file1が処理されたとマークされるべき');
            assert.strictEqual(processingResult.get('file2'), true, 'file2が処理されたとマークされるべき');
            assert.strictEqual(processingResult.get('subfile'), true, 'subfileが処理されたとマークされるべき');
        });
    });
}); 