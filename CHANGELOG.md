# Change Log

All notable changes to the "work-env" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.3] - 2025-04-04

### Added

- エラーハンドリングに関するテスト環境の構築
  - 基本的なエラーハンドリングのユニットテスト実装
  - Docker 関連エラーのテスト実装
  - 入力チェックエラーのテスト実装
- README にテスト実行手順を追加

### Improved

- テスト環境の整備
  - ts-mocha によるテスト環境構築
  - TypeScript/ESLint 設定の最適化

## [1.0.0] - Initial release

### Added

- R/Python 開発環境構築機能
- 既存のエラーハンドリング機能
  - Remote Containers 拡張機能チェック
  - Docker インストール状態チェック
  - Docker 実行権限チェック
  - Docker イメージ取得時のエラー処理
  - ファイルシステムアクセス権エラー処理
  - プロジェクトフォルダ選択チェック
  - キャッシュフォルダ選択チェック
  - GitHub PAT 入力チェック
  - エラーメッセージの多言語対応（OS 別）
