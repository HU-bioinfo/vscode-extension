# bioinfo-launcher 拡張機能仕様書 - テンプレート仕様

## テンプレート構成

テンプレート構成は以下の3つの主要なディレクトリから構成されています：

1. **container_template**: `container`ディレクトリのテンプレートで、devcontainer.jsonやdocker-compose.ymlなどの基本設定ファイルを含む
2. **cache_template**: `cache`ディレクトリのテンプレートで、キャッシュ関連の初期設定ファイルが含まれる
3. **projects_template**: `container/projects`ディレクトリのテンプレートで、プロジェクト関連の初期ファイルが含まれる
   - **sample_project_template**: R開発用のサンプルプロジェクトテンプレート
     - サブディレクトリも`_template`サフィックスを持つ (`R_template`, `data_template`など)
     - ファイルは`.template`拡張子を持つ (`.Rprofile.template`, `renv.lock.template`など)

## テンプレートからの生成ルール

- テンプレートファイル名から`_template`や`.template`拡張子が取り除かれる
- ユーザーが選択した親ディレクトリに、適切なサブディレクトリ構造を保ちながら配置される

## テンプレート更新時の動作

**v1.4.9 で追加**: エクステンション更新時にテンプレートも最新版に更新されるようにしました

### 上書きポリシー

1. **`.devcontainer`ディレクトリ**:
   - `start-launcher`や`reset-config`実行時に常に最新テンプレートで上書き
   - devcontainer.jsonやdocker-compose.ymlの設定を最新版に更新
   - エクステンションのバグ修正や機能改善が反映される

2. **`projects`ディレクトリ**:
   - 初回のみテンプレートを展開
   - 既存ファイルがある場合はスキップ（ユーザーデータ保護）
   - ユーザーが作成したプロジェクトファイルは保持される

3. **`cache`ディレクトリ**:
   - テンプレート展開の対象外
   - ユーザーのキャッシュデータはそのまま保持

## テンプレート管理の改善

### 実装済みの改善点（2024-04-05）

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

## テンプレート変数

`resources/templates/`ディレクトリ内のファイルは以下の変数をサポート:
- `{{USER}}` - システムユーザー名
- `{{REPO_TOKEN}}` - GitHub Personal Access Token
- `{{IMAGE_TAG}}` - 選択されたDockerイメージタグ
- `{{GITHUB_PAT}}` - GitHub Personal Access Token
- `{{PROJECT_FOLDER}}` - プロジェクトディレクトリパス
- `{{CACHE_FOLDER}}` - キャッシュディレクトリパス
- `{{DOCKER_IMAGE}}` - Dockerイメージ名