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
  - Docker がインストールされていること（自動インストール機能あり）
  - Remote Containers 拡張機能がインストールされていること

## アーキテクチャ

### コンポーネント

1. **VSCode 拡張機能**: ユーザーインターフェースとコマンド提供
2. **Docker コンテナ**: R/Python 実行環境（kokeh/hu_bioinfo:stable イメージを使用）
3. **Docker Compose**: コンテナ設定と環境変数管理

### ディレクトリ構造

```
work-env/
├── src/                  # 拡張機能のソースコード
│   ├── extension.ts      # メインの拡張機能コード
│   └── test-helper.ts    # テスト用ヘルパー関数
├── resources/            # 静的リソース
│   ├── templates/        # テンプレートファイル
│   │   ├── devcontainer_template/  # .devcontainerディレクトリのテンプレート
│   │   │   ├── devcontainer.json.template  # devcontainer設定テンプレート
│   │   │   └── docker-compose.yml.template # Docker Compose設定テンプレート
│   │   └── ... その他テンプレートファイル
│   └── ... その他リソース
├── test/                 # テストコード
│   ├── unit/             # ユニットテスト
│   │   ├── basic.test.ts # 基本的な機能テスト
│   │   └── error-handlers.test.ts # エラーハンドリングテスト
│   ├── workflow/         # ワークフローテスト
│   │   └── e2e-workflow.test.ts # エンドツーエンドワークフローテスト
│   ├── setup.ts          # テスト環境セットアップ
│   └── index.ts          # テストのエントリーポイント
└── package.json          # エクステンション設定
```

## 主要コマンド

拡張機能は以下の 2 つのコマンドを提供します：

1. **work-env.start-work-env**: 開発環境を起動するコマンド

   - 初回実行時は設定ウィザードを表示
   - Docker と Remote Containers の存在をチェック
   - Docker がインストールされていない場合、自動インストールを提案
   - 必要な Docker イメージをプル
   - リソースフォルダからテンプレートを取得し、環境設定に基づいて Docker Compose/.devcontainer ファイルを生成
   - コンテナ内でフォルダを開く

2. **work-env.reset-config**: 設定をリセットするコマンド
   - 既存のコンテナを削除
   - 設定ウィザードを再度表示
   - 新しい設定で環境を再構築

## Docker インストール機能

Docker がシステムにインストールされていない場合、拡張機能は以下の機能を提供します：

1. **Docker インストール検出**: システムに Docker がインストールされているかを確認
2. **OS 検出**: ユーザーの OS を自動的に検出（Linux、macOS、Windows、WSL）
3. **自動インストールオプション**: Linux ベースの Docker をコマンドラインからインストールするオプションを提供
4. **インストールプロセス**:
   - Linux: 適切なディストリビューション向けインストールスクリプトを実行（Docker Engine）
   - macOS: Homebrew を使用して Docker Engine をインストール
   - Windows（非 WSL 環境）: WSL2 で Ubuntu などの Linux カーネルを使用するように警告し、WSL2 セットアップガイドを表示
   - Windows（WSL 環境）: WSL 内の Linux ディストリビューションに Docker Engine を直接インストール
5. **進捗表示**: インストールプロセスの進捗状況を表示
6. **検証**: インストール完了後に Docker が正常に動作することを検証
7. **ユーザー権限管理**: 必要に応じて Docker グループにユーザーを追加し、sudo なしで Docker コマンドを実行できるように設定

### Docker インストールの詳細フロー

1. **OS 検出フェーズ**:

   - プラットフォーム（Windows/macOS/Linux）の検出
   - Windows の場合、WSL 環境かどうかを検出
   - Linux の場合、ディストリビューション（Ubuntu/Debian/CentOS など）を検出

2. **インストール前確認**:

   - ユーザーに Docker インストールの確認メッセージを表示
   - Windows 非 WSL 環境の場合、WSL2 の使用を推奨するメッセージを表示し、インストールをキャンセルするオプションを提供

3. **インストール実行**:

   - Linux/WSL (Ubuntu/Debian): apt を使用した Docker Engine のインストール

   ```bash
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io
   sudo usermod -aG docker $USER
   ```

   - Linux/WSL (CentOS/RHEL): yum を使用した Docker Engine のインストール

   ```bash
   sudo yum install -y docker-ce docker-ce-cli containerd.io
   sudo systemctl start docker
   sudo usermod -aG docker $USER
   ```

   - macOS: Homebrew を使用した Docker のインストール

   ```bash
   brew install --cask docker
   ```

4. **インストール後設定**:

   - Docker サービスの起動確認
   - ユーザーを docker グループに追加（再ログイン要求）
   - Docker の基本的な動作テスト（hello-world イメージの実行）

5. **トラブルシューティング**:
   - インストール失敗時の詳細なエラーログ表示
   - 一般的な問題の解決策を提案
   - 手動インストール方法へのリンク表示

## 設定プロセス

1. **プロジェクトフォルダの選択**: 開発するプロジェクトが格納されているフォルダを選択
2. **キャッシュディレクトリの選択**: ライブラリやパッケージなどのキャッシュを格納するディレクトリを選択
3. **GitHub Personal Access Token (PAT) の入力**: GitHub リポジトリにアクセスするための認証トークンを入力
4. **テンプレートの処理**: リソースフォルダから`devcontainer_template`などのテンプレートを取得し、ユーザー設定で値を置換

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

拡張機能のテスト戦略は、以下の2種類のテストに焦点を当てています：

1. **ユニットテスト (Unit Tests)**:
   - **モジュール単位のテスト**: 個々の機能とクラスの動作を検証
   - **エラーハンドリングテスト**: 各種エラーケースの適切な処理を検証
   - **モック/スタブを活用**: VS Code API、Docker コマンド実行などの外部依存をモック化

2. **ワークフローテスト (Workflow Tests)**:
   - **ユーザーシナリオのエンドツーエンドテスト**: 実際のユースケースに沿った一連の操作を検証
   - **統合テスト**: 複数のモジュールが連携して正しく動作することを確認
   - **環境構築プロセスの検証**: Docker コンテナのセットアップから環境構築までの一連のフローを検証

これらのテストによって、コードの品質と機能の信頼性を確保します。テストは CI/CD パイプラインの一部として自動実行され、コードの変更が既存の機能に影響を与えないことを保証します。

### テストカバレッジ目標

| 測定項目     | 目標カバレッジ |
|------------|--------------|
| 関数        | 80%以上      |
| 行          | 70%以上      |
| ブランチ    | 60%以上      |

### 現在のテストカバレッジ

現在のテストカバレッジ状況は以下の通りです（2025-04-05 時点）:

| ファイル            | ステートメント | ブランチ | 関数   | 行     |
| ------------------- | -------------- | -------- | ------ | ------ |
| 全体                | 55.44%         | 41.47%   | 57.79% | 56.09% |
| docker-installer.ts | 13.28%         | 9.58%    | 11.76% | 13.47% |
| error-handlers.ts   | 87.30%         | 89.83%   | 80.00% | 87.30% |
| extension.ts        | 67.60%         | 50.00%   | 85.29% | 68.23% |
| test-helper.ts      | 58.17%         | 20.89%   | 50.00% | 59.50% |

詳細なテスト結果については `/docs/test-results.md` を参照してください。

## Docker コンテナ設定

コンテナ設定はテンプレートから生成されます。基本的なテンプレート内容は以下の通りです：

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
