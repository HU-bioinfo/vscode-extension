# work-env テスト戦略

## テスト概要

work-env 拡張機能のテストは、以下の2つのタイプのテストに焦点を当てて実施します：

- **ユニットテスト**: 個別の関数やコンポーネントの動作を確認（モック環境）
- **統合テスト**: 実際のVS Code APIを使用した統合動作を確認

これらのテストにより、拡張機能の信頼性と安定性を確保します。

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
  "unit-test": "cross-env NODE_ENV=test VSCODE_MOCK=1 mocha --require ts-node/register --ui bdd --extension ts,tsx --recursive 'test/**/*.test.ts' --exclude 'test/runTest.ts' --timeout 60000",
  "integration-test": "npm run compile && cross-env VSCODE_MOCK=0 node ./out/test/runTest.js",
  "test:coverage": "cross-env NODE_ENV=test VSCODE_MOCK=1 nyc npm run unit-test"
}
```

### テストモード

テストは2つのモードで実行されます：

1. **モックモード（ユニットテスト）**: `VSCODE_MOCK=1` 環境変数使用
   - VS Code APIをモック化
   - 外部依存をモック化
   - 高速に実行可能

2. **統合テストモード**: `VSCODE_MOCK=0` 環境変数使用
   - 実際のVS Code APIを使用
   - 一部のテストはスキップ
   - 実際の環境での動作確認

テストモードは `test/setup.ts` で管理されています：

```typescript
export enum TEST_MODE {
  MOCK = 'モック（ユニットテスト）',
  INTEGRATION = '統合テスト'
}

// 環境変数からテストモードを決定
export const CURRENT_TEST_MODE = process.env.VSCODE_MOCK === '0' 
  ? TEST_MODE.INTEGRATION 
  : TEST_MODE.MOCK;

// テスト開始時にモードを表示
console.log(`テストモード: ${CURRENT_TEST_MODE}`);
```

## テストの種類

### ユニットテスト

ユニットテストは `test/` ディレクトリ内の `.test.ts` ファイルに記述されています。

- `basic.test.ts`: 基本的な機能テスト
- `error-handlers.test.ts`: エラーハンドリングのテスト
- `extension.test.ts`: 拡張機能のメイン機能テスト
- `test-helper.test.ts`: テストヘルパー関数のテスト

これらのテストは以下のコマンドで実行できます：

```bash
npm run unit-test
# または
npm test
```

#### テスト内容

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
    let current = structure;
    const parts = filePath.split(path.sep).filter(Boolean);

    for (const part of parts) {
      if (!current[part]) {
        return false;
      }
      current = current[part];
    }

    return true;
  });

  // その他のファイルシステム関数もモック化
}
```

### モックのリセットと関数の復元

テスト間の干渉を防ぐため、各テスト前にモックをリセットし、元の関数を復元する方法を採用しています：

```typescript
// テスト前のセットアップ
beforeEach(() => {
  // すべてのモックをリセット
  sinon.restore();
  resetMocks();
});

// 特定の関数をモックする例（try/finallyパターン）
it("特定のテストケース", function () {
  // オリジナル関数の保存
  const originalFunction = moduleName.functionName;

  try {
    // テスト用にモック関数を設定
    moduleName.functionName = sinon.stub().returns(expectedValue);

    // テスト実行と検証
    // ...
  } finally {
    // 必ず元の関数を復元（テストが失敗しても実行される）
    moduleName.functionName = originalFunction;
  }
});
```

このアプローチの利点:

- テスト間の副作用がなくなり、テストの信頼性が向上
- テストが途中で失敗しても、次のテストに影響を与えない
- グローバルなコンテキストを変更する場合でも、元の状態に確実に復元される

## テストカバレッジ

テストカバレッジを測定するために、nyc を使用します：

```bash
npm run test:coverage
```

これにより、以下のカバレッジレポートが生成されます：

```
-------------------|---------|----------|---------|---------|----------------------------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|----------------------------------------
All files          |    64.4 |     51.7 |   58.75 |   65.75 |
 error-handlers.ts |    75.4 |       75 |      70 |    75.4 | ...
 extension.ts      |   78.37 |    57.57 |   92.59 |   78.88 | ...
 test-helper.ts    |   44.91 |    24.13 |   34.88 |   47.16 | ...
-------------------|---------|----------|---------|---------|----------------------------------------
```

### カバレッジ目標

- 関数カバレッジ: 50%以上
- 行カバレッジ: 60%以上
- 分岐カバレッジ: 50%以上

この目標は継続的に改善しながら、最終的には以下を目指します：

- 関数カバレッジ: 90%以上
- 行カバレッジ: 80%以上
- 分岐カバレッジ: 75%以上

## CI/CD パイプライン統合

GitHub Actions を使用して、プルリクエストやプッシュ時に自動的にテストを実行することをお勧めします：

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "16"
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run coverage test
        run: npm run test:coverage
```

## 手動テストチェックリスト

自動テストに加えて、以下の手動テストを実行することをお勧めします：

1. 拡張機能のインストールと有効化
2. 各コマンドの実行と UI の確認
3. エラーシナリオの手動検証
4. 異なる OS 環境での動作確認
