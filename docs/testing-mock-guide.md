# VSCode 拡張機能テストにおけるモックの作成と使用ガイド

このドキュメントでは、VSCode 拡張機能のテストにおけるモック（Mock）の概念、作成方法、使用方法について初学者向けに解説します。

## 目次

1. [モックとは何か](#モックとは何か)
2. [なぜモックが必要なのか](#なぜモックが必要なのか)
3. [Sinon を使ったモックの基本](#sinonを使ったモックの基本)
4. [VSCode API のモック](#vscode-apiのモック)
5. [ファイルシステムのモック](#ファイルシステムのモック)
6. [子プロセスのモック](#子プロセスのモック)
7. [よくある問題と解決策](#よくある問題と解決策)
8. [モックのベストプラクティス](#モックのベストプラクティス)

## モックとは何か

モックとは、テスト対象のコードから参照される実際のコンポーネントの代わりに使用される模擬オブジェクトです。テスト中にコードの特定の部分の動作をシミュレートするために使用されます。

### 主なモックの種類

1. **スタブ（Stub）**: 特定の値を返すだけの簡単な関数/オブジェクト
2. **スパイ（Spy）**: 関数の呼び出しを追跡し、どのように呼び出されたかを記録
3. **フェイク（Fake）**: 実際の実装を簡略化した軽量版
4. **モック（Mock）**: 事前に定義された期待する挙動と実際の使われ方を検証する機能を持つオブジェクト

## なぜモックが必要なのか

VSCode 拡張機能をテストする際、以下の理由からモックが必要になります：

1. **外部依存の分離**: VSCode API や外部サービスへの依存を分離することで、テストを独立させる
2. **制御不能な環境のシミュレーション**: ファイルシステムやネットワークなどの外部要因を制御
3. **テストの高速化**: 実際の操作よりもモックを使った方が処理が速い
4. **エラーケースのテスト**: エラー状態を簡単に再現できる

## Sinon を使ったモックの基本

Sinon は、JavaScript アプリケーションのテストにおいて、スパイ、スタブ、モックを作成するための強力なライブラリです。work-env 拡張機能のテストでも使用しています。

### インストール

```bash
npm install --save-dev sinon
```

### 基本的な使い方

```typescript
import * as sinon from "sinon";
import * as assert from "assert";

// 関数のテスト
function greet(name: string) {
  return `Hello, ${name}!`;
}

// テストケース
describe("基本的なSinonの使い方", () => {
  // スパイの作成
  it("スパイの使用例", () => {
    // 既存の関数をスパイ化
    const greetSpy = sinon.spy(greet);

    // 関数を呼び出す
    const result = greetSpy("World");

    // 検証
    assert.strictEqual(result, "Hello, World!");
    assert.strictEqual(greetSpy.callCount, 1);
    assert.strictEqual(greetSpy.firstCall.args[0], "World");
  });

  // スタブの作成
  it("スタブの使用例", () => {
    // 関数のスタブを作成
    const greetStub = sinon.stub();

    // スタブの動作を定義
    greetStub.withArgs("World").returns("Hello, World!");
    greetStub.withArgs("User").returns("Hello, User!");

    // スタブを呼び出す
    const result1 = greetStub("World");
    const result2 = greetStub("User");

    // 検証
    assert.strictEqual(result1, "Hello, World!");
    assert.strictEqual(result2, "Hello, User!");
    assert.strictEqual(greetStub.callCount, 2);
  });

  // テスト後のクリーンアップ
  afterEach(() => {
    // 全てのスタブ/スパイをリセット
    sinon.restore();
  });
});
```

## VSCode API のモック

VSCode 拡張機能のテストにおいて、VSCode API のモックは特に重要です。実際の VSCode 環境でなくてもテストを実行できるようにするために必要です。

### モジュールレベルでのモック設定

```typescript
// src/test-helper.ts からの抜粋

// VSCode APIの型定義
interface VSCodeNamespace {
  window: {
    showInformationMessage: sinon.SinonStub;
    showErrorMessage: sinon.SinonStub;
    showInputBox: sinon.SinonStub;
    showOpenDialog: sinon.SinonStub;
    activeTerminal: any;
  };
  commands: {
    executeCommand: sinon.SinonStub;
    registerCommand: sinon.SinonStub;
  };
  // ... その他の必要なインターフェース
}

// テスト環境かどうかで実際のVSCodeかモックを使い分け
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
        // ... その他のモック
      };

// モジュールとしてエクスポート
export const vscode = vscodeModule;
```

### テストでの VSCode API モックの使用例

```typescript
import { vscode } from "../src/test-helper";
import * as assert from "assert";

describe("VSCode APIのテスト", () => {
  beforeEach(() => {
    // テスト前にモックをリセット
    vscode.window.showErrorMessage.resetHistory();
    vscode.window.showInformationMessage.resetHistory();
  });

  it("エラーメッセージ表示のテスト", () => {
    // 表示するエラーメッセージ
    const errorMessage = "テストエラー";

    // モックの応答を設定
    vscode.window.showErrorMessage.returns(Promise.resolve("OK"));

    // テスト対象の関数を呼び出す
    someFunction(errorMessage);

    // VSCode APIが正しく呼び出されたか検証
    assert.strictEqual(vscode.window.showErrorMessage.calledOnce, true);
    assert.strictEqual(
      vscode.window.showErrorMessage.firstCall.args[0],
      errorMessage
    );
  });

  it("ユーザー入力のテスト", () => {
    // モックが返す値を設定
    vscode.window.showInputBox.resolves("テスト入力");

    // テスト対象の関数を呼び出す
    return someFunctionThatAsksForInput().then((result) => {
      // 結果を検証
      assert.strictEqual(result, "テスト入力");
      // 入力ボックスが表示されたか検証
      assert.strictEqual(vscode.window.showInputBox.calledOnce, true);
    });
  });
});
```

### モック間の共有 - `_test`インターフェース

異なるモジュール間で一貫したモックを使用するために、インターフェースを提供することが有効です：

```typescript
// モジュールにテスト用インターフェースを追加
export const _test = {
  // モックの設定関数
  setVSCodeMock(mockVscode: any) {
    if (process.env.NODE_ENV === "test") {
      // テスト環境の場合のみモックを上書き
      vscode = mockVscode;
    }
  },
};

// 他のモジュールで使用する例
import { _test as errorHandlerTest } from "./error-handlers";
import { vscode } from "./test-helper";

// テスト開始時にモックを設定
errorHandlerTest.setVSCodeMock(vscode);
```

## ファイルシステムのモック

ファイルシステム操作は副作用があるため、テストでは特にモックが重要です。

### fs モジュールのモック

```typescript
import * as sinon from "sinon";
import * as path from "path";

// fsモジュールのモック作成
export const fsMock = {
  existsSync: sinon.stub(),
  mkdirSync: sinon.stub(),
  writeFileSync: sinon.stub(),
  readFileSync: sinon.stub(),
  readdirSync: sinon.stub(),
  copyFileSync: sinon.stub(),
  lstatSync: sinon.stub(),
};

// モックファイルシステムのセットアップ
export function setupMockFileSystem(structure: Record<string, any>) {
  // existsSyncのモック実装
  fsMock.existsSync.callsFake((filePath: string) => {
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

  // readdirSyncのモック実装
  fsMock.readdirSync.callsFake((dirPath: string) => {
    let current = structure;
    const parts = dirPath.split(path.sep).filter(Boolean);

    for (const part of parts) {
      if (!current[part]) {
        return [];
      }
      current = current[part];
    }

    return Object.keys(current);
  });

  // lstatSyncのモック実装（ディレクトリかファイルかを判定）
  fsMock.lstatSync.callsFake((filePath: string) => {
    let current = structure;
    const parts = filePath.split(path.sep).filter(Boolean);

    // パスを辿る
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        return { isDirectory: () => false };
      }
      current = current[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    const isDir = typeof current[lastPart] === "object";

    return {
      isDirectory: () => isDir,
    };
  });
}
```

### ファイルシステムモックの使用例

```typescript
import { fsMock, setupMockFileSystem } from "../src/test-helper";
import * as assert from "assert";

describe("ファイルシステム操作のテスト", () => {
  beforeEach(() => {
    // モックのリセット
    fsMock.existsSync.resetHistory();
    fsMock.readFileSync.resetHistory();
    fsMock.writeFileSync.resetHistory();

    // 仮想ファイルシステム構造の設定
    const fileSystem = {
      home: {
        user: {
          "config.json": '{"setting": "value"}',
          projects: {
            myProject: {},
          },
        },
      },
    };

    setupMockFileSystem(fileSystem);

    // readFileSyncのモック設定
    fsMock.readFileSync
      .withArgs("/home/user/config.json")
      .returns('{"setting": "value"}');
  });

  it("存在するファイルのチェック", () => {
    // テスト対象の関数
    function checkFileExists(path: string) {
      return fsMock.existsSync(path);
    }

    // 検証
    assert.strictEqual(checkFileExists("/home/user/config.json"), true);
    assert.strictEqual(checkFileExists("/home/user/nonexistent.txt"), false);
  });

  it("ファイル読み込みテスト", () => {
    // テスト対象の関数
    function readConfig(path: string) {
      const content = fsMock.readFileSync(path, "utf8");
      return JSON.parse(content);
    }

    // 検証
    const config = readConfig("/home/user/config.json");
    assert.deepStrictEqual(config, { setting: "value" });
    assert.strictEqual(fsMock.readFileSync.calledOnce, true);
  });

  it("ファイル書き込みテスト", () => {
    // テスト対象の関数
    function writeConfig(path: string, data: any) {
      fsMock.writeFileSync(path, JSON.stringify(data));
      return true;
    }

    // 実行
    const result = writeConfig("/home/user/newconfig.json", {
      newSetting: "newValue",
    });

    // 検証
    assert.strictEqual(result, true);
    assert.strictEqual(fsMock.writeFileSync.calledOnce, true);
    assert.strictEqual(
      fsMock.writeFileSync.firstCall.args[0],
      "/home/user/newconfig.json"
    );
    assert.strictEqual(
      fsMock.writeFileSync.firstCall.args[1],
      '{"newSetting":"newValue"}'
    );
  });
});
```

## 子プロセスのモック

VSCode 拡張機能では、外部コマンド（特に Docker など）を実行することが多いため、子プロセスのモックも重要です。

### child_process.exec のモック

```typescript
import * as sinon from "sinon";

// child_processモジュールのモック
export const childProcess = {
  exec: sinon.stub(),
};

// Docker成功時のモック
export function mockDockerSuccess() {
  childProcess.exec.callsFake((cmd, callback) => {
    if (cmd.includes("docker") && callback && typeof callback === "function") {
      // 成功の場合はエラーなし、標準出力あり
      callback(null, { stdout: "Docker is running", stderr: "" }, "");
    }
    return {
      on: sinon.stub(),
      stdout: { on: sinon.stub() },
      stderr: { on: sinon.stub() },
    };
  });
}

// Docker失敗時のモック
export function mockDockerFailure(errorMsg = "Docker command failed") {
  childProcess.exec.callsFake((cmd, callback) => {
    if (cmd.includes("docker") && callback && typeof callback === "function") {
      // 失敗の場合はエラーあり
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

### 子プロセスモックの使用例

```typescript
import {
  childProcess,
  mockDockerSuccess,
  mockDockerFailure,
} from "../src/test-helper";
import * as assert from "assert";

describe("Dockerコマンドのテスト", () => {
  afterEach(() => {
    // テスト後にモックをリセット
    childProcess.exec.resetHistory();
  });

  it("Docker実行成功のテスト", async () => {
    // Docker成功時のモックを設定
    mockDockerSuccess();

    // テスト対象の関数
    async function pullDockerImage() {
      return new Promise((resolve, reject) => {
        childProcess.exec("docker pull myimage:latest", (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      });
    }

    // 実行と検証
    const result = await pullDockerImage();
    assert.strictEqual(result, true);
    assert.strictEqual(childProcess.exec.calledOnce, true);
    assert.ok(childProcess.exec.firstCall.args[0].includes("docker pull"));
  });

  it("Docker実行失敗のテスト", async () => {
    // Docker失敗時のモックを設定
    mockDockerFailure("Docker daemon is not running");

    // テスト対象の関数
    async function pullDockerImage() {
      try {
        return await new Promise((resolve, reject) => {
          childProcess.exec("docker pull myimage:latest", (error, stdout) => {
            if (error) {
              reject(error);
            } else {
              resolve(true);
            }
          });
        });
      } catch (error) {
        return false;
      }
    }

    // 実行と検証
    const result = await pullDockerImage();
    assert.strictEqual(result, false);
    assert.strictEqual(childProcess.exec.calledOnce, true);
  });
});
```

## よくある問題と解決策

### 1. モック間の一貫性がない

**問題**: 異なるモジュールで独自にモックを作成すると、モック間の一貫性が失われる。

**解決策**: モジュール間で共有できるモック設定インターフェースを提供する。

```typescript
// test-helper.ts
export const vscode = {
  /* モック実装 */
};

// 他のモジュール
import { vscode } from "./test-helper";
export const _test = {
  setVSCodeMock(mock) {
    vscode = mock;
  },
};
```

### 2. 非同期処理のテスト

**問題**: Promise を返す関数のテストでは、非同期処理の完了を待つ必要がある。

**解決策**: Promise をちゃんと返すモックを作成し、async/await または Promise チェーンを使用する。

```typescript
// Promise を返すモック
vscode.window.showErrorMessage = sinon.stub().returns(Promise.resolve("OK"));

// テスト側
it("非同期処理のテスト", async () => {
  // テスト対象の関数を呼び出し
  await functionThatCallsShowErrorMessage();

  // 検証
  assert.strictEqual(vscode.window.showErrorMessage.called, true);
});
```

### 3. スタブリセット忘れ

**問題**: テスト間でスタブがリセットされないと、前のテストの影響が残る。

**解決策**: `beforeEach` でモックをリセットするか、`afterEach` で `sinon.restore()` を呼び出す。

```typescript
beforeEach(() => {
  // 個別にリセット
  vscode.window.showErrorMessage.resetHistory();
});

// または
afterEach(() => {
  // すべてのスタブをリセット
  sinon.restore();
});
```

### 4. モックの戻り値が適切でない

**問題**: モックの戻り値が実際の実装と異なる型になっている。

**解決策**: 実際の実装と同じ型を返すようにモックを設定する。

```typescript
// 間違い
vscode.window.showInputBox = sinon.stub().returns("input"); // Promise ではなく文字列を返す

// 正解
vscode.window.showInputBox = sinon.stub().resolves("input"); // Promise<string> を返す
```

## モックのベストプラクティス

テスト対象のコードを効果的にモックするためのベストプラクティスをいくつか紹介します。

### 1. テスト前後での適切なモックのリセット

Sinon を使用する場合、テストの前後でモックをきちんとリセットすることが重要です：

```typescript
// テスト前にモックをリセット
beforeEach(() => {
  sinon.reset(); // または sinon.restore();
  resetMocks();
});

// または各テストで個別にリセット
afterEach(() => {
  sinon.restore();
});
```

### 2. 関数の完全な再定義とリストア

特に複雑な依存関係を持つ関数をテストする場合は、スタブだけでなく関数全体を再定義し、テスト後に確実に元の関数を復元するのが効果的です：

```typescript
it("関数の再定義とリストアパターン", async function () {
  // 元の関数を保存
  const originalFunction = module.targetFunction;
  const originalDependencyA = module.dependencyA;
  const originalDependencyB = module.dependencyB;

  try {
    // 依存関数をモックに置き換え
    module.dependencyA = async () => mockResultA;
    module.dependencyB = sinon.stub().resolves(mockResultB);

    // テスト対象の関数を再定義
    module.targetFunction = async function () {
      // テスト用の実装を記述
      if (!(await module.dependencyA())) {
        return false;
      }

      const result = await module.dependencyB();
      return result;
    };

    // テスト実行
    const result = await module.targetFunction();

    // 検証
    assert.strictEqual(result, expectedResult);
    assert.ok(module.dependencyB.calledOnce);
  } finally {
    // 必ず元の関数を復元（テスト失敗時も実行される）
    module.targetFunction = originalFunction;
    module.dependencyA = originalDependencyA;
    module.dependencyB = originalDependencyB;
  }
});
```

このパターンの利点:

- 依存関係の解決が明示的になり、テストの意図がわかりやすい
- 再定義した関数の実装をテスト内で完全に制御できる
- try/finally パターンにより、テストが失敗しても確実に元の関数が復元される
- スタブが正しく動作しない場合の代替手段として有効

### 3. モック対象を最小限に

モックは必要最小限にとどめ、実際の実装をできるだけ使用するようにします：

```typescript
// モックを最小限にするテスト例
it("必要最小限のモック", () => {
  // 実際に外部に影響する部分だけモック
  const execStub = sinon.stub(childProcess, "exec");
  execStub.callsFake((cmd, callback) => {
    callback(null, { stdout: "mock output" });
    return {} as any;
  });

  // 実際のコードをそのまま使う
  return myFunction().then((result) => {
    assert.strictEqual(result, "expected result");
  });
});
```

### 4. コンテキスト依存のテスト分離

テスト間で共有される状態（グローバル変数、環境変数など）に依存するテストは注意が必要です：

```typescript
// 環境変数に依存するテスト
describe("環境変数依存のテスト", () => {
  // 元の環境変数を保存
  const originalEnv = process.env.NODE_ENV;

  // テスト用に環境変数を設定
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  // テスト実行
  it("テスト環境での動作確認", () => {
    // テスト内容
  });

  // 環境変数を元に戻す
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });
});
```

### 5. 外部モジュールのモック

proxyquire などのツールを使用して外部モジュールごとモックする方法は便利ですが、場合によっては信頼性の問題が発生することがあります：

```typescript
// 外部モジュールのモック例
const moduleProxy = proxyquire("../src/my-module", {
  vscode: vscodeMock,
  fs: fsMock,
  "./dependency": dependencyMock,
});

// モック動作が不安定な場合、直接上書きの方が信頼性が高い場合も
if (moduleProxy.testTargetFunction不安定な場合) {
  moduleProxy.testTargetFunction = 手動実装した関数;
}
```

### 6. 複雑なオブジェクトのモック

VS Code の複雑な API や設定オブジェクトをモックする場合は、型定義を活用して正確なモックを作成しましょう：

```typescript
// 複雑なVS Codeオブジェクトのモック例
const configMock: vscode.WorkspaceConfiguration = {
  get: sinon.stub().callsFake((key: string) => {
    if (key === "setting1") return "value1";
    if (key === "setting2") return true;
    return undefined;
  }),
  update: sinon.stub().resolves(),
  has: sinon.stub().returns(true),
  // その他必要なプロパティを追加
};

// 使用例
vscode.workspace.getConfiguration.returns(configMock);
```

これらのベストプラクティスを適用することで、より堅牢でメンテナンスしやすいテストコードを作成できます。
