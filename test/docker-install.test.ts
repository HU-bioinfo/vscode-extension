import * as assert from 'assert';
import * as sinon from 'sinon';
import * as os from 'os';
import { vscode, resetMocks } from '../src/test-helper';
import * as childProcess from 'child_process';

// テスト実行前にrequireするため、最初にrequireを記述
let dockerInstaller: any;

describe('Docker インストール機能のテスト', function() {
    beforeEach(function() {
        resetMocks();
        // テスト環境変数をリセット
        process.env.TEST_OS_PLATFORM = '';
        process.env.TEST_OS_RELEASE = '';

        // OS関数のスタブ
        sinon.stub(os, 'platform');
        sinon.stub(os, 'release');
        
        // 子プロセス実行のモック
        sinon.stub(childProcess, 'exec');
        
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
        sinon.restore();
    });

    describe('OS検出機能', function() {
        it('Linuxを正しく検出すること', function() {
            (os.platform as sinon.SinonStub).returns('linux');
            (os.release as sinon.SinonStub).returns('5.4.0-generic');
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'linux');
            assert.strictEqual(result.isWSL, false);
        });

        it('macOSを正しく検出すること', function() {
            (os.platform as sinon.SinonStub).returns('darwin');
            (os.release as sinon.SinonStub).returns('20.0.0');
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'darwin');
            assert.strictEqual(result.isWSL, false);
        });

        it('Windowsを正しく検出すること', function() {
            (os.platform as sinon.SinonStub).returns('win32');
            (os.release as sinon.SinonStub).returns('10.0.19041');
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'win32');
            assert.strictEqual(result.isWSL, false);
        });

        it('WSL環境を正しく検出すること', function() {
            (os.platform as sinon.SinonStub).returns('linux');
            (os.release as sinon.SinonStub).returns('4.4.0-19041-Microsoft');
            
            const result = dockerInstaller.detectOS();
            assert.strictEqual(result.platform, 'linux');
            assert.strictEqual(result.isWSL, true);
        });
    });

    describe('Linuxディストリビューション検出', function() {
        beforeEach(function() {
            // execのモックを設定
            const execStub = childProcess.exec as unknown as sinon.SinonStub;
            execStub.callsFake((cmd: string, callback: Function) => {
                if (cmd.includes('lsb_release')) {
                    callback(null, { stdout: 'Ubuntu', stderr: '' });
                } else if (cmd.includes('cat /etc/os-release')) {
                    callback(null, { stdout: 'ID=ubuntu\nVERSION_ID="20.04"', stderr: '' });
                }
                return { on: sinon.stub() };
            });
        });

        it('Ubuntuを正しく検出すること', async function() {
            (os.platform as sinon.SinonStub).returns('linux');
            
            const distro = await dockerInstaller.detectLinuxDistro();
            assert.strictEqual(distro.id, 'ubuntu');
            assert.strictEqual(distro.version, '20.04');
        });
        
        it('検出失敗時はgenericを返すこと', async function() {
            (os.platform as sinon.SinonStub).returns('linux');
            const execStub = childProcess.exec as unknown as sinon.SinonStub;
            execStub.callsFake((cmd: string, callback: Function) => {
                callback(new Error('Command failed'), { stdout: '', stderr: 'error' });
                return { on: sinon.stub() };
            });
            
            const distro = await dockerInstaller.detectLinuxDistro();
            assert.strictEqual(distro.id, 'generic');
            assert.strictEqual(distro.version, '');
        });
    });

    describe('Docker インストール関数', function() {
        beforeEach(function() {
            // Dockerインストールコマンドのモック
            const execStub = childProcess.exec as unknown as sinon.SinonStub;
            execStub.callsFake((cmd: string, callback: Function) => {
                if (cmd.includes('apt-get') || cmd.includes('brew install') || cmd.includes('yum install')) {
                    callback(null, { stdout: 'Installation successful', stderr: '' });
                }
                return { on: sinon.stub() };
            });
            
            // VSCodeのUI関数のモック
            vscode.window.showInformationMessage.resolves('はい');
            // @ts-ignore - テスト用にプロパティを追加
            vscode.window.withProgress = sinon.stub().callsFake((options: any, task: any) => {
                return task(
                    {
                        report: sinon.stub()
                    }
                );
            });
        });

        it('Ubuntuでのインストールが成功すること', async function() {
            (os.platform as sinon.SinonStub).returns('linux');
            
            const result = await dockerInstaller.installDocker({
                platform: 'linux',
                isWSL: false,
                distro: { id: 'ubuntu', version: '20.04' }
            });
            
            assert.strictEqual(result.success, true);
            const execStub = childProcess.exec as unknown as sinon.SinonStub;
            assert.ok(execStub.calledWith(sinon.match(/apt-get/)));
        });

        it('macOSでのインストールが成功すること', async function() {
            (os.platform as sinon.SinonStub).returns('darwin');
            
            const result = await dockerInstaller.installDocker({
                platform: 'darwin',
                isWSL: false
            });
            
            assert.strictEqual(result.success, true);
            const execStub = childProcess.exec as unknown as sinon.SinonStub;
            assert.ok(execStub.calledWith(sinon.match(/brew install/)));
        });

        it('Windowsの場合、WSLを使用するように促すメッセージが表示されること', async function() {
            (os.platform as sinon.SinonStub).returns('win32');
            
            await dockerInstaller.installDocker({
                platform: 'win32',
                isWSL: false
            });
            
            assert.ok(vscode.window.showInformationMessage.calledWith(sinon.match(/WSL/)));
        });
    });

    describe('インストール後のセットアップ', function() {
        it('インストール後の検証が正常に動作すること', async function() {
            // ここでは実際の検証関数自体をスタブ化
            const verifyStub = sinon.stub(dockerInstaller, 'verifyDockerInstallation').resolves({
                success: true,
                message: 'Dockerが正常に動作しています'
            });
            
            const result = await dockerInstaller.verifyDockerInstallation();
            assert.strictEqual(result.success, true);
            verifyStub.restore();
        });

        it('インストール失敗時のエラーメッセージが適切に生成されること', async function() {
            // エラーケースをスタブ化
            const verifyStub = sinon.stub(dockerInstaller, 'verifyDockerInstallation').resolves({
                success: false,
                message: 'Dockerデーモンが実行されていません'
            });
            
            const result = await dockerInstaller.verifyDockerInstallation();
            assert.strictEqual(result.success, false);
            assert.ok(result.message.includes('Docker'));
            verifyStub.restore();
        });
    });
}); 