# Features

## 自動リビルド機能（Docker Image Update Detection）

**NEW in v1.4.2**: DockerHubのイメージが更新された場合、自動的に検知して既存コンテナのリビルドを提案する機能を追加しました。

### 動作概要

1. **イメージ更新検知**: `start bioinfo-launcher`コマンド実行時に、ローカルとリモートのDockerイメージのハッシュを比較
2. **ユーザー確認**: 更新が検知された場合、リビルドするかどうかユーザーに確認
3. **自動リビルド**: ユーザーが承認した場合、既存コンテナを削除し、新しいイメージでコンテナを再作成

### 機能詳細

#### イメージ更新検知機能

- **対象**: 設定されたコンテナイメージ（デフォルト: `hubioinfows/lite_env:latest`）
- **検知方法**: `docker images`コマンドでローカルイメージのハッシュを取得し、`docker pull`後のハッシュと比較
- **表示情報**: 
  - 更新の有無
  - 古いイメージハッシュ（最初の12文字）
  - 新しいイメージハッシュ（最初の12文字）

#### ユーザー確認ダイアログ

更新が検知されると以下のオプションが表示されます：

- **「リビルドする」**: 既存コンテナを削除し、新しいイメージで再作成
- **「後で決める」**: イメージは更新されるが、既存コンテナはそのまま維持

#### 自動リビルドプロセス

1. 既存コンテナの削除（`bioinfo-launcher`フィルタに基づく）
2. 新しいイメージでのコンテナ再作成（VS Code Dev Container機能を使用）
3. ユーザーへの完了通知

### メッセージ例

#### イメージ更新検知時
```
[bioinfo-launcher] Dockerイメージが更新されました（hubioinfows/lite_env:latest）
旧バージョン: abc123def456
新バージョン: xyz789uvw012
```

#### リビルド実行時
```
[bioinfo-launcher] 既存のコンテナを削除しました。新しいイメージでコンテナが再作成されます。
[bioinfo-launcher] 新しいDockerイメージでコンテナが作成されます。初回起動時はビルドに時間がかかる場合があります。
```

#### リビルドしない場合
```
[bioinfo-launcher] イメージは更新されましたが、既存のコンテナはそのままです。次回VSCodeでコンテナを開いたときに、リビルドを提案される場合があります。
```

#### 更新がない場合
```
[bioinfo-launcher] Dockerイメージは最新です（hubioinfows/lite_env:latest）
```

### 技術仕様

#### 新規追加関数

1. **`checkDockerImageUpdate(imageName: string)`**
   - ローカルとリモートのイメージハッシュを比較
   - 戻り値: `{updated: boolean, localHash?: string, newHash?: string}`

2. **`confirmContainerRebuild(imageName: string)`**
   - ユーザーにリビルド確認ダイアログを表示
   - 戻り値: `boolean`（リビルドを選択した場合はtrue）

#### 変更された関数

- **`preparation(context: vscode.ExtensionContext)`**
  - 通常のpull処理から更新検知機能に変更
  - グローバルStateを使用してリビルド状態を管理

- **`activate(context: vscode.ExtensionContext)`**
  - start-launcherコマンドにリビルド完了通知を追加

### 設定との連携

この機能は既存の`config-container`コマンドと連携し、以下の場合に動作します：

- デフォルトイメージ: `hubioinfows/lite_env:latest`
- カスタムイメージ: ユーザーが`config-container`で選択したイメージ

### 注意事項

- 初回実行時（ローカルイメージが存在しない場合）は常に更新として扱われます
- リビルドを選択しなかった場合、VS Code Dev Container機能が自動的にリビルドを提案する場合があります
- ネットワーク接続が必要です（DockerHubからのイメージ取得のため）

## その他の機能

### 基本機能
- コンテナ環境の自動セットアップ
- GitHub Personal Access Token の設定
- プロジェクトテンプレートの展開

### コマンド一覧
- `bioinfo-launcher.start-launcher`: 開発環境の起動
- `bioinfo-launcher.reset-config`: 設定のリセット  
- `bioinfo-launcher.config-container`: コンテナイメージの設定 