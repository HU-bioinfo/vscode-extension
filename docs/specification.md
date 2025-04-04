# work-env 拡張機能仕様書

## 概要

`work-env` は、統一された R および Python 開発環境を提供する VSCode 拡張機能です。Docker コンテナを用いて、一貫性のある開発環境をセットアップし、ユーザーに提供します。

## 機能

- **統一された開発環境**: R と Python の統一環境を Docker コンテナで提供
- **簡単なセットアップ**: VSCode の UI を通じて簡単に環境構築が可能
- **プロジェクト分離**: プロジェクトごとに独立した環境設定が可能
- **キャッシュ共有**: ライブラリやパッケージなどをキャッシュとして共有可能

## システム要件

- **サポートされている OS**: Linux, macOS
- **Windows 対応**: WSL（Windows Subsystem for Linux）経由で使用可能
- **事前要件**:
  - Docker がインストールされていること
  - Remote Containers 拡張機能がインストールされていること

## アーキテクチャ

### コンポーネント

1. **VSCode 拡張機能**: ユーザーインターフェースとコマンド提供
2. **Docker コンテナ**: R/Python 実行環境（kokeh/hu_bioinfo:stable イメージを使用）
3. **Docker Compose**: コンテナ設定と環境変数管理

### ディレクトリ構造

```
work-env/
├── .devcontainer/        # 開発コンテナ設定
├── src/                  # 拡張機能のソースコード
│   ├── extension.ts      # メインの拡張機能コード
│   └── test-helper.ts    # テスト用ヘルパー関数
├── test/                 # テストコード
│   ├── basic.test.ts     # 基本的なテスト
│   └── error-handlers.test.ts # エラーハンドリングテスト
└── docker-compose.templete.yml # Docker Compose 設定テンプレート
```

## 主要コマンド

拡張機能は以下の 2 つのコマンドを提供します：

1. **work-env.start-work-env**: 開発環境を起動するコマンド

   - 初回実行時は設定ウィザードを表示
   - Docker と Remote Containers の存在をチェック
   - 必要な Docker イメージをプル
   - 環境設定に基づいて Docker Compose ファイルを生成
   - コンテナ内でフォルダを開く

2. **work-env.reset-config**: 設定をリセットするコマンド
   - 既存のコンテナを削除
   - 設定ウィザードを再度表示
   - 新しい設定で環境を再構築

## 設定プロセス

1. **プロジェクトフォルダの選択**: 開発するプロジェクトが格納されているフォルダを選択
2. **キャッシュディレクトリの選択**: ライブラリやパッケージなどのキャッシュを格納するディレクトリを選択
3. **GitHub Personal Access Token (PAT) の入力**: GitHub リポジトリにアクセスするための認証トークンを入力

## エラーハンドリング

拡張機能は以下のエラーケースを検出して適切にハンドリングします：

1. **Docker 関連エラー**:

   - Docker がインストールされていない場合
   - Docker の実行権限がない場合
   - Docker イメージのプルに失敗した場合

2. **設定関連エラー**:

   - プロジェクトフォルダが選択されていない場合
   - キャッシュフォルダが選択されていない場合
   - GitHub PAT が入力されていない場合

3. **コンテナ関連エラー**:
   - コンテナでフォルダを開けない場合
   - Docker Compose ファイルの生成に失敗した場合

## テスト

拡張機能には、以下のテストが含まれています：

1. **基本的なテスト** (basic.test.ts):

   - エラーハンドリングの基本的な動作確認
   - エラーメッセージのパース処理のテスト

2. **エラーハンドリングテスト** (error-handlers.test.ts):
   - Docker 関連のエラー処理
   - 入力チェック関連のエラー処理

## Docker コンテナ設定

コンテナは以下の設定で実行されます：

```yaml
services:
  container:
    image: kokeh/hu_bioinfo:stable
    environment:
      - DISABLE_AUTH=true
      - GITHUB_PAT={{GITHUB_PAT}}
      - CACHE_DIR="/home/user/cache"
      - PROJ_DIR="/home/user/proj"
    volumes:
      - {{CACHE_FOLDER}}:/home/user/cache
      - {{PROJECT_FOLDER}}:/home/user/proj
    command: sleep infinity
```

環境変数とボリュームマウントにより、以下のような機能を提供します：

- GitHub リポジトリへのアクセス (GITHUB_PAT)
- ホストマシンのプロジェクトフォルダをコンテナの `/home/user/proj` にマウント
- ホストマシンのキャッシュフォルダをコンテナの `/home/user/cache` にマウント

## 展望と改善点

1. **Windows サポートの強化**: 現在は WSL 経由での利用に限定
2. **UI の改善**: より直感的な設定プロセスの提供
3. **拡張性の向上**: 複数の言語/環境へのサポート拡大
4. **テストカバレッジの向上**: より多くのユースケースをカバーするテスト追加
