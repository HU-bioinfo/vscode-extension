import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import {
    parseErrorMessage, isDockerError, handleDockerError,
    validateInput, handleFileSystemError
} from './error-handlers';
import * as dockerInstaller from './docker-installer';
import { TemplateProcessor } from './template-processor';

const execPromise = promisify(exec);

// 設定関連の定数
export const CONFIG = {
  DOCKER_IMAGE: 'kokeh/hu_bioinfo:stable',
  CONTAINER_NAME_FILTERS: ['hu-bioinfo-workshop', 'work-env']
};

/**
 * エクステンションアクティベーション時の処理
 * @param context VS Codeのエクステンションコンテキスト
 */
export function activate(context: vscode.ExtensionContext) {
    let startWorkEnvCommand = vscode.commands.registerCommand('work-env.start-work-env', async () => {
        try {
            // 事前チェック
            if (!await preflightChecks()) {
                return;
            }
            
            // DockerイメージのPull
            if (!await pullDockerImage(CONFIG.DOCKER_IMAGE)) {
                return;
            }
            
            // 親ディレクトリの選択
            const parentDirUri = await selectParentDirectory();
            if (!parentDirUri) {
                return;
            }
            
            const parentDirPath = parentDirUri.fsPath;
            const cacheDirPath = path.join(parentDirPath, "cache");
            const containerDirPath = path.join(parentDirPath, "container");
            const containerDevcontainerPath = path.join(containerDirPath, ".devcontainer");
            const projectsDirPath = path.join(containerDirPath, "projects");
            
            // ディレクトリ構造の作成
            vscode.window.showInformationMessage("[work-env] 開発環境を設定中...");
            
            // 各ディレクトリを作成
            ensureDirectory(cacheDirPath);
            ensureDirectory(containerDirPath);
            ensureDirectory(projectsDirPath);
            
            // .devcontainerの設定
            await setupDevContainer(context, containerDevcontainerPath, cacheDirPath, projectsDirPath);
            
            // GitHub PATの入力
            const githubPat = await inputGitHubPAT();
            if (!githubPat) {
                return;
            }
            
            // docker-compose.ymlの生成
            const dockercomposeFilePath = path.join(containerDevcontainerPath, "docker-compose.yml");
            await generateDockerCompose(
                context, 
                dockercomposeFilePath, 
                {
                    projectFolder: projectsDirPath,
                    cacheFolder: cacheDirPath,
                    githubPat
                }
            );
            
            // プロジェクトテンプレートの展開
            await setupProjectTemplate(context, projectsDirPath);
            
            // コンテナディレクトリをVSCodeで開く
            openFolderInContainer(containerDirPath);
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
            }
        }
    });
    
    let resetConfigCommand = vscode.commands.registerCommand('work-env.reset-config', async () => {
        try {
            // 親ディレクトリの選択
            const parentDirUri = await selectParentDirectory();
            if (!parentDirUri) {
                return;
            }
            
            const parentDirPath = parentDirUri.fsPath;
            const cacheDirPath = path.join(parentDirPath, "cache");
            const containerDirPath = path.join(parentDirPath, "container");
            const containerDevcontainerPath = path.join(containerDirPath, ".devcontainer");
            
            if (!fs.existsSync(containerDevcontainerPath)) {
                vscode.window.showInformationMessage("まず 'Start work-env' を実行してください");
                return;
            }
            
            // GitHub PATの入力
            const githubPat = await inputGitHubPAT();
            if (!githubPat) {
                return;
            }
            
            // docker-compose.ymlの再生成
            const dockercomposeFilePath = path.join(containerDevcontainerPath, "docker-compose.yml");
            await generateDockerCompose(
                context, 
                dockercomposeFilePath, 
                {
                    projectFolder: path.join(containerDirPath, "projects"),
                    cacheFolder: cacheDirPath,
                    githubPat
                }
            );
            
            // コンテナの削除
            await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
            
            // コンテナディレクトリをVSCodeで開く
            openFolderInContainer(containerDirPath);
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
            }
        }
    });

    context.subscriptions.push(startWorkEnvCommand);
    context.subscriptions.push(resetConfigCommand);
}

/**
 * ディレクトリの存在を確認し、なければ作成する
 * @param dirPath 作成するディレクトリのパス
 */
function ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * 親ディレクトリを選択する
 * @returns 選択された親ディレクトリのUri、キャンセルされた場合はundefined
 */
async function selectParentDirectory(): Promise<vscode.Uri | undefined> {
    const parentDirUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "開発環境の親ディレクトリを選択",
        title: "開発環境を作成する親ディレクトリを選択してください"
    });
    
    if (!parentDirUri || parentDirUri.length === 0) {
        vscode.window.showErrorMessage("[work-env] 親ディレクトリが選択されていません。");
        return undefined;
    }
    
    return parentDirUri[0];
}

/**
 * GitHub Personal Access Tokenを入力する
 * @returns 入力されたGitHub PAT、キャンセルされた場合はundefined
 */
async function inputGitHubPAT(): Promise<string | undefined> {
    const githubPat = await vscode.window.showInputBox({
        prompt: "GitHub Personal Access Tokenを入力してください",
        ignoreFocusOut: true,
        password: true,
        validateInput: validateInput
    });
    
    if (!githubPat) {
        vscode.window.showErrorMessage("[work-env] GitHub PATが必要です。");
        return undefined;
    }
    
    return githubPat;
}

/**
 * 事前チェック（Docker、権限）
 * @returns 全てのチェックが通った場合はtrue
 */
export async function preflightChecks(): Promise<boolean> {
    // Dockerがインストールされているか確認
    if (!await isDockerInstalled()) {
        // Docker未インストールの場合、インストールを提案
        const installDocker = await showDockerInstallPrompt();
        if (installDocker) {
            // インストールを実行し、その結果を返す
            return await installDockerWithProgress();
        }
        return false;
    }

    // Dockerの権限を確認
    if (!await checkDockerPermissions()) {
        showDockerPermissionError();
        return false;
    }
    
    return true;
}

/**
 * Dockerイメージをプルする
 * @param imageName プルするイメージ名
 * @returns 成功した場合はtrue
 */
export async function pullDockerImage(imageName: string): Promise<boolean> {
    try {
        vscode.window.showInformationMessage(`[work-env] Dockerイメージ ${imageName} を取得中...`);
        await execPromise(`docker pull ${imageName}`);
        return true;
    } catch (error) {
        handleDockerError(error);
        return false;
    }
}

/**
 * 既存のコンテナを削除する
 * @param nameFilters コンテナ名フィルタ
 * @returns 成功した場合はtrue
 */
export async function removeExistingContainers(nameFilters: string[]): Promise<boolean> {
    try {
        // フィルタ文字列の作成
        const filterStr = nameFilters.map(name => `--filter 'name=${name}'`).join(' ');
        await execPromise(`docker rm -f $(docker ps -aq ${filterStr})`);
        return true;
    } catch (error) {
        // コンテナが存在しない場合はエラーが出るが無視して続行
        return true;
    }
}

// Dockerがインストールされているかを確認する関数
export async function isDockerInstalled(): Promise<boolean> {
    try {
        await execPromise('docker --version');
        return true;
    } catch (error) {
        return false;
    }
}

// Dockerがインストールされていない場合のエラーメッセージを表示
export function showDockerNotInstalledError() {
    const message = '[work-env] Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
    const installButton = 'インストールガイド';
    
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
        }
    });
}

// Dockerの権限を確認する関数
export async function checkDockerPermissions(): Promise<boolean> {
    try {
        await execPromise('docker info');
        return true;
    } catch (error) {
        // エラーメッセージに権限関連の文字列が含まれているか確認
        const errorMessage = error ? (error as Error).toString().toLowerCase() : '';
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('access')) {
            return false;
        }
        // 他のエラーの場合はDockerの問題ではない可能性があるため、インストールされていない扱いにする
        return false;
    }
}

