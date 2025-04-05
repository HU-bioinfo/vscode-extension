# work-env テスト戦略

## テスト概要

work-env 拡張機能のテストは、以下の種類のテストに焦点を当てて実施します：

- **ユニットテスト**: 個別の関数やコンポーネントの動作を確認（モック環境）
- **統合テスト**: 実際のVS Code APIを使用した統合動作を確認
- **E2Eテスト**: 実際のVS Code環境でのエンドツーエンドの動作検証
- **ワークフローテスト**: ユーザーの使用シナリオに沿った一連の操作の検証

これらのテストにより、拡張機能の信頼性と安定性を確保します。

## 重要: テスト実行に関する注意事項

**ユニットテストとワークフローテストは必ず個別に実行してください。**

- ユニットテスト: `npm run unit-test`
- ワークフローテスト: `npm run workflow-test`
- E2Eテスト: `npm run e2e-test`
- すべてのテスト: `npm run test:all`（内部で順次実行）

両方のテストを同時に実行すると、以下の問題が発生します:
1. Sinonのスタブが重複して登録されエラーになる
2. テスト環境の衝突（モックモードと実際のVS Code API間）
3. テスト間の干渉によるランダムな失敗

これらの問題は、テストの実行環境と設計に起因するもので、各テストタイプが異なる実行コンテキストを必要とするためです。同時実行を試みると、`Attempted to wrap X which is already stubbed`のようなエラーが発生します。

`npm run test:all`のような一括実行コマンドは、内部で個別に順次実行するように設計されています。

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
  "test": "npm run test:unified",
  "unit-test": "cross-env NODE_ENV=test VSCODE_MOCK=1 mocha --require ts-node/register --ui bdd --extension ts,tsx --recursive 'test/unit/**/*.test.ts' --timeout 60000",
  "test:coverage": "cross-env NODE_ENV=test VSCODE_MOCK=1 nyc npm run test:unified",
  "integration-test": "npm run compile && cross-env VSCODE_MOCK=0 node ./out/test/runTest.js",
  "e2e-test": "npm run compile && cross-env TEST_TYPE=e2e node ./out/test/runTest.js",
  "workflow-test": "npm run compile && node ./out/test/runTest.js",
  "test:unified": "npm run unit-test && npm run workflow-test",
  "test:all": "npm run test:unified"
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

### E2Eテスト

E2Eテストは、実際のVS Code環境内での拡張機能の動作を検証するためのテストです。モックを使わず、実際のVS Code APIを使用して、ユーザーの操作シーケンスに沿ったテストを実行します。

E2Eテストは `test/workflow/` ディレクトリ内の `.test.ts` ファイルに記述されています。

- `e2e.test.ts`: 基本的なE2Eテスト
- `e2e-workflow.test.ts`: ユーザーワークフローに沿ったE2Eテスト

これらのテストは以下のコマンドで実行できます：

```bash
npm run e2e-test
npm run workflow-test
```

#### E2Eテストの特徴

1. **実際のユーザー操作シーケンスの模倣**
   - コマンドパレット経由のコマンド実行
   - ダイアログでの選択操作
   - フォルダ選択、入力フィールドへの入力など

2. **実際の環境での検証**
   - 実際のVS Code API呼び出し
   - 実際のファイルシステム操作
   - 実際のUIとの対話

3. **テスト用の隔離環境**
   - テスト専用のプロジェクトフォルダとキャッシュフォルダを使用
   - テスト後のクリーンアップ

#### E2Eテスト環境のセットアップ

```typescript
// テスト用のプロジェクトとキャッシュフォルダのパス
const TEST_PROJECT_DIR = path.join(__dirname, '..', 'test-resources', 'test-project');
const TEST_CACHE_DIR = path.join(__dirname, '..', 'test-resources', 'test-cache');

// テスト環境のセットアップヘルパー関数
async function setupTestEnvironment() {
  console.log('テスト環境をセットアップしています...');
  
  // テスト用ディレクトリの作成
  if (!fs.existsSync(TEST_PROJECT_DIR)) {
    fs.mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(TEST_CACHE_DIR)) {
    fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
  }
  
  // テスト用のダミーファイルを作成
  fs.writeFileSync(path.join(TEST_PROJECT_DIR, 'test-file.txt'), 'Test content');
}
```

#### UI操作のシミュレーション

E2Eテストでは、VS Code APIの関数をオーバーライドして、ユーザーの選択やダイアログ操作をシミュレートします：

