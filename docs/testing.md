# work-env テスト戦略

## テスト概要

work-env 拡張機能のテストは、ユニットテストに焦点を当てて実施します：

- **ユニットテスト**: 個別の関数やコンポーネントの動作を確認

これらのテストにより、拡張機能の信頼性と安定性を確保します。

## テスト環境

### 必要なツール

- Node.js と npm
- ts-mocha (TypeScript で Mocha テストを実行するためのツール)

### テスト設定

テストの設定は `package.json` に定義されています：

```json
"scripts": {
  "test": "npm run unit-test",
  "unit-test": "ts-mocha -p tsconfig.json test/**/*.test.ts"
}
```

## テストの種類

### ユニットテスト

ユニットテストは `test/` ディレクトリ内の `.test.ts` ファイルに記述されています。

- `basic.test.ts`: 基本的な機能テスト
- `error-handlers.test.ts`: エラーハンドリングのテスト

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
  - 入力チェック関連のエラー処理確認

## モック戦略

実際の VSCode API や Docker コマンドの代わりにモックを使用します：

### VSCode API モック

テスト用に VSCode API の一部をモックします。以下はモックに使用するライブラリです：

- Sinon: 関数のスタブとスパイ
- Chai: アサーション

### Docker コマンドモック

Docker コマンドは、`child_process.exec` のモックによりテストします：

```typescript
import * as sinon from "sinon";
import { exec } from "child_process";

// Docker コマンドのモック例
sinon.stub(exec).callsFake((command, callback) => {
  if (command === "docker --version") {
    callback(null, { stdout: "Docker version 20.10.12" });
  } else if (command === "docker info") {
    callback(null, { stdout: "Docker info output" });
  } else {
    callback(new Error("Command not found"), null);
  }
});
```

## テストカバレッジ

テストカバレッジを測定するために、追加のツールを導入することが可能です：

```bash
npm install -D nyc
```

`package.json`に以下のスクリプトを追加することでカバレッジ測定が可能になります：

```json
"scripts": {
  "test:coverage": "nyc npm run unit-test"
}
```

目標カバレッジ：

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
```

## 手動テストチェックリスト

自動テストに加えて、以下の手動テストを実行することをお勧めします：

1. 拡張機能のインストールと有効化
2. 各コマンドの実行と UI の確認
3. エラーシナリオの手動検証
4. 異なる OS 環境での動作確認