// Dockerの権限エラーの場合のメッセージを表示
export function showDockerPermissionError() {
    const message = '[work-env] Dockerの実行権限がありません。';
    const helpButton = '対処方法を確認';
    
    let helpMessage = '';
    if (os.platform() === 'linux') {
        helpMessage = 'ユーザーをdockerグループに追加してください: sudo usermod -aG docker $USER\nその後、ログアウトして再度ログインしてください。';
    } else if (os.platform() === 'darwin') {
        helpMessage = 'macOSでDockerの権限エラーが発生した場合は、Docker Desktopを再起動してみてください。';
    } else {
        helpMessage = 'Dockerの実行権限を確認してください。管理者権限で実行するか、適切なユーザー権限を設定してください。';
    }
    
    vscode.window.showErrorMessage(message, helpButton).then(selection => {
        if (selection === helpButton) {
            vscode.window.showInformationMessage(helpMessage);
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}

/**
 * リソースファイルのURIを取得する
 * @param context VS Codeのエクステンションコンテキスト 
 * @param relativePath リソースフォルダからの相対パス
 * @returns リソースファイルのURI
 */
export function getResourceUri(context: vscode.ExtensionContext, relativePath: string): vscode.Uri {
    return vscode.Uri.joinPath(context.extensionUri, 'resources', relativePath);
}

// .devcontainerフォルダをセットアップする関数
export async function setupDevContainer(context: vscode.ExtensionContext, targetPath: string, cacheDirPath: string, projectsDirPath: string) {
    try {
        // TemplateProcessorのインスタンスを作成
        const templateProcessor = new TemplateProcessor();
        
        // .devcontainerディレクトリが存在しない場合は作成
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        
        // コンテナテンプレートディレクトリのパスを取得
        const containerTemplateUri = getResourceUri(context, 'templates/container_template');
        const devcontainerTemplateUri = getResourceUri(context, 'templates/container_template/.devcontainer_template');
        const envTemplateUri = getResourceUri(context, 'templates/.env.template');
        
        // 変数定義（必要に応じて）
        const variables: Record<string, string> = {
            GITHUB_PAT: '', // 初期値は空、後で設定される
            PROJECT_FOLDER: projectsDirPath,
            CACHE_FOLDER: cacheDirPath
        };
        
        // テンプレートを展開
        await templateProcessor.expandTemplateDirectory(
            devcontainerTemplateUri.fsPath,
            targetPath,
            variables
        );
        
        // 共通の.envファイルを処理
        if (fs.existsSync(envTemplateUri.fsPath)) {
            const envContent = fs.readFileSync(envTemplateUri.fsPath, 'utf8');
            const processedEnvContent = templateProcessor.replaceVariables(envContent, variables);
            const parentDirPath = path.dirname(path.dirname(targetPath));
            fs.writeFileSync(path.join(parentDirPath, '.env'), processedEnvContent, 'utf8');
        }
        
        vscode.window.showInformationMessage("[work-env] devcontainer設定を作成しました");
    } catch (error) {
        handleFileSystemError(error);
        vscode.window.showErrorMessage(`[work-env] devcontainer設定の作成中にエラーが発生しました: ${parseErrorMessage(error)}`);
        throw error; // 上位の関数でエラーハンドリングができるように再スロー
    }
}

// コンテナでフォルダを開く関数
export async function openFolderInContainer(folderPath: string) {
    try {
        // まず通常のフォルダとして開く
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(folderPath));
        
        // 少し待機してから(フォルダが開かれるのを待つ)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // devcontainerで再度開く
        await vscode.commands.executeCommand("remote-containers.reopen");
        
        vscode.window.showInformationMessage("[work-env] コンテナで開発環境を起動しました");
    } catch (error) {
        vscode.window.showErrorMessage(`[work-env] コンテナでフォルダを開くことができませんでした: ${parseErrorMessage(error)}`);
    }
}

// Docker Composeファイルを生成する関数
export async function generateDockerCompose(context: vscode.ExtensionContext, dockercomposeFilePath: string, config: {projectFolder: string, cacheFolder: string, githubPat: string}): Promise<boolean> {
    try {
        // TemplateProcessorのインスタンスを作成
        const templateProcessor = new TemplateProcessor();
        
        // テンプレートディレクトリのパスを取得
        const containerTemplateUri = getResourceUri(context, 'templates/container_template');
        const devcontainerTemplateUri = getResourceUri(context, 'templates/container_template/.devcontainer_template');
        const envTemplateUri = getResourceUri(context, 'templates/.env.template');
        
        // ファイルアクセス権の設定
        if (!await setupFolderPermissions(config.projectFolder, config.cacheFolder)) {
            return false;
        }
        
        // 変数定義
        const variables: Record<string, string> = {
            GITHUB_PAT: config.githubPat,
            PROJECT_FOLDER: config.projectFolder,
            CACHE_FOLDER: config.cacheFolder
        };
        
        // docker-compose.yml.templateを処理
        try {
            // devcontainerテンプレートを展開
            await templateProcessor.expandTemplateDirectory(
                devcontainerTemplateUri.fsPath,
                path.dirname(dockercomposeFilePath),
                variables
            );
            
            // 共通の.envファイルを処理
            if (fs.existsSync(envTemplateUri.fsPath)) {
                const envContent = fs.readFileSync(envTemplateUri.fsPath, 'utf8');
                const processedEnvContent = templateProcessor.replaceVariables(envContent, variables);
                const parentDirPath = path.dirname(path.dirname(dockercomposeFilePath));
                fs.writeFileSync(path.join(parentDirPath, '.env'), processedEnvContent, 'utf8');
            }
            
            vscode.window.showInformationMessage("[work-env] Docker Compose設定を生成しました");
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`[work-env] テンプレート展開に失敗しました: ${parseErrorMessage(err)}`);
            return false;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`[work-env] Docker Compose設定の生成中にエラーが発生しました: ${parseErrorMessage(error)}`);
        return false;
    }
}

// プロジェクトテンプレートを展開する関数
export async function setupProjectTemplate(context: vscode.ExtensionContext, projectFolder: string): Promise<boolean> {
    try {
        // TemplateProcessorのインスタンスを作成
        const templateProcessor = new TemplateProcessor();
        
        // テンプレートディレクトリのパスを取得
        const projectsTemplateUri = getResourceUri(context, 'templates/container_template/projects_template');
        
        // プロジェクトディレクトリが存在しない場合は作成
        if (!fs.existsSync(projectFolder)) {
            fs.mkdirSync(projectFolder, { recursive: true });
        }
        
        // 変数定義（必要に応じて）
        const variables: Record<string, string> = {};
        
        // テンプレートを展開
        await templateProcessor.expandTemplateDirectory(
            projectsTemplateUri.fsPath,
            projectFolder,
            variables
        );
        
        vscode.window.showInformationMessage("[work-env] プロジェクトテンプレートを展開しました");
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`[work-env] プロジェクトテンプレートの展開中にエラーが発生しました: ${parseErrorMessage(error)}`);
        return false;
    }
}

