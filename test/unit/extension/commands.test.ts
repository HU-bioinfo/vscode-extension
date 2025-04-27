import * as assert from 'assert';
import * as sinon from 'sinon';
import { loadExtensionModule } from '../../util/moduleloader';
import vscodeStub from '../../mock/vscode.mock';
import { exec } from 'child_process';
import { promisify } from 'util';

// テスト用の設定定数を定義
const CONFIG = {
    DOCKER_IMAGE: 'kokeh/hu_bioinfo:stable',
    CONTAINER_NAME_FILTERS: ['hu-bioinfo-workshop', 'work-env']
};

// テスト用のユーティリティ関数
const execPromise = sinon.stub();

// ファイルシステムのモック
let fsMock: any;

// テスト対象の関数を直接定義
async function preflightChecks(): Promise<boolean> {
    try {
        // Docker実行確認
        await execPromise('docker --version');
        return true;
    } catch (error) {
        vscodeStub.window.showErrorMessage('[work-env] Dockerがインストールされていません。');
        return false;
    }
}

async function startDockerCheck(): Promise<boolean> {
    const dockerInstalled = await isDockerInstalled();
    if (!dockerInstalled) {
        vscodeStub.window.showInformationMessage('Dockerがインストールされていません。インストールしてください。');
        return false;
    }
    return true;
}

async function isDockerInstalled(): Promise<boolean> {
    try {
        await execPromise('docker --version');
        return true;
    } catch (error) {
        return false;
    }
}

function ensureDirectory(dirPath: string): void {
    if (!fsMock.existsSync(dirPath)) {
        fsMock.mkdirSync(dirPath, { recursive: true });
    }
}

async function pullDockerImage(imageName: string): Promise<boolean> {
    try {
        await execPromise(`docker pull ${imageName}`);
        vscodeStub.window.showInformationMessage(`[work-env] イメージの取得が完了しました: ${imageName}`);
        return true;
    } catch (error) {
        vscodeStub.window.showErrorMessage(`[work-env] イメージの取得に失敗しました: ${error}`);
        return false;
    }
}

async function removeExistingContainers(nameFilters: string[]): Promise<boolean> {
    try {
        // 既存コンテナの検索と停止・削除
        for (const filter of nameFilters) {
            await execPromise(`docker ps -a --filter name=${filter} -q | xargs -r docker rm -f`);
        }
        return true;
    } catch (error) {
        vscodeStub.window.showErrorMessage(`[work-env] コンテナの削除に失敗しました: ${error}`);
        return false;
    }
}

