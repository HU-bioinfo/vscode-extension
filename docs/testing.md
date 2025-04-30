# bioinfo-launcher テスト戦略

## テスト概要

bioinfo-launcher 拡張機能のテストは、以下の種類のテストに焦点を当てて実施します：

- **ユニットテスト**: 個別の関数やコンポーネントの動作を確認（モック環境）
- **カバレッジ**: ユニットテスト実行時にコードカバレッジを計測し、品質を担保する

これらのテストにより、拡張機能の信頼性と安定性を確保します。

## 重要: テスト実行に関する注意事項

- ユニットテスト: `npm run unit-test`
- コードカバレッジ: `npm run test:coverage`

## テスト環境

### 必要なツール

- Node.js と npm
- mocha - テストフレームワーク
- ts-node - TypeScriptで直接テストを実行するためのツール
- nyc (Istanbul) - コードカバレッジ計測ツール
- sinon - モック・スタブ・スパイ作成用ライブラリ
- cross-env - 環境変数の設定

### テスト設定

テストの設定は `package.json` に定義されています：

```json
"scripts": {
  "test": "npm run unit-test",
  "unit-test": "cross-env NODE_ENV=test VSCODE_MOCK=1 mocha --require ts-node/register --ui bdd --extension ts,tsx --recursive 'test/unit/**/*.test.ts' --timeout 60000",
  "test:coverage": "cross-env NODE_ENV=test VSCODE_MOCK=1 nyc npm run unit-test"
}
```

### テストモード

テストは単一のユニットテストモードで運用されています。
テストモードは `test/setup.ts` で管理されています：

```typescript
export enum TEST_MODE {
  UNIT = 'ユニットテスト'
}

export const CURRENT_TEST_MODE = TEST_MODE.UNIT;

console.log(`テストモード: ${CURRENT_TEST_MODE}`);
```

## テストの種類

### ユニットテスト

ユニットテストは `test/unit/` ディレクトリ内の `.test.ts` ファイルに記述されています。

- `basic.test.ts`: 基本的な機能テスト
- `error-handlers.test.ts`: エラーハンドリングのテスト
- `docker-install.test.ts`: Dockerインストール関連のテスト
- `test-helper.test.ts`: テストヘルパー関数のテスト
- `vscode-api.test.ts`: VS Code API関連のテスト

これらのテストは以下のコマンドで実行できます：

```bash
npm run unit-test
```

#### ユニットテスト内容

- **基本的なテスト**:
  - エラーの有無による条件分岐の確認
  - エラーメッセージ解析の確認

- **エラーハンドリングテスト**:
  - Docker 関連のエラー処理確認
  - Docker Compose 関連のエラー処理確認
  - ファイルシステム関連のエラー処理確認
  - ネットワーク関連のエラー処理確認
  - 入力チェック関連のエラー処理確認

- **拡張機能のテスト**:
  - コマンド登録のテスト
  - アクティベーション時の動作確認
  - Remote Containers 拡張機能チェック
  - Docker 関連機能のテスト
  - フォルダコピーや権限設定のテスト

## モック戦略

実際の VSCode API や Docker コマンドの代わりにモックを使用します：

### VSCode API モック

テスト用に VSCode API の一部をモックします。以下はモックの実装方法です：

```typescript
// src/test-helper.ts からの抜粋
const vscodeModule: VSCodeNamespace =
  process.env.NODE_ENV !== "test"
    ? (require("vscode") as VSCodeNamespace)
    : {
        window: {
          showInformationMessage: sinon.stub(),
          showErrorMessage: sinon.stub(),
          showInputBox: sinon.stub(),
          showOpenDialog: sinon.stub(),
          activeTerminal: null,
        },
        commands: {
          executeCommand: sinon.stub(),
          registerCommand: sinon.stub(),
        },
        // その他のモック対象
      };
```

- Sinon: 関数のスタブとスパイを作成するために使用
- 環境変数 `NODE_ENV=test` を使用してテスト環境を検出
- テスト時に VSCode API の代わりにモックオブジェクトを提供

### Docker コマンドモック

Docker コマンドは、`child_process.exec` のモックによりテストします：

```typescript
// Docker コマンドのモック例
export function mockDockerSuccess() {
  childProcess.exec.callsFake((cmd, callback) => {
    if (cmd.includes("docker") && callback && typeof callback === "function") {
      callback(null, { stdout: "Docker is running", stderr: "" }, "");
    }
    return {
      on: sinon.stub(),
      stdout: { on: sinon.stub() },
      stderr: { on: sinon.stub() },
    };
  });
}

// Docker エラーのモック
export function mockDockerFailure(errorMsg = "Docker command failed") {
  childProcess.exec.callsFake((cmd, callback) => {
    if (cmd.includes("docker") && callback && typeof callback === "function") {
      callback(new Error(errorMsg), { stdout: "", stderr: errorMsg }, "");
    }
    return {
      on: sinon.stub(),
      stdout: { on: sinon.stub() },
      stderr: { on: sinon.stub() },
    };
  });
}
```

### ファイルシステムモック

`fs` モジュールをモックして、ファイルシステム操作をテストします：

```typescript
// ファイルシステムのモック例
export function setupMockFileSystem(structure: Record<string, any>) {
  fsMock.existsSync.callsFake((filePath: string) => {
    // ファイルパスが存在するかチェックするモック実装
    return true; // または計算された結果
  });
}
```

## テスト実行手順

以下のコマンドでテストを実行できます：

```bash
# ユニットテスト
npm run unit-test

# カバレッジレポート付きユニットテスト
npm run test:coverage
```

カバレッジレポートは `coverage/` ディレクトリに生成されます。

## テストのベストプラクティス

1. **テスト用の隔離環境を使用する**
   - 実際の環境に影響を与えないようにする
   - テスト専用のディレクトリを使用する

2. **テスト後のクリーンアップ**
   - テスト中に作成されたファイルやリソースを削除する
   - afterブロックで必ずリソースを解放する

3. **UI操作の適切なシミュレーション**
   - 実際のVS Code APIをオーバーライドする
   - try/finallyパターンで確実に元の関数に戻す

4. **適切なエラーハンドリング**
   - 各テストケースでは適切にエラーをキャッチする
   - エラーメッセージを分かりやすく表示する

5. **タイムアウト設定**
   - 長時間実行されるテストには十分なタイムアウト時間を設定する