// Docker Compose設定情報を収集する関数は不要になったので削除
// export async function collectDockerComposeConfig(): Promise<{projectFolder: string, cacheFolder: string, githubPat: string} | null> {
//    ... 削除 ...
// }

// フォルダのアクセス権を設定する関数
export async function setupFolderPermissions(projectFolder: string, cacheFolder: string): Promise<boolean> {
    try {
        await vscode.commands.executeCommand("workbench.action.terminal.new");
        const terminal = vscode.window.activeTerminal;
        terminal?.sendText(`chmod 777 "${projectFolder}"`);
        terminal?.sendText(`chmod 777 "${cacheFolder}"`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`[work-env] 権限エラー: フォルダのアクセス権を変更できません。${parseErrorMessage(error)}`);
        return false;
    }
}

// フォルダを再帰的にコピーする関数
export function copyFolderRecursiveSync(source: string, target: string, fsModule: any = fs) {
    try {
        if (!fsModule.existsSync(source)) {return;}
        if (!fsModule.existsSync(target)) {fsModule.mkdirSync(target, { recursive: true });}

        const files = fsModule.readdirSync(source);
        for (const file of files) {
            const srcPath = path.join(source, file);
            const destPath = path.join(target, file);
            if (fsModule.lstatSync(srcPath).isDirectory()) {
                copyFolderRecursiveSync(srcPath, destPath, fsModule);
            } else {
                fsModule.copyFileSync(srcPath, destPath);
            }
        }
    } catch (error) {
        handleFileSystemError(error);
    }
}

/**
 * Docker Composeファイルを生成する
 * @param config 設定情報
 * @returns 成功した場合はtrue
 */
