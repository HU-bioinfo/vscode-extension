import * as assert from 'assert';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';
import { loadDockerInstallerModule, mockModuleDependencies } from '../util/moduleloader';
import vscodeStub from '../mock/vscode.mock';
import { OSInfo } from '../../src/docker-installer';

describe('Docker Installer モジュールテスト', () => {
    let dockerInstallerModule: any;
    // 依存モジュールのモックを準備
    let childProcessMock: any;
    let fsMock: any;
    let osMock: any;
    let utilMock: any;
    let mockExecPromise: sinon.SinonStub;

    beforeEach(() => {
        // モックを初期化
        childProcessMock = {
            exec: sinon.stub()
        };
        
        fsMock = {
            existsSync: sinon.stub().returns(true),
            writeFileSync: sinon.stub()
        };
        
        osMock = {
            platform: sinon.stub().returns('linux'),
            userInfo: sinon.stub().returns({ username: 'testuser' })
        };

        // execPromiseのモックを作成
        mockExecPromise = sinon.stub();
        utilMock = {
            promisify: sinon.stub().returns(mockExecPromise)
        };

        // proxyquireを使ってモジュールをロード
        dockerInstallerModule = loadDockerInstallerModule({
            'child_process': childProcessMock,
            'fs': fsMock,
            'os': osMock,
            'util': utilMock
        });

        // モジュール内のvscode参照をテスト用のスタブに更新
        dockerInstallerModule._test = dockerInstallerModule._test || {};
        dockerInstallerModule._test.setVSCodeMock = dockerInstallerModule._test.setVSCodeMock || function(mock: any) {};
        dockerInstallerModule._test.setVSCodeMock(vscodeStub);

        // VSCode APIスタブをリセット
        vscodeStub.window.showErrorMessage = sinon.stub().resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('verifyDockerInstallation関数', () => {
        it('Dockerがインストールされている場合trueを返すこと', async function() {
            // タイムアウトを設定
            this.timeout(5000);
            
            // execPromiseをスタブ
            mockExecPromise.withArgs('docker --version').resolves({ stdout: 'Docker version 20.10.12' });
            mockExecPromise.withArgs('docker info').resolves({ stdout: 'Docker info success' });
            mockExecPromise.withArgs('docker run --rm hello-world').resolves({ stdout: 'Hello from Docker! ...' });
            
            const result = await dockerInstallerModule.verifyDockerInstallation();
            
            assert.strictEqual(result.success, true, 'Dockerがインストールされている場合trueを返す');
            assert.ok(mockExecPromise.calledWith('docker --version'), 'docker --versionコマンドが実行される');
        });
        
        it('Dockerがインストールされていない場合falseを返すこと', async function() {
            // タイムアウトを設定
            this.timeout(5000);
            
            // execPromiseをスタブ
            mockExecPromise.withArgs('docker --version').rejects(new Error('command not found: docker'));
            
            const result = await dockerInstallerModule.verifyDockerInstallation();
            
            assert.strictEqual(result.success, false, 'Dockerがインストールされていない場合falseを返す');
        });
    });
    
    describe.skip('getDockerInstallCommand関数', () => {
        it('Linuxで適切なインストールコマンドを返すこと', () => {
            // Linuxとして認識するようにモック
            osMock.platform.returns('linux');
            
            const command = dockerInstallerModule.getDockerInstallCommand();
            
            assert.ok(command.includes('apt-get') || command.includes('curl'), 'Linuxのインストールコマンドが返される');
        });
        
        it('macOSで適切なインストールコマンドを返すこと', () => {
            // macOSとして認識するようにモック
            osMock.platform.returns('darwin');
            
            const command = dockerInstallerModule.getDockerInstallCommand();
            
            assert.ok(command.includes('brew'), 'macOSのインストールコマンドが返される');
        });
        
        it('Windowsで適切なインストールコマンドを返すこと', () => {
            // Windowsとして認識するようにモック
            osMock.platform.returns('win32');
            
            const command = dockerInstallerModule.getDockerInstallCommand();
            
            assert.ok(command.includes('winget') || command.includes('PowerShell'), 'Windowsのインストールコマンドが返される');
        });
    });
    
    describe('installDocker関数', () => {
        it('インストール処理が正しく実行されること', async function() {
            // タイムアウトを設定
            this.timeout(5000);
            
            // installDocker関数内で最初に呼ばれる確認ダイアログをモック
            vscodeStub.window.showInformationMessage = sinon.stub(); // スタブを初期化
            vscodeStub.window.showInformationMessage
                .withArgs('Dockerをインストールしますか？', { modal: true }, 'はい', 'いいえ')
                .resolves('はい'); // 'はい'が選択されたことにする

            // verifyDockerInstallationを直接モック
            sinon.stub(dockerInstallerModule, 'verifyDockerInstallation').resolves({
                success: true,
                message: 'Dockerが正常に動作しています'
            });

            // detectLinuxDistroをモック
            sinon.stub(dockerInstallerModule, 'detectLinuxDistro').resolves({
                id: 'ubuntu',
                version: '20.04'
            });

            // execPromiseのスタブを設定
            mockExecPromise.resolves({ stdout: 'OK' });

            // モックウィンドウのwithProgressをスタブ化
            vscodeStub.window.withProgress = sinon.stub().callsFake((options, callback) => {
                // プログレスレポーターをモック
                const progress = {
                    report: sinon.stub()
                };
                // コールバックを実行
                return callback(progress);
            });

            // テスト用のOSInfoを作成
            const osInfo: OSInfo = { platform: 'linux', isWSL: false }; 
            
            // installDockerにosInfoを渡す
            const result = await dockerInstallerModule.installDocker(osInfo);
            
            assert.ok(vscodeStub.window.showInformationMessage.calledWith('Dockerをインストールしますか？', { modal: true }, 'はい', 'いいえ'), '確認ダイアログが表示される');
            assert.ok(vscodeStub.window.withProgress.called, 'プログレスバーが表示される');
            assert.strictEqual(result.success, true, 'インストールが成功する');
        });
    });
}); 