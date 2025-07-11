# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

HU Bioinfo LauncherはVSCode Extensionで、バイオインフォマティクス開発環境をDockerコンテナで簡単にセットアップするためのツールです。

## 開発コマンド

### ビルド
```bash
npm run compile      # TypeScriptをJavaScriptにコンパイル
npm run watch        # ファイル変更を監視して自動コンパイル
```

### テスト
```bash
npm run test         # 単体テストを実行
npm run test:coverage # カバレッジレポート付きでテストを実行
```

### リント
```bash
npm run lint         # ESLintを実行してコード品質をチェック
```

### 公開準備
```bash
npm run vscode:prepublish # 公開前のコンパイル処理
```

## アーキテクチャ

### 主要コンポーネント

1. **extension.ts** - メインエントリポイント
   - コマンド登録: `start-launcher`, `reset-config`, `config-container`
   - Dockerイメージの更新チェックと自動リビルド機能
   - セットアップワークフローの管理

2. **docker-helpers.ts** - Docker操作
   - Dockerのインストール確認とpull/run操作
   - イメージ更新の検出とコンテナリビルド
   - プログレストラッキング付きイメージpull

3. **template-processor.ts** - テンプレート処理
   - `.devcontainer`と`docker-compose.yml`のテンプレート展開
   - 変数置換（ユーザー名、GitHub PAT等）

4. **ui-helpers.ts** - UI操作
   - GitHub PATの入力ダイアログ
   - ディレクトリ選択
   - エラーメッセージ表示

5. **fs-helpers.ts** - ファイルシステム操作
   - ディレクトリ作成と権限設定
   - パス検証

6. **error-handlers.ts** - エラー処理
   - Docker関連エラーの検出と解析
   - ユーザーフレンドリーなエラーメッセージ

### ワークフロー

1. ユーザーが親ディレクトリを選択
2. `cache/`と`container/`サブディレクトリを作成
3. テンプレートを展開して`.devcontainer`設定を生成
4. GitHub PATを含むDocker Compose設定を作成
5. コンテナをVSCodeで開く

### Docker設定

- デフォルトイメージ: `hubioinfows/lite_env:latest`
- 代替イメージは`config-container`コマンドで設定可能
- Docker Composeでコンテナオーケストレーション
- ホストからcacheディレクトリをマウント

## 重要な開発ルール

1. **日本語でのコミュニケーション**: ユーザーとは日本語でやりとりすること
2. **エラーメッセージ**: ユーザーフレンドリーな日本語エラーメッセージを提供
3. **テスト**: 新機能追加時は必ず単体テストを作成
4. **型安全性**: TypeScriptのstrict modeを維持
5. **Docker互換性**: Linux、macOS、Windows（WSL）での動作を考慮

## ドキュメント管理ルール

1. **実装との整合性**: コードを変更したら必ず関連するドキュメントも更新すること
   - 機能追加・変更時は`docs/features.md`を更新
   - アーキテクチャ変更時は`docs/specification.md`を更新
   - APIやコマンド変更時は該当ドキュメントを更新

2. **ドキュメント分割の基準**:
   - 1つのドキュメントが200行を超えたら分割を検討
   - 10KB（約200-250行）を目安に分割
   - 分割する際の構成:
     - `docs/specification-overview.md` - 概要とアーキテクチャ
     - `docs/specification-commands.md` - コマンド仕様
     - `docs/specification-docker.md` - Docker関連仕様
     - `docs/specification-error-handling.md` - エラー処理仕様
     - など、機能単位で分割

3. **ドキュメント構成**:
   - `docs/README.md` - ドキュメントのインデックス
   - `docs/specification*.md` - 技術仕様書群
   - `docs/features.md` - 機能説明（将来的に機能ごとに分割）
   - `docs/api-reference.md` - API/コマンドリファレンス（作成推奨）
   - `docs/troubleshooting.md` - トラブルシューティング（作成推奨）

## コミット管理ルール

1. **コミット頻度**:
   - 論理的な変更単位でこまめにコミット
   - 1つの機能実装が完了したらコミット
   - バグ修正は個別にコミット
   - ドキュメント更新も独立したコミット

2. **コミットメッセージ規約**:
   ```
   <type>: <subject>
   
   <body>（任意）
   ```
   
   **type**:
   - `feat`: 新機能追加
   - `fix`: バグ修正
   - `docs`: ドキュメントのみの変更
   - `style`: コードの意味に影響しない変更（フォーマット等）
   - `refactor`: バグ修正や機能追加を伴わないコード変更
   - `test`: テストの追加・修正
   - `chore`: ビルドプロセスやツールの変更

   **例**:
   ```
   feat: Docker イメージの自動更新チェック機能を追加
   
   - 起動時にイメージの更新を確認
   - 更新がある場合はユーザーに通知
   - 自動リビルドオプションを提供
   ```

3. **プッシュタイミング**:
   - 機能の実装が一段落したらプッシュ
   - CIが通ることを確認してからプッシュ
   - WIP（Work In Progress）の場合は、ブランチ名に`wip/`プレフィックスを付ける

4. **ブランチ戦略**:
   - `main`: 安定版
   - `feature/*`: 新機能開発
   - `fix/*`: バグ修正
   - `docs/*`: ドキュメント更新
   - `wip/*`: 作業中（プッシュ可だが未完成）

## テンプレートファイル

`resources/templates/`ディレクトリ内のファイルは以下の変数をサポート:
- `{{USER}}` - システムユーザー名
- `{{REPO_TOKEN}}` - GitHub Personal Access Token
- `{{IMAGE_TAG}}` - 選択されたDockerイメージタグ