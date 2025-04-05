import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { TEST_MODE } from './setup'; // setup.tsからTEST_MODEのみをインポート

export function run(): Promise<void> {
	// テストランナーの作成
	const mocha = new Mocha({
		ui: 'bdd',
		color: true,
		timeout: 60000 // E2Eテストのためにタイムアウトを長めに設定
	});

	const testsRoot = path.resolve(__dirname, '..');

	// 環境変数からテストモードを取得
	const testMode = process.env.TEST_MODE || 'TEST';
	console.log(`テストモード: ${testMode}`);

	// E2Eワークフローテストを実行するかどうか
	const runWorkflowTests = process.env.RUN_WORKFLOW_TESTS === 'true';
	console.log(`E2Eワークフローテストの実行: ${runWorkflowTests}`);

	return new Promise<void>((resolve, reject) => {
		// 新しいディレクトリ構造に対応したテストパターン
		// ユニットテストパターン
		const unitTestPattern = 'test/unit/**/*.test.js';
		// ワークフローテストパターン
		const workflowTestPattern = 'test/workflow/**/*.test.js';

		// 実行するテストパターンを決定
		let testPattern: string;
		if (runWorkflowTests) {
			// ワークフローテストのみ実行
			testPattern = workflowTestPattern;
			console.log('ワークフローテストを実行します');
		} else {
			// ユニットテストのみ実行
			testPattern = unitTestPattern;
			console.log('ユニットテストを実行します');
		}

		// globプロミスを使用
		glob(testPattern, { cwd: testsRoot }).then((files: string[]) => {
			if (files.length === 0) {
				console.log(`警告: パターン ${testPattern} に一致するテストファイルが見つかりません`);
			} else {
				console.log(`実行するテストファイル (${files.length}件):`);
				files.forEach((file: string) => console.log(` - ${file}`));
			}

			// テストファイルをMochaに追加
			files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// テスト実行
				mocha.run((failures: number) => {
					if (failures > 0) {
						reject(new Error(`${failures} テストが失敗しました`));
					} else {
						resolve();
					}
				});
			} catch (err) {
				console.error('Mochaテスト実行中のエラー:', err);
				reject(err);
			}
		}).catch((err: Error) => {
			console.error('テストファイル検索中のエラー:', err);
			reject(err);
		});
	});
} 