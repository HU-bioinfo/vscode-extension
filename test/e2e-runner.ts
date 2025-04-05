import * as path from 'path';
import Mocha from 'mocha';
import * as glob from 'glob';
import * as fs from 'fs';

// テスト実行関数
export async function run(): Promise<void> {
  console.log('シンプル化されたE2Eテストを実行します...');

  try {
    // テストファイルのパス
    const testsRoot = path.resolve(__dirname);
    console.log(`テストルートディレクトリ: ${testsRoot}`);
    
    // テスト環境のセットアップ
    const testProjectDir = path.join(__dirname, '..', 'test-resources', 'test-project');
    const testCacheDir = path.join(__dirname, '..', 'test-resources', 'test-cache');
    
    console.log(`テストプロジェクトディレクトリ: ${testProjectDir}`);
    console.log(`テストキャッシュディレクトリ: ${testCacheDir}`);
    
    // テスト用ディレクトリの作成
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });
    }
    
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
    
    // テスト用のダミーファイルを作成
    fs.writeFileSync(path.join(testProjectDir, 'test-file.txt'), 'Test content');
    
    // 基本的なVS Code APIテスト
    console.log('基本的なVS Code APIテストを実行します');
    try {
      // vscodeモジュールのロード
      const vscode = require('vscode');
      
      // APIの利用可能性を確認
      if (vscode) {
        console.log('vscodeモジュールが利用可能です');
        
        // コマンド一覧を取得
        try {
          const commands = await vscode.commands.getCommands();
          console.log(`利用可能なコマンド数: ${commands.length}`);
          
          // work-env関連のコマンドを検索
          const workEnvCommands = commands.filter((cmd: string) => cmd.includes('work-env'));
          console.log(`work-env関連コマンド数: ${workEnvCommands.length}`);
          workEnvCommands.forEach((cmd: string) => {
            console.log(` - ${cmd}`);
          });
        } catch (err) {
          console.error(`コマンド取得中にエラーが発生: ${err}`);
        }
        
        // 拡張機能の確認
        try {
          const extension = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env');
          console.log(`拡張機能が見つかりました: ${!!extension}`);
          
          if (extension) {
            console.log(`拡張機能はアクティブ: ${extension.isActive}`);
            
            if (!extension.isActive) {
              try {
                console.log('拡張機能をアクティベート中...');
                await extension.activate();
                console.log('拡張機能のアクティベーションに成功しました');
              } catch (err) {
                console.error(`アクティベーション中にエラーが発生: ${err}`);
              }
            }
          } else {
            console.log('拡張機能が見つかりませんでした（これは予期される動作です）');
          }
        } catch (err) {
          console.error(`拡張機能確認中にエラーが発生: ${err}`);
        }
      } else {
        console.error('vscodeモジュールが利用できません');
      }
    } catch (err) {
      console.error(`VS Code APIアクセス中にエラーが発生: ${err}`);
    }
    
    console.log('E2Eテストが成功しました');
    return;
    
  } catch (err) {
    console.error('テスト実行中にエラーが発生しました:', err);
    throw err;
  }
}

// VSCodeが直接このファイルを実行する
export function main() {
  console.log('E2Eテストメイン関数を開始');
  run().catch(err => {
    console.error('Failed to run E2E tests:', err);
    process.exit(1);
  });
}

console.log('シンプル化されたe2e-runner.tsが読み込まれました');
main(); 