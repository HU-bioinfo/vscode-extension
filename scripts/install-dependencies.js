/**
 * VS Code拡張機能の依存関係をインストールするスクリプト
 * 
 * このスクリプトは以下を行います:
 * 1. 必要なディレクトリ構造の作成
 * 2. VSIXパッケージからの拡張機能のインストール、またはMarketplaceからの拡張機能のインストール
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// 設定
const config = {
  extensionsDir: path.join(__dirname, '..', '.vscode-test', 'extensions'),
  dependencies: [
    // 依存するエクステンションのIDを指定
    // 例: "ms-vscode-remote.remote-containers"
    "ms-vscode-remote.remote-containers",
    "ms-vscode-remote.remote-wsl"
  ]
};

// ディレクトリの作成
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`ディレクトリを作成しました: ${dir}`);
  }
}

// VS Code CLIを使用してエクステンションをインストール
function installExtension(extensionId) {
  try {
    console.log(`エクステンション ${extensionId} をインストール中...`);

    // エクステンションをダウンロードしてインストール
    // 注: extensions-dirオプションは一部の環境では利用できないため、標準のインストールを使用
    execSync(
      `code --install-extension ${extensionId} --force`,
      { stdio: 'inherit' }
    );
    
    console.log(`エクステンション ${extensionId} をインストールしました`);
    return true;
  } catch (error) {
    console.error(`エクステンション ${extensionId} のインストールに失敗しました:`, error.message);
    return false;
  }
}

// メイン実行関数
async function main() {
  try {
    console.log('依存エクステンションのセットアップを開始します...');
    
    // 拡張機能ディレクトリの準備
    ensureDirectoryExists(config.extensionsDir);
    console.log('注意: 現在の環境では専用のエクステンションディレクトリが使用できないため、');
    console.log('      通常のVS Code拡張機能として依存エクステンションをインストールします。');
    
    // 依存エクステンションのインストール
    let success = true;
    for (const extensionId of config.dependencies) {
      const installed = installExtension(extensionId);
      if (!installed) {
        success = false;
      }
    }
    
    if (success) {
      console.log('すべての依存エクステンションのインストールが完了しました');
      console.log('これらの拡張機能は通常のVS Codeにインストールされ、デバッグセッションでも利用可能です。');
    } else {
      console.warn('一部の依存エクステンションのインストールに失敗しました');
    }
  } catch (error) {
    console.error('セットアップ中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
main().catch(err => {
  console.error('予期せぬエラーが発生しました:', err);
  process.exit(1);
}); 