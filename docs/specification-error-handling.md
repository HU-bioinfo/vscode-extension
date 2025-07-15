# bioinfo-launcher 拡張機能仕様書 - エラー処理仕様

## エラーハンドリング

拡張機能は以下のエラーケースを検出して適切にハンドリングします：

### 1. Docker 関連エラー

- Docker がインストールされていない場合
- Docker の実行権限がない場合
- Docker イメージのプルに失敗した場合

### 2. 設定関連エラー

- プロジェクトフォルダが選択されていない場合
- キャッシュフォルダが選択されていない場合
- GitHub PAT が入力されていない場合

### 3. コンテナ関連エラー

- コンテナでフォルダを開けない場合
- Docker Compose ファイルの生成に失敗した場合

## 技術的改善点（v1.4.5）

### コード品質の改善

1. **型安全性の向上**:
   - error-handlers.ts のすべての `any` 型を `unknown` 型に変更
   - ExtensionSettings インターフェースを定義して設定オブジェクトの型安全性を確保
   - VSCode API の型定義を適切にインポート

2. **非同期処理の修正**:
   - `dockerOpenInContainer` 関数の呼び出しに await を追加
   - 適切なエラー伝播を確保

3. **エラーハンドリングの強化**:
   - `checkDockerImageUpdate` 関数に詳細なエラー処理を追加
   - Docker pull エラーの詳細ログ記録
   - Error オブジェクトの適切なハンドリング

4. **リソース管理の改善**:
   - 出力チャンネルをグローバルで管理
   - deactivate 時に適切に dispose 処理

5. **コード重複の除去**:
   - extension.ts から重複していた以下の関数を削除：
     - `validateParentDirectory`
     - `preflightChecks`
     - `pullDockerImage`
     - `removeExistingContainers`
     - `isDockerInstalled`
     - `checkDockerPermissions`
   - それぞれ対応するモジュールからインポートして使用