export function generateDockerComposeFiles(config: {projectFolder: string, cacheFolder: string, githubPat: string}): boolean {
    try {
        const devcontainerPath = path.join(os.tmpdir(), '.devcontainer');
        if (!fs.existsSync(devcontainerPath)) {
            fs.mkdirSync(devcontainerPath, { recursive: true });
        }
        
        const dockerComposePath = path.join(devcontainerPath, 'docker-compose.yml');
        const dockerComposeContent = `version: '3'
services:
  workspace:
    image: ${CONFIG.DOCKER_IMAGE}
    volumes:
      - "${config.projectFolder}:/workspace"
      - "${config.cacheFolder}:/cache"
    environment:
      - GITHUB_TOKEN=${config.githubPat}
    command: sleep infinity`;
        
        fs.writeFileSync(dockerComposePath, dockerComposeContent);
        return true;
    } catch (error) {
        handleFileSystemError(error);
        vscode.window.showErrorMessage(`[work-env] Docker Composeファイルの生成に失敗しました: ${parseErrorMessage(error)}`);
        return false;
    }
}

/**
 * 開発環境を起動する
 */
export async function startWorkEnv(): Promise<void> {
    try {
        // 事前チェック
        if (!await preflightChecks()) {
            return;
        }
        
        // 親ディレクトリの選択
        const parentDirUri = await selectParentDirectory();
        if (!parentDirUri) {
            return;
        }
        
        const parentDirPath = parentDirUri.fsPath;
        const cacheDirPath = path.join(parentDirPath, "cache");
        const containerDirPath = path.join(parentDirPath, "container");
        const containerDevcontainerPath = path.join(containerDirPath, ".devcontainer");
        const projectsDirPath = path.join(containerDirPath, "projects");
        
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        
        // DockerイメージのPull
        if (!await pullDockerImage(CONFIG.DOCKER_IMAGE)) {
            return;
        }
        
        // ディレクトリ構造の作成
        ensureDirectory(cacheDirPath);
        ensureDirectory(containerDirPath);
        ensureDirectory(projectsDirPath);
        
        // .devcontainerの設定
        await setupDevContainer({ extensionUri: context } as any, containerDevcontainerPath, cacheDirPath, projectsDirPath);
        
        // GitHub PATの入力
        const githubPat = await inputGitHubPAT();
        if (!githubPat) {
            return;
        }
        
        // docker-compose.ymlの生成
        const dockercomposeFilePath = path.join(containerDevcontainerPath, "docker-compose.yml");
        await generateDockerCompose(
            { extensionUri: context } as any, 
            dockercomposeFilePath, 
            {
                projectFolder: projectsDirPath,
                cacheFolder: cacheDirPath,
                githubPat
            }
        );
        
        // プロジェクトテンプレートの展開
        await setupProjectTemplate({ extensionUri: context } as any, projectsDirPath);
        
        // コンテナディレクトリをVSCodeで開く
        openFolderInContainer(containerDirPath);
    } catch (error) {
        const errorMessage = parseErrorMessage(error);
        if (isDockerError(error)) {
            handleDockerError(error);
        } else {
            vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
        }
    }
}

/**
 * Dockerコマンドを実行する
 * @param command 実行するコマンド
 * @returns 成功した場合はコマンドの出力、失敗した場合はnull
 */
export async function executeDockerCommand(command: string): Promise<string | null> {
    try {
        const { stdout } = await execPromise(command);
        return stdout;
    } catch (error) {
        if (isDockerError(error)) {
            handleDockerError(error);
        } else {
            vscode.window.showErrorMessage(`[work-env] コマンド実行エラー: ${parseErrorMessage(error)}`);
        }
        return null;
    }
}

/**
 * 設定をリセットする
 */
