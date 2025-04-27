import * as assert from 'assert';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';
import { loadDockerInstallerModule, mockModuleDependencies } from '../util/moduleloader';
import vscodeStub from '../mock/vscode.mock';

describe('Docker Installer モジュールテスト', () => {
    let dockerInstallerModule: any;
    // 依存モジュールのモックを準備
    let childProcessMock: any;
    let fsMock: any;
    let osMock: any;

    beforeEach(() => {
        // モックを初期化
        childProcessMock = {
            exec: sinon.stub().yields(null, { stdout: 'Docker version 20.10.12' })
        };
        
        fsMock = {
            existsSync: sinon.stub().returns(true),
            writeFileSync: sinon.stub()
        };
        
        osMock = {
            platform: sinon.stub().returns('linux')
        };

        // proxyquireを使ってモジュールをロード
        dockerInstallerModule = loadDockerInstallerModule({
            'child_process': childProcessMock,
            'fs': fsMock,
            'os': osMock
        });

        // VSCode APIスタブをリセット
        vscodeStub.window.showInformationMessage = sinon.stub().resolves();
        vscodeStub.window.showErrorMessage = sinon.stub().resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('isDockerInstalled関数', () => {
        it('Dockerがインストールされている場合trueを返すこと', async () => {
            // Dockerコマンドが成功するようにモック
            childProcessMock.exec.withArgs('docker --version').yields(null, { stdout: 'Docker version 20.10.12' });
            
            const result = await dockerInstallerModule.isDockerInstalled();
            
            assert.strictEqual(result, true, 'Dockerがインストールされている場合trueを返す');
            assert.ok(childProcessMock.exec.calledWith('docker --version'), 'docker --versionコマンドが実行される');
        });
        
        it('Dockerがインストールされていない場合falseを返すこと', async () => {
            // Dockerコマンドが失敗するようにモック
            childProcessMock.exec.withArgs('docker --version').yields(new Error('command not found: docker'), null);
            
            const result = await dockerInstallerModule.isDockerInstalled();
            
            assert.strictEqual(result, false, 'Dockerがインストールされていない場合falseを返す');
            assert.ok(vscodeStub.window.showErrorMessage.called, 'エラーメッセージが表示される');
        });
    });
    
    describe('getDockerInstallCommand関数', () => {
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
        it('インストール処理が正しく実行されること', async () => {
            // インストールが成功するようにモック
            childProcessMock.exec.yields(null, { stdout: 'Installation successful' });
            
            const installCommand = dockerInstallerModule.getDockerInstallCommand();
            const installSpy = sinon.spy(dockerInstallerModule, 'installDocker');
            
            await dockerInstallerModule.installDocker();
            
            assert.ok(installSpy.calledOnce, 'installDocker関数が呼び出される');
            assert.ok(vscodeStub.window.showInformationMessage.called, '情報メッセージが表示される');
        });
    });
}); 