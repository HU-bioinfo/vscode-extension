/**
 * 統合テストモードでスキップするテストのリスト
 * テスト名の部分一致で判定します
 */
export const TESTS_TO_SKIP_IN_INTEGRATION_MODE: string[] = [
  'アクティベーション時にコマンドが登録されること',
  'Remote Containers拡張機能のチェック',
  'Remote Containers拡張機能エラーメッセージの表示',
  'Dockerイメージをプル',
  'work-env.reset-configコマンドが設定をリセットできること',
  'Docker Compose設定情報の収集',
  'テンプレートファイル処理',
  'フォルダーのコピー',
  'deactivate関数のテスト',
  'フォルダ権限設定のテスト',
  'setupDevContainerのテスト',
  'openFolderInContainerの成功テスト',
  'openFolderInContainerのエラーテスト',
  'DockerコマンドとDockerComposeコマンドの実行テスト',
  'Docker関連エラーハンドリングのテスト',
  'generateDockerComposeのテスト',
  'generateDockerComposeのエラーケースをテスト',
  'フォルダコピー時のエラー処理テスト',
  'アクティベーション関数のエラーケーステスト',
  'activate & deactivate関数での追加カバレッジ',
  'showDockerPermissionErrorのプラットフォーム別テスト',
  'processTemplateFile関数のエラー処理テスト',
  'Dockerのインストールガイドを開くテスト',
  'Remote Containers拡張機能のインストールガイドを開くテスト',
  'Docker Composeファイル生成のテスト',
  'Docker Composeファイル生成の失敗テスト',
  '開発コンテナ起動のテスト',
  'コマンド実行のエラーハンドリングテスト',
  '設定リセットのテスト',
  'Dockerがない場合にインストールプロンプトが表示されること',
  'インストールプロンプトでキャンセルを選択した場合は処理を中断すること',
  'インストールを実行した場合はその結果を返すこと',
  'インストールが失敗した場合はfalseを返すこと',
  'Dockerインストール実行関数が正しくDockerInstallerを呼び出すこと',
  'Dockerインストール失敗時にエラーメッセージが表示されること',
  '初回実行のワークフロー',
  '設定リセットワークフロー',
  'Dockerインストールワークフロー',
  'Remote Containersインストールワークフロー',
  'Remote Containers拡張機能がインストールされていない場合にエラーメッセージを表示する',
  'Dockerがインストールされていない場合にエラーメッセージを表示する',
  'Dockerの権限がない場合にエラーメッセージを表示する',
];

/**
 * テストが統合テストモードでスキップすべきかを判定する関数
 * @param testTitle テストのタイトル
 * @returns スキップすべき場合はtrue、そうでない場合はfalse
 */
export function shouldSkipTestInIntegrationMode(testTitle: string): boolean {
  return TESTS_TO_SKIP_IN_INTEGRATION_MODE.some(skipTitle => 
    testTitle.includes(skipTitle)
  );
}

// 統合テストモードでスキップするテスト名のリスト
export const skipTests = [
    // Remote Containers関連のテスト
    'Remote Containers拡張機能のチェック',
    'Remote Containers拡張機能エラーメッセージの表示',
    'Remote Containers拡張機能のインストールガイドを開くテスト',
    
    // その他のスキップするテスト
    'メインコマンド登録', // 統合テストではコマンド登録で問題が発生する場合がある
    // ... 既存のスキップテスト
]; 