# Docker in Docker テスト環境の設定

## 現状の課題

Docker in Docker 環境でのテストを実行する際、以下の問題に直面しています：

```
ERROR: permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock:
Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.48/info": dial unix /var/run/docker.sock: connect:
permission denied
```

このエラーは、現在の開発コンテナユーザー（vscode）が Docker デーモンソケット（/var/run/docker.sock）にアクセスする権限がないことを示しています。

## 解決方法

### 1. 開発コンテナの設定変更

`.devcontainer/devcontainer.json` ファイルを以下のように修正して、Docker ソケットへのアクセス権を設定します：

```json
{
  "name": "work-env-dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
  "mounts": [
    "source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind"
  ],
  "postCreateCommand": "sudo chmod 666 /var/run/docker.sock || true"
}
```

### 2. ユーザー権限の設定

開発コンテナ内で Docker グループにユーザーを追加する方法：

```bash
# Docker グループの存在確認と作成
sudo groupadd -f docker

# 現在のユーザー（vscode）を docker グループに追加
sudo usermod -aG docker $USER

# 権限の即時反映（新しいシェルを開く代わりに）
newgrp docker
```

### 3. Docker ソケットの権限変更（一時的な対応）

一時的な解決策として、Docker ソケットの権限を変更します：

```bash
sudo chmod 666 /var/run/docker.sock
```

※注意: この方法はセキュリティ上のリスクを伴うため、開発環境でのみ使用してください。

## テスト戦略の代替案

Docker へのアクセスが制限されている場合は、以下の代替テスト戦略を検討できます：

### 1. モックを使用したテスト

実際の Docker コマンドの代わりに、モックオブジェクトを使用してテストを行います：

```typescript
import * as sinon from "sinon";
import { exec } from "child_process";

describe("Docker コマンドのモックテスト", () => {
  beforeEach(() => {
    sinon.stub(exec).callsFake((command, callback) => {
      if (command === "docker --version") {
        callback(null, { stdout: "Docker version 20.10.12" });
      } else if (command === "docker info") {
        callback(null, { stdout: "Docker info output" });
      } else {
        callback(new Error("Command not found"), null);
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("Docker バージョンチェックが成功する", async () => {
    // テストコード
  });
});
```

### 2. 特定の環境フラグを使用したテスト

テスト環境で Docker が利用できない場合、環境変数フラグを設定して一部のテストをスキップします：

```typescript
describe("Docker 依存テスト", function () {
  beforeEach(function () {
    if (process.env.SKIP_DOCKER_TESTS === "true") {
      this.skip();
    }
  });

  it("Docker コマンドを実行できる", async () => {
    // Docker を使用するテスト
  });
});
```

### 3. 統合テスト用の特別な環境

Docker を必要とする統合テストは、Docker アクセス権を持つ特別な CI 環境で実行します：

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  docker-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "16"
      - name: Install dependencies
        run: npm ci
      - name: Run Docker tests
        run: npm run test:docker
```

## Docker 関連テストの分離

テストファイルを以下のように分類し、Docker が利用できない環境でも非 Docker 依存のテストを実行できるようにします：

1. `test/unit/`: Docker に依存しないユニットテスト
2. `test/docker/`: Docker が必要なテスト

package.json に以下のスクリプトを追加します：

```json
"scripts": {
  "test:unit": "ts-mocha -p tsconfig.json test/unit/**/*.test.ts",
  "test:docker": "ts-mocha -p tsconfig.json test/docker/**/*.test.ts",
  "test": "npm run test:unit && (docker info > /dev/null && npm run test:docker || echo 'Docker tests skipped')"
}
```

この設定により、Docker が利用できない場合でも、ユニットテストは常に実行され、Docker テストはスキップされます。
