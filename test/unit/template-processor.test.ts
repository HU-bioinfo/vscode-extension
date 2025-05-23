import * as assert from 'assert';
import * as sinon from 'sinon';
import { TemplateProcessor } from '../../src/template-processor';

// テスト対象クラスのインスタンスを作成
const templateProcessor = new TemplateProcessor();

describe('テンプレート処理ユニットテスト - 基本機能', () => {
  it('ファイル名からテンプレート拡張子を削除できる', () => {
    // テストケース
    const testCases = [
      { input: 'file_template.txt', expected: 'file.txt' },
      { input: 'file.template', expected: 'file' },
      { input: 'file.txt.template', expected: 'file.txt' },
      { input: 'file_template', expected: 'file' },
      { input: 'file', expected: 'file' } // 変更なし
    ];
    
    // 各テストケースを実行
    testCases.forEach(({ input, expected }) => {
      const result = templateProcessor.removeTemplateExtension(input);
      assert.strictEqual(result, expected, `${input}から正しくテンプレート拡張子が削除されること`);
    });
  });
  
  it('ディレクトリ名からテンプレート拡張子を削除できる', () => {
    // テストケース
    const testCases = [
      { input: 'dir_template', expected: 'dir' },
      { input: 'dir', expected: 'dir' } // 変更なし
    ];
    
    // 各テストケースを実行
    testCases.forEach(({ input, expected }) => {
      const result = templateProcessor.removeTemplateExtension(input);
      assert.strictEqual(result, expected, `${input}から正しくテンプレート拡張子が削除されること`);
    });
  });
  
  it('テンプレート内のプレースホルダーを置換できる', () => {
    // テストデータ
    const template = 'Hello {{NAME}}! Welcome to {{PROJECT}}';
    const variables = {
      NAME: 'John',
      PROJECT: 'VSC Extension Dev'
    };
    
    // 関数実行
    const result = templateProcessor.replaceVariables(template, variables);
    
    // 結果検証
    assert.strictEqual(result, 'Hello John! Welcome to VSC Extension Dev', 'プレースホルダーが正しく置換されること');
  });
  
  it('未定義の変数がある場合、プレースホルダーをそのまま残す', () => {
    // テストデータ
    const template = 'Hello {{NAME}}! Welcome to {{PROJECT}}';
    const variables = {
      NAME: 'John'
      // PROJECT は未定義
    };
    
    // 関数実行
    const result = templateProcessor.replaceVariables(template, variables);
    
    // 結果検証
    assert.strictEqual(result, 'Hello John! Welcome to {{PROJECT}}', '未定義の変数はプレースホルダーをそのまま残すこと');
  });
});

// ファイルシステム操作に依存するテストは別途実装する必要があるため、ここではスキップ
describe.skip('テンプレート処理ユニットテスト - ファイルシステム操作', () => {
  let processor: TemplateProcessor;
  let expandStub: sinon.SinonStub;
  
  beforeEach(() => {
    processor = new TemplateProcessor();
    // expandTemplateDirectory メソッドをスタブ化
    expandStub = sinon.stub(processor, 'expandTemplateDirectory').resolves();
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('テンプレートディレクトリを展開する機能のモック', async () => {
    // テスト用パラメータ
    const templateDir = '/template';
    const targetDir = '/target';
    const variables = { key: 'value' };
    
    // スタブの戻り値を設定
    expandStub.resolves();
    
    // 関数呼び出し
    await processor.expandTemplateDirectory(templateDir, targetDir, variables);
    
    // スタブが正しく呼び出されたことを確認
    sinon.assert.calledOnce(expandStub);
    sinon.assert.calledWith(expandStub, templateDir, targetDir, variables);
  });
});

// 新しく追加した関数のテスト
describe('テンプレート処理ユニットテスト - 展開機能', () => {
  it('selectParentDirectory関数のテスト', async () => {
    const { selectParentDirectory } = require('../../src/test-helper');
    
    // 関数からの戻り値を取得
    const result = await selectParentDirectory();
    
    // 返されたURIにパスが含まれることを確認
    assert.ok(result.fsPath, 'URIにfsPathプロパティが含まれること');
    assert.strictEqual(typeof result.fsPath, 'string', 'fsPathが文字列であること');
  });
  
  it('inputGitHubPAT関数のテスト', async () => {
    const { inputGitHubPAT } = require('../../src/test-helper');
    
    // 関数からの戻り値を取得
    const result = await inputGitHubPAT();
    
    // 返された値がトークン文字列であることを確認
    assert.strictEqual(typeof result, 'string', '戻り値が文字列であること');
    assert.ok(result.length > 0, 'トークンが空でないこと');
  });
  
  it('setupProjectTemplate関数のテスト', async () => {
    const { setupProjectTemplate, createMockContext } = require('../../src/test-helper');
    const mockContext = createMockContext();
    const projectPath = '/test/project';
    
    // 関数を呼び出し
    const result = await setupProjectTemplate(mockContext, projectPath);
    
    // 成功したことを確認
    assert.strictEqual(result, true, 'プロジェクトテンプレートの展開に成功すること');
  });
}); 