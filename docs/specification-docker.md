# bioinfo-launcher 拡張機能仕様書 - Docker関連仕様

## Docker コンテナ設定

コンテナ設定はテンプレートから生成されます。基本的なテンプレート内容は以下の通りです：

```yaml
services:
  container:
    image: hubioinfows/lite_env:latest
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

## Docker イメージ自動更新機能

**v1.4.2 で追加**: DockerHub のイメージが更新された場合、自動的に検知して既存コンテナのリビルドを提案する機能を追加しました。

### 動作概要

1. **イメージ更新検知**: `start-launcher` コマンド実行時に、ローカルとリモートの Docker イメージのハッシュを比較
2. **ユーザー確認**: 更新が検知された場合、リビルドするかどうかユーザーに確認
3. **自動リビルド**: ユーザーが承認した場合、既存コンテナを削除し、新しいイメージでコンテナを再作成

### 機能詳細

#### イメージ更新検知機能

- **対象**: 設定されたコンテナイメージ（デフォルト: `hubioinfows/lite_env:latest`）
- **検知方法**: `docker images` コマンドでローカルイメージのハッシュを取得し、`docker pull` 後のハッシュと比較
- **表示情報**: 
  - 更新の有無
  - 古いイメージハッシュ（最初の12文字）
  - 新しいイメージハッシュ（最初の12文字）

#### ユーザー確認ダイアログ

更新が検知されると以下のオプションが表示されます：

- **「リビルドする」**: 既存コンテナを削除し、新しいイメージで再作成
- **「後で決める」**: イメージは更新されるが、既存コンテナはそのまま維持

#### 自動リビルドプロセス

1. 既存コンテナの削除（`bioinfo-launcher` フィルタに基づく）
2. 新しいイメージでのコンテナ再作成（VS Code Dev Container 機能を使用）
3. ユーザーへの完了通知

### 技術仕様

#### 新規追加関数

1. **`checkDockerImageUpdate(imageName: string)`**
   - ローカルとリモートのイメージハッシュを比較
   - 戻り値: `{updated: boolean, localHash?: string, newHash?: string}`

2. **`confirmContainerRebuild(imageName: string)`**
   - ユーザーにリビルド確認ダイアログを表示
   - 戻り値: `boolean`（リビルドを選択した場合は true）

#### 変更された関数

- **`preparation(context: vscode.ExtensionContext)`**
  - 通常の pull 処理から更新検知機能に変更
  - グローバル State を使用してリビルド状態を管理

- **`activate(context: vscode.ExtensionContext)`**
  - start-launcher コマンドにリビルド完了通知を追加

### 設定との連携

この機能は既存の `config-container` コマンドと連携し、以下の場合に動作します：

- デフォルトイメージ: `hubioinfows/lite_env:latest`
- カスタムイメージ: ユーザーが `config-container` で選択したイメージ

### 注意事項

- 初回実行時（ローカルイメージが存在しない場合）は常に更新として扱われます
- リビルドを選択しなかった場合、VS Code Dev Container 機能が自動的にリビルドを提案する場合があります
- ネットワーク接続が必要です（DockerHub からのイメージ取得のため）