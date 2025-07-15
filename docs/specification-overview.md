# bioinfo-launcher 拡張機能仕様書 - 概要とアーキテクチャ

## 概要

`bioinfo-launcher` は、統一された R および Python 開発環境を提供する VSCode 拡張機能です。Docker コンテナを用いて、一貫性のある開発環境をセットアップし、ユーザーに提供します。

## 機能

- **統一された開発環境**: R と Python の統一環境を Docker コンテナで提供
- **簡単なセットアップ**: VSCode の UI を通じて簡単に環境構築が可能
- **キャッシュ共有**: ライブラリやパッケージなどをキャッシュとして共有可能
- **自動環境接続**: 二回目以降の実行時は既存環境へ自動接続

## システム要件

- **サポートされている OS**: Linux, macOS
- **Windows 対応**: WSL（Windows Subsystem for Linux）経由で使用可能
- **事前要件**:
  - Docker がインストールされていること
  - Dev Container エクステンションがインストールされていること

## アーキテクチャ

### コンポーネント

1. **VSCode 拡張機能**: ユーザーインターフェースとコマンド提供
2. **Docker コンテナ**: R/Python 実行環境（hubioinfows/base_env:latest イメージを使用）
3. **Docker Compose**: コンテナ設定と環境変数管理

### ディレクトリ構造

```
bioinfo-launcher/
├── src/                  # 拡張機能のソースコード
│   ├── extension.ts      # メインの拡張機能コード
│   └── test-helper.ts    # テスト用ヘルパー関数
├── resources/            # 静的リソース
│   ├── templates/        # テンプレートファイル
│   │   ├── container_template/  # devcontainerのルートディレクトリテンプレート
│   │   │   ├── devcontainer.json.template  # devcontainer設定テンプレート
│   │   │   └── docker-compose.yml.template # Docker Compose設定テンプレート
│   │   ├── cache_template/     # キャッシュディレクトリのテンプレート
│   │   ├── projects_template/  # プロジェクトディレクトリのテンプレート
│   │   └── ... その他テンプレートファイル
│   └── ... その他リソース
├── test/                 # テストコード
│   ├── unit/             # ユニットテスト
│   │   ├── basic.test.ts # 基本的な機能テスト
│   │   └── error-handlers.test.ts # エラーハンドリングテスト
│   ├── setup.ts          # テスト環境セットアップ
│   └── index.ts          # テストのエントリーポイント
└── package.json          # エクステンション設定
```

### ディレクトリ構造の新仕様

選択した親ディレクトリ内に、以下のような構造が自動的に生成されます：

```
選択した親ディレクトリ/
├── cache/                # キャッシュディレクトリ（外部からマウントされる）
│   └── ... キャッシュファイル
└── container/            # コンテナ設定とプロジェクトファイル
    ├── .devcontainer/    # VS Code Remote Container設定
    │   ├── devcontainer.json
    │   └── docker-compose.yml
    └── projects/         # プロジェクトファイル（コンテナ内部に保持）
        └── ... プロジェクトファイル
```

この構造により、キャッシュディレクトリのみが外部からマウントされ、プロジェクトファイルはコンテナ内部に保持されます。環境変数は親ディレクトリの.envファイルで管理され、複数のコンテナ環境で共有可能になっています。

## 関連ドキュメント

- [コマンド仕様](./specification-commands.md)
- [Docker関連仕様](./specification-docker.md)
- [エラー処理仕様](./specification-error-handling.md)
- [テンプレート仕様](./specification-templates.md)