export async function resetWorkEnvConfig(): Promise<void> {
    try {
        // 親ディレクトリの選択
        const parentDirUri = await selectParentDirectory();
        if (!parentDirUri) {
            return;
        }
        
        const parentDirPath = parentDirUri.fsPath;
        const cacheDirPath = path.join(parentDirPath, "cache");
        const containerDirPath = path.join(parentDirPath, "container");
        const containerDevcontainerPath = path.join(containerDirPath, ".devcontainer");
        const projectsDirPath = path.join(containerDirPath, "projects");
        
        if (!fs.existsSync(containerDevcontainerPath)) {
            vscode.window.showInformationMessage("まず 'Start work-env' を実行してください");
            return;
        }
        
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        
        // GitHub PATの入力
        const githubPat = await inputGitHubPAT();
        if (!githubPat) {
            return;
        }
        
        // docker-compose.ymlの生成
        const dockercomposeFilePath = path.join(containerDevcontainerPath, "docker-compose.yml");
        await generateDockerCompose(
            { extensionUri: context } as any, 
            dockercomposeFilePath, 
            {
                projectFolder: projectsDirPath,
                cacheFolder: cacheDirPath,
                githubPat
            }
        );
        
        // コンテナの削除
        await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
        
        // コンテナディレクトリをVSCodeで開く
        openFolderInContainer(containerDirPath);
        
        vscode.window.showInformationMessage("[work-env] 設定をリセットしました。");
    } catch (error) {
        vscode.window.showErrorMessage(`[work-env] 設定のリセットに失敗しました: ${parseErrorMessage(error)}`);
    }
}

// Dockerがインストールされていない場合のプロンプト表示
export async function showDockerInstallPrompt(): Promise<boolean> {
    const message = 'Dockerがインストールされていません。自動的にインストールしますか？';
    const installButton = 'インストールする';
    const cancelButton = 'キャンセル';
    
    const selection = await vscode.window.showInformationMessage(
        message, 
        { modal: true },
        installButton, 
        cancelButton
    );
    
    return selection === installButton;
}

// Dockerインストールの実行
export async function installDockerWithProgress(): Promise<boolean> {
    // OS情報の検出
    const osInfo = dockerInstaller.detectOS();
    
    // Linuxの場合はディストリビューション情報も取得
    if (osInfo.platform === 'linux') {
        osInfo.distro = await dockerInstaller.detectLinuxDistro();
    }
    
    // Dockerインストール実行
    const result = await dockerInstaller.installDocker(osInfo);
    
    if (result.success) {
        vscode.window.showInformationMessage(`[work-env] ${result.message}`);
        return true;
    } else {
        if (result.details) {
            vscode.window.showErrorMessage(`[work-env] ${result.message}: ${result.details}`);
        } else {
            vscode.window.showErrorMessage(`[work-env] ${result.message}`);
        }
        return false;
    }
}

// Export function for E2E testing
/**
 * 設定のバリデーションを行う（E2Eテスト用）
 * @returns 設定が有効な場合はtrue、そうでない場合はfalse
 */
export async function validateSettings(): Promise<boolean> {
  try {
    // 親ディレクトリの選択
    const parentDirUri = await selectParentDirectory();
    if (!parentDirUri) {
      return false;
    }
    
    // GitHub PATの入力
    const githubPat = await inputGitHubPAT();
    if (!githubPat) {
      return false;
    }
    
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`[work-env] 設定のバリデーションに失敗しました: ${parseErrorMessage(error)}`);
    return false;
  }
}

// E2Eテスト用のエクスポート
// 統合テストで使用する関数をここでエクスポート
export const forTesting = {
  validateSettings,
  selectParentDirectory,
  inputGitHubPAT,
  isDockerInstalled,
  preflightChecks
};

// テスト用にエクスポートする関数
export const EXPORTED_FUNCTIONS = {
    parseErrorMessage,
    isDockerInstalled,
    showDockerInstallPrompt,
    installDockerWithProgress,
    pullDockerImage,
    openFolderInContainer,
    setupDevContainer,
    generateDockerCompose,
    setupFolderPermissions,
    validateInput,
    removeExistingContainers,
    setupProjectTemplate,
    startWorkEnv,
    resetWorkEnvConfig,
    showDockerNotInstalledError,
    checkDockerPermissions,
    showDockerPermissionError,
    preflightChecks
};

// commonjs用にエクスポート
module.exports = {
    activate,
    startWorkEnv,
    resetWorkEnvConfig,
    setupDevContainer,
    generateDockerCompose,
    openFolderInContainer,
    setupFolderPermissions,
    installDockerWithProgress,
    validateInput,
    isDockerInstalled,
    showDockerNotInstalledError,
    checkDockerPermissions,
    showDockerPermissionError,
    preflightChecks
};