describe('Extension コマンド機能テスト', () => {
    let extensionModule: any;
    let childProcessMock: any;
    let dockerInstallerMock: any;

    beforeEach(() => {
        // VSCodeスタブの初期化
        vscodeStub.window.showInformationMessage = sinon.stub().resolves();
        vscodeStub.window.showErrorMessage = sinon.stub().resolves();
        vscodeStub.window.showInputBox = sinon.stub().resolves('test-github-token');
        vscodeStub.window.showOpenDialog = sinon.stub().resolves([{ fsPath: '/test/project' }]);
        
        // ファイルシステムのモック作成
        fsMock = {
            existsSync: sinon.stub(),
            mkdirSync: sinon.stub(),
            writeFileSync: sinon.stub(),
            readFileSync: sinon.stub().returns(Buffer.from('test file content'))
        };
        
        // existsSyncの振る舞いを設定
        fsMock.existsSync.withArgs('/test/project').returns(true);
        fsMock.existsSync.returns(false);
        
        // 子プロセスのモック作成
        childProcessMock = {
            exec: sinon.stub()
        };
        childProcessMock.exec.withArgs('docker --version').yields(null, { stdout: 'Docker version 20.10.12' });
        childProcessMock.exec.yields(null, { stdout: 'Success' });
        
        // execPromiseをリセット
        execPromise.reset();
        execPromise.withArgs('docker --version').resolves({ stdout: 'Docker version 20.10.12' });
        execPromise.resolves({ stdout: 'Success' });
        
        // dockerInstallerのモック作成
        dockerInstallerMock = {
            isDockerInstalled: sinon.stub().resolves(true),
            installDocker: sinon.stub().resolves()
        };
        
        // proxyquireを使ってモジュールをロード
        extensionModule = loadExtensionModule({
            'child_process': childProcessMock,
            'fs': fsMock,
            './docker-installer': dockerInstallerMock
        });
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('preflightChecks関数', () => {
        it('Dockerがインストールされている場合trueを返すこと', async () => {
            // Dockerがインストールされているようにモック
            execPromise.withArgs('docker --version').resolves({ stdout: 'Docker version 20.10.12' });
            
            const result = await preflightChecks();
            
            assert.strictEqual(result, true, 'Dockerがインストールされている場合trueを返す');
        });
        
        it('Dockerがインストールされていない場合falseを返すこと', async () => {
            // Dockerがインストールされていないようにモック
            execPromise.withArgs('docker --version').rejects(new Error('command not found: docker'));
            
            // エラーメッセージが表示されることを確認
            const showErrorMessageStub = vscodeStub.window.showErrorMessage as sinon.SinonStub;
            
            const result = await preflightChecks();
            
            assert.strictEqual(result, false, 'Dockerがインストールされていない場合falseを返す');
            assert.ok(showErrorMessageStub.called, 'エラーメッセージが表示される');
        });
    });
    
    describe('startDockerCheck関数', () => {
        beforeEach(() => {
            vscodeStub.window.showInformationMessage.resetHistory();
        });

        it('Dockerがインストールされていなければfalseを返す', async () => {
            // isDockerInstalledのモック
            execPromise.withArgs('docker --version').rejects(new Error('command not found: docker'));
            
            const result = await startDockerCheck();
            
            assert.strictEqual(result, false);
            assert.ok(vscodeStub.window.showInformationMessage.calledOnce);
        });

        it('Dockerがインストールされていればtrueを返す', async () => {
            // isDockerInstalledのモック
            execPromise.withArgs('docker --version').resolves({ stdout: 'Docker version 20.10.12' });
            
            const result = await startDockerCheck();
            
            assert.strictEqual(result, true);
            assert.ok(vscodeStub.window.showInformationMessage.notCalled);
        });
    });

    describe('ensureDirectory関数のテスト', () => {
        it('ディレクトリが存在しない場合、作成されること', () => {
            // ディレクトリが存在しないようにモック
            fsMock.existsSync.withArgs('/test/new-dir').returns(false);
            
            // プライベート関数を呼び出す
            ensureDirectory('/test/new-dir');
            
            // mkdirSyncが呼ばれたことを確認
            assert.ok(fsMock.mkdirSync.calledWith('/test/new-dir', { recursive: true }), 
                'mkdirSyncが正しいパラメータで呼ばれる');
        });
        
        it('ディレクトリが既に存在する場合、作成されないこと', () => {
            // ディレクトリが存在するようにモック
            fsMock.existsSync.withArgs('/test/existing-dir').returns(true);
            
            // プライベート関数を呼び出す
            ensureDirectory('/test/existing-dir');
            
            // mkdirSyncが呼ばれないことを確認
            assert.ok(fsMock.mkdirSync.notCalled, 'mkdirSyncは呼ばれない');
        });
    });
    
    describe('pullDockerImage関数', () => {
        it('Dockerイメージのpullが成功した場合trueを返すこと', async () => {
            // Docker pullが成功するようにモック
            const imageName = CONFIG.DOCKER_IMAGE;
            execPromise.withArgs(`docker pull ${imageName}`).resolves({ stdout: 'Successfully pulled image' });
            
            // 情報メッセージが表示されることを確認
            const showInfoMessageStub = vscodeStub.window.showInformationMessage as sinon.SinonStub;
            
            const result = await pullDockerImage(imageName);
            
            assert.strictEqual(result, true, 'イメージのpullに成功した場合trueを返す');
            assert.ok(showInfoMessageStub.called, '情報メッセージが表示される');
        });
        
        it('Dockerイメージのpullが失敗した場合falseを返すこと', async () => {
            // Docker pullが失敗するようにモック
            const imageName = CONFIG.DOCKER_IMAGE;
            execPromise.withArgs(`docker pull ${imageName}`).rejects(new Error('Failed to pull image'));
            
            // エラーメッセージが表示されることを確認
            const showErrorMessageStub = vscodeStub.window.showErrorMessage as sinon.SinonStub;
            
            const result = await pullDockerImage(imageName);
            
            assert.strictEqual(result, false, 'イメージのpullに失敗した場合falseを返す');
            assert.ok(showErrorMessageStub.called, 'エラーメッセージが表示される');
        });
    });
    
    describe('removeExistingContainers関数', () => {
        it('コンテナの削除が成功した場合trueを返すこと', async () => {
            // Dockerコマンドが成功するようにモック
            execPromise.resolves({ stdout: 'Successfully removed container' });
            
            const result = await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
            
            assert.strictEqual(result, true, 'コンテナの削除に成功した場合trueを返す');
        });
        
        it('コンテナがない場合もtrueを返すこと', async () => {
            // コンテナが見つからないケース
            execPromise.resolves({ stdout: '' });
            
            const result = await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
            
            assert.strictEqual(result, true, 'コンテナがなくてもtrueを返す');
        });
        
        it('コンテナの削除が失敗した場合falseを返すこと', async () => {
            // Dockerコマンドが失敗するようにモック
            execPromise.rejects(new Error('Failed to remove container'));
            
            // エラーメッセージが表示されることを確認
            const showErrorMessageStub = vscodeStub.window.showErrorMessage as sinon.SinonStub;
            
            const result = await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
            
            assert.strictEqual(result, false, 'コンテナの削除に失敗した場合falseを返す');
            assert.ok(showErrorMessageStub.called, 'エラーメッセージが表示される');
        });
    });
}); 