#!/bin/bash

# テスト結果を保存するスクリプト
# リリース前にテスト結果を記録し、docs/test_results ディレクトリに保存します

# 現在の日時を取得
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DATE_ONLY=$(date +"%Y-%m-%d")

# package.jsonからバージョンを取得
VERSION=$(node -p "require('./package.json').version")
VERSION_DIR="docs/test_results/v${VERSION}"
RESULTS_FILE="${VERSION_DIR}/test_results_${TIMESTAMP}.md"

# テスト結果保存先ディレクトリの作成
mkdir -p "${VERSION_DIR}"

# ローカル環境情報を取得
NODE_VERSION=$(node -v)
OS_INFO=$(uname -a)
echo "テスト環境情報を収集しています..."
echo "Node.js: ${NODE_VERSION}"
echo "OS: ${OS_INFO}"

# テスト結果ファイルのヘッダーを作成
cat > "${RESULTS_FILE}" << EOL
# work-env v${VERSION} テスト結果

実行日時: ${DATE_ONLY}

## テスト環境

- Node.js: ${NODE_VERSION}
- OS: ${OS_INFO}

## テスト結果サマリー

| テストタイプ | 実行結果 | 成功数 | 失敗数 | スキップ数 | 所要時間 |
|------------|---------|-------|-------|----------|--------|
EOL

# テスト結果ログファイル
UNIT_TEST_LOG="${VERSION_DIR}/unit-test_${TIMESTAMP}.log"
WORKFLOW_TEST_LOG="${VERSION_DIR}/workflow-test_${TIMESTAMP}.log"
E2E_TEST_LOG="${VERSION_DIR}/e2e-test_${TIMESTAMP}.log"
COVERAGE_LOG="${VERSION_DIR}/coverage_${TIMESTAMP}.log"

# テスト環境のクリーンアップ
echo "テスト環境をクリーンアップしています..."
npm run test:clean

# ユニットテスト実行
echo "ユニットテストを実行しています..."
npm run unit-test | tee "${UNIT_TEST_LOG}"
UNIT_TEST_RESULT=$?

# ユニットテスト結果を解析して数値を取得
UNIT_TEST_SUCCESS=$(grep -o '[0-9]\+ passing' "${UNIT_TEST_LOG}" | cut -d ' ' -f1)
UNIT_TEST_PENDING=$(grep -o '[0-9]\+ pending' "${UNIT_TEST_LOG}" | cut -d ' ' -f1)
UNIT_TEST_FAILING=$(grep -o '[0-9]\+ failing' "${UNIT_TEST_LOG}" | cut -d ' ' -f1)
UNIT_TEST_TIME=$(grep -o '([0-9]\+ms)' "${UNIT_TEST_LOG}" | head -1 | tr -d '()' | tr -d 'ms')

# テスト結果がない場合のデフォルト値設定
UNIT_TEST_SUCCESS=${UNIT_TEST_SUCCESS:-0}
UNIT_TEST_PENDING=${UNIT_TEST_PENDING:-0}
UNIT_TEST_FAILING=${UNIT_TEST_FAILING:-0}
UNIT_TEST_TIME=${UNIT_TEST_TIME:-"N/A"}

if [ ${UNIT_TEST_RESULT} -eq 0 ]; then
    UNIT_TEST_STATUS="✅ 成功"
else
    UNIT_TEST_STATUS="❌ 失敗"
fi

# テスト環境のクリーンアップ
echo "テスト環境をクリーンアップしています..."
npm run test:clean

# ワークフローテスト実行
echo "ワークフローテストを実行しています..."
npm run workflow-test | tee "${WORKFLOW_TEST_LOG}"
WORKFLOW_TEST_RESULT=$?

# ワークフローテスト結果を解析
WORKFLOW_TEST_SUCCESS=$(grep -o '[0-9]\+ passing' "${WORKFLOW_TEST_LOG}" | cut -d ' ' -f1)
WORKFLOW_TEST_PENDING=$(grep -o '[0-9]\+ pending' "${WORKFLOW_TEST_LOG}" | cut -d ' ' -f1)
WORKFLOW_TEST_FAILING=$(grep -o '[0-9]\+ failing' "${WORKFLOW_TEST_LOG}" | cut -d ' ' -f1)
WORKFLOW_TEST_TIME=$(grep -o '([0-9]\+ms)' "${WORKFLOW_TEST_LOG}" | head -1 | tr -d '()' | tr -d 'ms')

# テスト結果がない場合のデフォルト値設定
WORKFLOW_TEST_SUCCESS=${WORKFLOW_TEST_SUCCESS:-0}
WORKFLOW_TEST_PENDING=${WORKFLOW_TEST_PENDING:-0}
WORKFLOW_TEST_FAILING=${WORKFLOW_TEST_FAILING:-0}
WORKFLOW_TEST_TIME=${WORKFLOW_TEST_TIME:-"N/A"}

if [ ${WORKFLOW_TEST_RESULT} -eq 0 ]; then
    WORKFLOW_TEST_STATUS="✅ 成功"
else
    WORKFLOW_TEST_STATUS="❌ 失敗"
fi

# テスト環境のクリーンアップ
echo "テスト環境をクリーンアップしています..."
npm run test:clean

# E2Eテスト実行
echo "E2Eテストを実行しています..."
npm run e2e-test | tee "${E2E_TEST_LOG}"
E2E_TEST_RESULT=$?

