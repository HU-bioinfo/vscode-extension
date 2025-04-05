# Change Log

All notable changes to the "work-env" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.6] - 2024-07-30

### 修正

- モックリセット方法の改善により、テスト間の干渉を防止
- `preflightChecks`関数のテストを改善し、Docker 未インストール時の動作を正確に検証
- `vscode.env.openExternal`のモック方法を修正し、Docker インストールガイド表示機能のテストを安定化
- テスト終了時に元の関数を確実に復元するために`try/finally`パターンを導入

### 改善

- 明確なアサーションメッセージの追加によりテスト失敗時のデバッグを容易化
- テスト実行前にモックを確実にリセットする仕組みを強化

## [1.0.5] - 2025-04-06

### Fixed

- テストカバレッジ向上のための修正
  - エラーハンドラーモジュールのテスト環境対応を改善
  - VSCode API のモック化を強化
  - Docker 関連エラー処理のテストケース追加
  - ファイルシステム操作のテストケース追加
  - 各 OS プラットフォーム固有エラーメッセージのテスト追加

### Improved

- ブランチカバレッジが 50%以上に向上
- テスト環境でのモック対応を改善
- テスト失敗の修正

## [1.0.4] - 2025-04-05

### Added

- テストカバレッジ測定機能の追加
  - nyc (Istanbul) による単体テストのカバレッジ計測
  - TypeScript 対応のカバレッジ設定
  - テスト結果レポート生成機能

### Changed

- テスト環境の簡略化
  - DBus 関連の設定とライブラリの削除
  - Docker in Docker 関連の冗長な設定を削除
  - UI 統合テストの廃止とユニットテストへの集中
  - テスト関連ドキュメントの更新
- テスト実行方法をシンプルに変更

### Improved

- テストドキュメントの整備
  - テスト実行手順の明確化
  - テスト結果レポートの見方を説明
  - モックを使ったテスト例の追加

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
