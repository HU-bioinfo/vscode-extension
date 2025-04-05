import * as assert from 'assert';
import * as sinon from 'sinon';
import * as os from 'os';
import { vscode, resetMocks } from '../src/test-helper';

// テスト実行前にrequireするため、最初にrequireを記述
let dockerInstaller: any;

describe('Docker インストール機能のテスト', function() {
    beforeEach(function() {
        resetMocks();
        // テスト環境変数をリセット
        process.env.TEST_OS_PLATFORM = '';
        process.env.TEST_OS_RELEASE = '';
        
        // ここでrequireをクリアしてからモジュールを再度読み込む
        // これは環境変数に依存するモジュールをテストする場合に必要
        try {
            delete require.cache[require.resolve('../src/docker-installer')];
            dockerInstaller = require('../src/docker-installer');
            
            // VSCodeモックをdockerInstallerにセット
            if (dockerInstaller._test && typeof dockerInstaller._test.setVSCodeMock === 'function') {
                dockerInstaller._test.setVSCodeMock(vscode);
            }
        } catch (e) {
            console.warn('モジュールが見つかりません。テストが失敗する可能性があります。');
        }
    });

    afterEach(function() {
        // テスト後にリセット
        process.env.TEST_OS_PLATFORM = '';
        process.env.TEST_OS_RELEASE = '';
        sinon.restore();
    });

    describe('OS検出機能', function() {
        it('Linuxを正しく検出すること', function() {
            // 環境変数を使用してテスト
            process.env.TEST_OS_PLATFORM = 'linux';
            process.env.TEST_OS_RELEASE = '5.4.0-generic';
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'linux');
            assert.strictEqual(result.isWSL, false);
        });

        it('macOSを正しく検出すること', function() {
            // 環境変数を使用してテスト
            process.env.TEST_OS_PLATFORM = 'darwin';
            process.env.TEST_OS_RELEASE = '20.0.0';
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'darwin');
            assert.strictEqual(result.isWSL, false);
        });

        it('Windowsを正しく検出すること', function() {
            // 環境変数を使用してテスト
            process.env.TEST_OS_PLATFORM = 'win32';
            process.env.TEST_OS_RELEASE = '10.0.19041';
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'win32');
            assert.strictEqual(result.isWSL, false);
        });

        it('WSL環境を正しく検出すること', function() {
            // 環境変数を使用してテスト
            process.env.TEST_OS_PLATFORM = 'linux';
            process.env.TEST_OS_RELEASE = '4.4.0-19041-Microsoft';
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'linux');
            assert.strictEqual(result.isWSL, true);
        });
    });

    describe('API存在確認', function() {
        it('必要な関数が定義されていること', function() {
            assert.strictEqual(typeof dockerInstaller.detectOS, 'function', 'detectOS関数が定義されている');
            assert.strictEqual(typeof dockerInstaller.detectLinuxDistro, 'function', 'detectLinuxDistro関数が定義されている');
            assert.strictEqual(typeof dockerInstaller.installDocker, 'function', 'installDocker関数が定義されている');
            assert.strictEqual(typeof dockerInstaller.verifyDockerInstallation, 'function', 'verifyDockerInstallation関数が定義されている');
        });
        
        it('戻り値の型が正しいこと', function() {
            process.env.TEST_OS_PLATFORM = 'linux';
            const osInfo = dockerInstaller.detectOS();
            assert.ok(osInfo, 'detectOSが値を返す');
            assert.strictEqual(typeof osInfo.platform, 'string', 'platformはstring型');
            assert.strictEqual(typeof osInfo.isWSL, 'boolean', 'isWSLはboolean型');
        });
    });
}); 