# bioinfo-launcher 拡張機能仕様書

## 概要

`bioinfo-launcher` は、統一された R および Python 開発環境を提供する VSCode 拡張機能です。Docker コンテナを用いて、一貫性のある開発環境をセットアップし、ユーザーに提供します。

## 機能

- **統一された開発環境**: R と Python の統一環境を Docker コンテナで提供
- **簡単なセットアップ**: VSCode の UI を通じて簡単に環境構築が可能
- **キャッシュ共有**: ライブラリやパッケージなどをキャッシュとして共有可能

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

## 主要コマンド

拡張機能は以下の 2 つのコマンドを提供します：

1. **bioinfo-launcher.start-launcher**: 開発環境を起動するコマンド

   - 初回実行時は設定ウィザードを表示
   - 親ディレクトリをユーザーが選択
   - Docker の存在をチェック
   - Docker がインストールされていない場合、自動インストールを提案
   - 必要な Docker イメージをプル
   - リソースフォルダからテンプレートを取得し、環境設定に基づいて Docker Compose/.devcontainer ファイルを生成
   - devcontainerの「Open Folder in Container」で親ディレクトリに展開されたcontainerディレクトリをdevcontainerとして開く

2. **bioinfo-launcher.reset-config**: 設定をリセットするコマンド
   - 既存のコンテナを削除
   - 設定ウィザードを再度表示
   - 新しい設定で環境を再構築


## 設定プロセス

1. **作業環境ディレクトリの選択**: ユーザーは1つの親ディレクトリを選択します。この選択したディレクトリ内に`cache`ディレクトリと`container`ディレクトリが作成されます
2. **GitHub Personal Access Token (PAT) の入力**: GitHub リポジトリにアクセスするための認証トークンを入力
3. **テンプレートの処理**: リソースフォルダからテンプレートを取得し、`_template`や`.template`拡張子を取り除いた状態で、選択した親ディレクトリに配置します

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

### テンプレート構成

テンプレート構成は以下の3つの主要なディレクトリから構成されています：

1. **container_template**: `container`ディレクトリのテンプレートで、devcontainer.jsonやdocker-compose.ymlなどの基本設定ファイルを含む
2. **cache_template**: `cache`ディレクトリのテンプレートで、キャッシュ関連の初期設定ファイルが含まれる
3. **projects_template**: `container/projects`ディレクトリのテンプレートで、プロジェクト関連の初期ファイルが含まれる
   - **sample_project_template**: R開発用のサンプルプロジェクトテンプレート
     - サブディレクトリも`_template`サフィックスを持つ (`R_template`, `data_template`など)
     - ファイルは`.template`拡張子を持つ (`.Rprofile.template`, `renv.lock.template`など)

テンプレートからの生成ルール：
- テンプレートファイル名から`_template`や`.template`拡張子が取り除かれる
- ユーザーが選択した親ディレクトリに、適切なサブディレクトリ構造を保ちながら配置される

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

現在は、ユニットテストとコードカバレッジの実行により、機能の検証と品質の担保を行っています：

### テスト実行コマンド

- `npm run test`: ユニットテストとコードカバレッジを実行

## Docker コンテナ設定

コンテナ設定はテンプレートから生成されます。基本的なテンプレート内容は以下の通りです：

```yaml
services:
  container:
    image: hubioinfows/base_env:latest
    environment:
      - DISABLE_AUTH=true
      - GITHUB_PAT=${GITHUB_PAT}
      - CACHE_DIR="/home/user/cache"
      - PROJ_DIR="/home/user/proj"
    volumes:
      - {{CACHE_FOLDER}}:/home/user/cache
    env_file:
      - ../../.env
    command: sleep infinity
```

環境変数とボリュームマウントにより、以下のような機能を提供します：

- GitHub リポジトリへのアクセス (GITHUB_PAT)
- 親ディレクトリの.envファイルから環境変数を読み込み
- ホストマシンのキャッシュフォルダのみをコンテナの `/home/user/cache` にマウント
- プロジェクトフォルダはdevcontainer内に配置され、外部からのマウントは行わない

### テンプレート構成

テンプレート構成は以下の3つの主要なディレクトリから構成されています：

1. **container_template**: `container`ディレクトリのテンプレートで、devcontainer.jsonやdocker-compose.ymlなどの基本設定ファイルを含む
2. **cache_template**: `cache`ディレクトリのテンプレートで、キャッシュ関連の初期設定ファイルが含まれる
3. **projects_template**: `container/projects`ディレクトリのテンプレートで、プロジェクト関連の初期ファイルが含まれる
   - **sample_project_template**: R開発用のサンプルプロジェクトテンプレート
     - サブディレクトリも`_template`サフィックスを持つ (`R_template`, `data_template`など)
     - ファイルは`.template`拡張子を持つ (`.Rprofile.template`, `renv.lock.template`など)

テンプレートからの生成ルール：
- テンプレートファイル名から`_template`や`.template`拡張子が取り除かれる
- ユーザーが選択した親ディレクトリに、適切なサブディレクトリ構造を保ちながら配置される

## 展望と改善点

1. **Windows ネイティブサポートの検討**: 現在は WSL 経由での利用に限定、将来的にはネイティブ対応も検討
2. **UI の改善**: より直感的な設定プロセスの提供
3. **拡張性の向上**: 複数の言語/環境へのサポート拡大
4. **テストカバレッジの向上**: 特に Docker Installer モジュールのカバレッジが低い（13.28%）ため、各 OS とディストリビューションに対するモックテストを追加
5. **ブランチカバレッジの向上**: 特にエラー処理パスのテストケース追加と複雑な条件分岐のテスト強化
6. **Docker インストールプロセスの最適化**: 各種ディストリビューションへの対応強化
7. **テンプレート管理の改善**: リソースフォルダからの柔軟なテンプレート読み込みと拡張性の向上

## 実装済みの改善点（2024-04-05）

以下の改善を完了しました：

1. **リソース管理の改善**:

   - `.devcontainer`ディレクトリと設定ファイルを`resources/templates/devcontainer_template`に移動
   - テンプレートファイルに`.template`拡張子を追加して明確に識別
   - エクステンションのビルド時と実行時の両方でリソースが利用可能に

2. **VS Code パスアクセスの最適化**:

   - `vscode.Uri.joinPath`を使用して安全なリソースアクセスを実装
   - 相対パスによる URI の構築を改善

3. **エラー処理の強化**:

   - ファイル操作の個別エラー処理
   - より具体的なエラーメッセージ表示
   - 出力ディレクトリの存在確認と自動作成

4. **テストの改善**:
   - `vscode.Uri.joinPath`のモック追加
   - 新しいリソース管理方法に対応したテストケース更新
   - テストカバレッジの向上

## 事前チェックフロー

1. **Docker インストール確認**:
   - システムに Docker がインストールされているかを確認
   - インストールされていない場合は自動インストールを提案

2. **Docker 権限確認**:
   - ユーザーが Docker コマンドを実行する権限があるかを確認
   - 権限がない場合は適切な対処方法を提案
