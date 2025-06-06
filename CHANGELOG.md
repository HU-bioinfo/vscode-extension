# Change Log

All notable changes to the "bioinfo-launcher" extension will be documented in this file.

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