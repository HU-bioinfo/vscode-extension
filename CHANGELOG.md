# Change Log

All notable changes to the "bioinfo-launcher" extension will be documented in this file.

## [1.4.6] - 2025-07-11

### Released
- v1.4.5 の全変更をまとめて公式リリース
- VSIXパッケージの作成と配布準備完了

## [1.4.5] - 2025-07-11 (Development)

### Fixed
- Dev Containers API のコマンドパラメータエラーを修正
  - `remote-containers.openFolder` コマンドに必要な第二引数（オプションオブジェクト）を追加
  - エラー時の代替処理として `reopenInContainer` コマンドを実装
  - デバッグ情報を出力チャンネルに表示する機能を追加

### Changed
- **非同期処理の改善**: `dockerOpenInContainer` の呼び出しに await を追加
- **型安全性の向上**:
  - error-handlers.ts の any 型を unknown 型に変更
  - ExtensionSettings インターフェースを定義して settings オブジェクトの型安全性を改善
  - VSCode API の型定義を適切にインポート
- **エラーハンドリングの強化**: `checkDockerImageUpdate` 関数に詳細なエラー処理を追加
- **リソース管理の改善**: 出力チャンネルの適切な dispose 処理を追加

### Refactored
- **コード重複の除去**: extension.ts から重複していた以下の関数を削除
  - `validateParentDirectory` (fs-helpers.ts のものを使用)
  - `preflightChecks` (docker-helpers.ts のものを使用)
  - `pullDockerImage` (docker-helpers.ts のものを使用)
  - `removeExistingContainers` (docker-helpers.ts のものを使用)
  - `isDockerInstalled` (docker-helpers.ts のものを使用)
  - `checkDockerPermissions` (docker-helpers.ts のものを使用)

### Documentation
- CLAUDE.md に CHANGELOG 管理ルールを追加
- 仕様書と実装の整合性を更新

## [1.4.2] - 2025-06-06

### Added
- **Docker Image Update Detection & Auto-Rebuild**: DockerHubのイメージが更新された場合、自動的に検知して既存コンテナのリビルドを提案する機能を追加
  - ローカルとリモートのDockerイメージハッシュ比較機能
  - ユーザー確認ダイアログによるリビルド選択
  - 既存コンテナの自動削除と新しいイメージでの再作成
  - 詳細なユーザーフィードバック（ハッシュ表示、状態通知）

### Changed
- `preparation()` 関数を拡張してイメージ更新検知機能を統合
- `start-launcher` コマンドにリビルド完了通知を追加
- Docker pull処理に進捗表示付きの関数を使用するよう改善

### Technical Details
- 新規追加関数:
  - `checkDockerImageUpdate(imageName: string)`: イメージ更新検知
  - `confirmContainerRebuild(imageName: string)`: ユーザー確認ダイアログ
- VS Code Global State を使用したリビルド状態管理
- エラーハンドリングの改善

## [Previous Versions]

### [1.4.1] - Previous Release
- Docker環境の自動セットアップ機能
- GitHub Personal Access Token設定
- プロジェクトテンプレート展開
- マルチイメージサポート（lite_env, full_env）

---

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. 