```typescript
// 通常のUI関数を保存
const showInputBoxOriginal = vscode.window.showInputBox;
const showOpenDialogOriginal = vscode.window.showOpenDialog;

// モックUIをセットアップ
vscode.window.showInputBox = async function (options?: vscode.InputBoxOptions): Promise<string | undefined> {
  if (options?.prompt?.includes('GitHub')) {
    return 'test-pat-123456';
  }
  return undefined;
};

vscode.window.showOpenDialog = async function (options?: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> {
  if (options?.title?.includes('プロジェクト')) {
    return [vscode.Uri.file(TEST_PROJECT_DIR)];
  } else if (options?.title?.includes('キャッシュ')) {
    return [vscode.Uri.file(TEST_CACHE_DIR)];
  }
  return undefined;
};

try {
  // テスト対象のコード実行
  // ...
} finally {
  // 元のUIに戻す
  vscode.window.showInputBox = showInputBoxOriginal;
  vscode.window.showOpenDialog = showOpenDialogOriginal;
}
```

#### E2Eテストケースの例

```typescript
it('work-env.reset-configコマンドが設定をリセットできること', async function () {
  // コマンド実行前に設定ファイルを作成
  const testConfigPath = path.join(TEST_CACHE_DIR, 'work-env-config.json');
  const testConfig = {
    projectFolder: '/test/project',
    cacheFolder: '/test/cache',
    githubPat: 'test-pat'
  };
  
  fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  assert.ok(fs.existsSync(testConfigPath), '設定ファイルが作成されていません');

  // 通常のUIを使わずにテスト用のモックUI（自動応答）をセットアップ
  const showInformationMessageOriginal = vscode.window.showInformationMessage;
  vscode.window.showInformationMessage = async function (...args: any[]): Promise<any> {
    return '設定をリセット';
  };

  try {
    // コマンドを実行
    await vscode.commands.executeCommand('work-env.reset-config');
    
    // 設定ファイルが削除されたことを確認
    assert.ok(!fs.existsSync(testConfigPath) || 
             JSON.stringify(JSON.parse(fs.readFileSync(testConfigPath, 'utf8'))) === '{}', 
             '設定ファイルがリセットされていません');
  } finally {
    // 元のUIに戻す
    vscode.window.showInformationMessage = showInformationMessageOriginal;
  }
});
```

#### 現在のE2Eテスト対象

1. **拡張機能の基本機能**
   - 拡張機能のアクティベーション
   - コマンドの登録と実行

2. **設定関連の機能**
   - 設定のバリデーション
   - 設定のリセット

3. **ユーザー操作シーケンス**
   - プロジェクトフォルダの選択
   - キャッシュフォルダの選択
   - GitHubトークンの入力

4. **ユーザーワークフロー**
   - 初回実行ワークフロー - 環境構築プロセス全体
   - 設定リセットワークフロー - `work-env.reset-config`コマンド
   - Dockerインストールワークフロー - Docker未インストール時の対応
   - Remote Containersインストールワークフロー - Remote Containers拡張機能未インストール時の対応

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

# ワークフローテスト
npm run workflow-test

# E2Eテスト
npm run e2e-test

# すべてのテスト
npm run test:all
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
   - 長時間実行されるE2Eテストには十分なタイムアウト時間を設定する

## 今後の改善課題

現在のテストカバレッジは以下の通りです（2025-04-05時点）：

| ファイル            | ステートメント | ブランチ | 関数   | 行     |
| ------------------- | -------------- | -------- | ------ | ------ |
| 全体                | 55.44%         | 41.47%   | 57.79% | 56.09% |
| docker-installer.ts | 13.28%         | 9.58%    | 11.76% | 13.47% |
| error-handlers.ts   | 87.30%         | 89.83%   | 80.00% | 87.30% |
| extension.ts        | 67.60%         | 50.00%   | 85.29% | 68.23% |
| test-helper.ts      | 58.17%         | 20.89%   | 50.00% | 59.50% |

以下の領域でさらなるテストカバレッジ向上が必要です：

1. **docker-installer.ts**
   - 現在のカバレッジが13.28%と低く、重点的な改善が必要
   - 各OS環境に対応したモックテストの追加
   - インストールプロセスのシミュレーション強化

2. **test-helper.ts**
   - ブランチカバレッジが20.89%と低く、条件分岐のテスト強化が必要
   - 各種エラーケースのシミュレーション追加
   - モック関数のエッジケーステスト追加

3. **Docker関連の操作のテスト強化**
   - DockerのインストールとPreflight checkのテスト拡充
   - Docker Composeファイル生成のテスト追加
   
4. **コンテナ関連の操作のテスト**
   - コンテナのリセットと再起動のテスト
   - コンテナ内でのコマンド実行のテスト
