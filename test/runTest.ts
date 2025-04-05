import * as path from 'path';
import { runTests } from '@vscode/test-electron';

// VSCodeの統合テストを実行する関数
async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './index');

		// テスト実行モードをログ出力
		console.log(`テスト実行モード: ${process.env.TEST_MODE || 'デフォルト'}`);
		console.log('テストランナーパス:', extensionTestsPath);
		
		// E2Eワークフローテストを実行するかどうかを環境変数から確認
		const runWorkflowTests = process.env.RUN_WORKFLOW_TESTS === 'true';
		if (runWorkflowTests) {
			console.log('E2Eワークフローテストを実行します');
		}

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [],
			// 環境変数を渡す
			extensionTestsEnv: {
				TEST_MODE: process.env.TEST_MODE || 'TEST',
				RUN_WORKFLOW_TESTS: process.env.RUN_WORKFLOW_TESTS || 'false'
			}
		});
	} catch (err) {
		console.error('テスト実行中にエラーが発生しました:', err);
		process.exit(1);
	}
}

main(); 