# E2Eテスト結果を解析
E2E_TEST_SUCCESS=$(grep -o '[0-9]\+ passing' "${E2E_TEST_LOG}" | cut -d ' ' -f1)
E2E_TEST_PENDING=$(grep -o '[0-9]\+ pending' "${E2E_TEST_LOG}" | cut -d ' ' -f1)
E2E_TEST_FAILING=$(grep -o '[0-9]\+ failing' "${E2E_TEST_LOG}" | cut -d ' ' -f1)
E2E_TEST_TIME=$(grep -o '([0-9]\+ms)' "${E2E_TEST_LOG}" | head -1 | tr -d '()' | tr -d 'ms')

# テスト結果がない場合のデフォルト値設定
E2E_TEST_SUCCESS=${E2E_TEST_SUCCESS:-0}
E2E_TEST_PENDING=${E2E_TEST_PENDING:-0}
E2E_TEST_FAILING=${E2E_TEST_FAILING:-0}
E2E_TEST_TIME=${E2E_TEST_TIME:-"N/A"}

if [ ${E2E_TEST_RESULT} -eq 0 ]; then
    E2E_TEST_STATUS="✅ 成功"
else
    E2E_TEST_STATUS="❌ 失敗"
fi

# カバレッジテスト実行
echo "カバレッジを計測しています..."
npm run test:coverage | tee "${COVERAGE_LOG}"
COVERAGE_RESULT=$?

# カバレッジ結果を解析
STATEMENT_COVERAGE=$(grep -o 'Statements.*: [0-9\.]\+%' "${COVERAGE_LOG}" | grep -o '[0-9\.]\+%')
BRANCH_COVERAGE=$(grep -o 'Branches.*: [0-9\.]\+%' "${COVERAGE_LOG}" | grep -o '[0-9\.]\+%')
FUNCTION_COVERAGE=$(grep -o 'Functions.*: [0-9\.]\+%' "${COVERAGE_LOG}" | grep -o '[0-9\.]\+%')

# カバレッジ結果がない場合のデフォルト値設定
STATEMENT_COVERAGE=${STATEMENT_COVERAGE:-"N/A"}
BRANCH_COVERAGE=${BRANCH_COVERAGE:-"N/A"}
FUNCTION_COVERAGE=${FUNCTION_COVERAGE:-"N/A"}

# テスト結果サマリーを追記
cat >> "${RESULTS_FILE}" << EOL
| ユニットテスト | ${UNIT_TEST_STATUS} | ${UNIT_TEST_SUCCESS} | ${UNIT_TEST_FAILING} | ${UNIT_TEST_PENDING} | ${UNIT_TEST_TIME}ms |
| ワークフローテスト | ${WORKFLOW_TEST_STATUS} | ${WORKFLOW_TEST_SUCCESS} | ${WORKFLOW_TEST_FAILING} | ${WORKFLOW_TEST_PENDING} | ${WORKFLOW_TEST_TIME}ms |
| E2Eテスト | ${E2E_TEST_STATUS} | ${E2E_TEST_SUCCESS} | ${E2E_TEST_FAILING} | ${E2E_TEST_PENDING} | ${E2E_TEST_TIME}ms |

## コードカバレッジ

- **ステートメント**: ${STATEMENT_COVERAGE}
- **ブランチ**: ${BRANCH_COVERAGE}
- **関数**: ${FUNCTION_COVERAGE}

## テスト結果詳細

### ユニットテスト

\`\`\`
$(cat "${UNIT_TEST_LOG}")
\`\`\`

### ワークフローテスト

\`\`\`
$(cat "${WORKFLOW_TEST_LOG}")
\`\`\`

### E2Eテスト

\`\`\`
$(cat "${E2E_TEST_LOG}")
\`\`\`

## まとめ

ユニットテスト、ワークフローテスト、E2Eテストを実行した結果、
EOL

# テスト結果の総合判断
if [ ${UNIT_TEST_RESULT} -eq 0 ] && [ ${WORKFLOW_TEST_RESULT} -eq 0 ] && [ ${E2E_TEST_RESULT} -eq 0 ]; then
    echo "**すべてのテストが正常に完了しました。**" >> "${RESULTS_FILE}"
    TEST_OVERALL_STATUS="✅ 成功"
else
    echo "**一部のテストが失敗しました。詳細は上記のログを確認してください。**" >> "${RESULTS_FILE}"
    TEST_OVERALL_STATUS="❌ 失敗"
fi

# 結果ファイルへのリンクを相対パスで作成
RESULTS_RELATIVE_PATH="v${VERSION}/test_results_${TIMESTAMP}.md"

# docs/test_results/README.mdを更新
README_FILE="docs/test_results/README.md"
TMP_README=$(mktemp)

awk -v ver="${VERSION}" \
    -v date="${DATE_ONLY}" \
    -v unit="${UNIT_TEST_STATUS}" \
    -v workflow="${WORKFLOW_TEST_STATUS}" \
    -v e2e="${E2E_TEST_STATUS}" \
    -v link="${RESULTS_RELATIVE_PATH}" \
    -v overall="${TEST_OVERALL_STATUS}" '
    /^| バージョン / {
        print $0;
        getline;
        print $0;
        print "| " ver " | " date " | " unit " | " workflow " | " e2e " | [詳細](" link ") |";
        next;
    }
    { print $0; }
' ${README_FILE} > ${TMP_README}

mv ${TMP_README} ${README_FILE}

echo "テスト結果を ${RESULTS_FILE} に保存しました"
echo "docs/test_results/README.md を更新しました"

# 全体のテスト結果を返す
if [ ${UNIT_TEST_RESULT} -eq 0 ] && [ ${WORKFLOW_TEST_RESULT} -eq 0 ] && [ ${E2E_TEST_RESULT} -eq 0 ]; then
    echo "すべてのテストが正常に完了しました。"
    exit 0
else
    echo "一部のテストが失敗しました。詳細は ${RESULTS_FILE} を確認してください。"
    exit 1
fi 