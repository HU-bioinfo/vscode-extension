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
    const extensionStoragePath = context.globalStorageUri.fsPath;
    const devcontainerPath = path.join(extensionStoragePath, ".devcontainer");
    const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");

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
            
            // .devcontainer の設定
            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage(".devcontainerを設定中...");
                setupDevContainer(context, devcontainerPath);
            }
            
            if (!fs.existsSync(dockercomposeFilePath)) {
                const success = await generateDockerCompose(context, dockercomposeFilePath);
                if (!success) {return;}
            }

            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath);
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`エラー: ${errorMessage}`);
            }
        }
    });
    
    let resetConfigCommand = vscode.commands.registerCommand('work-env.reset-config', async () => {
        try {
            // 事前チェック
            if (!await preflightChecks()) {
                return;
            }
            
            // DockerイメージのPull
            if (!await pullDockerImage(CONFIG.DOCKER_IMAGE)) {
                return;
            }

            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage("まず 'Start work-env' を実行してください");
                return;
            }

            // ここで false が返ったら処理を中断
            const success = await generateDockerCompose(context, dockercomposeFilePath);
            if (!success) {return;}

            // コンテナの削除
            await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
            
            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath);
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`エラー: ${errorMessage}`);
            }
        }
    });

    context.subscriptions.push(startWorkEnvCommand);
    context.subscriptions.push(resetConfigCommand);
}

/**
 * 事前チェック（Remote Container拡張、Docker、権限）
 * @returns 全てのチェックが通った場合はtrue
 */
export async function preflightChecks(): Promise<boolean> {
    // Remote Containers拡張機能がインストールされているか確認
    if (!await isRemoteContainersInstalled()) {
        showRemoteContainersNotInstalledError();
        return false;
    }

    // Dockerがインストールされているか確認
    if (!await isDockerInstalled()) {
        showDockerNotInstalledError();
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
        vscode.window.showInformationMessage(`Dockerイメージ ${imageName} を取得中...`);
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

// Remote Containers拡張機能がインストールされているかを確認する関数
export async function isRemoteContainersInstalled(): Promise<boolean> {
    const extension = vscode.extensions.getExtension('ms-vscode-remote.remote-containers');
    return !!extension;
}

// Remote Containers拡張機能がインストールされていない場合のエラーメッセージを表示
export function showRemoteContainersNotInstalledError() {
    const message = 'Remote Containers拡張機能がインストールされていません。この拡張機能を使用する前にインストールしてください。';
    const installButton = '拡張機能をインストール';
    
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.commands.executeCommand('workbench.extensions.search', 'ms-vscode-remote.remote-containers');
        }
    });
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
    const message = 'Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
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
    const message = 'Dockerの実行権限がありません。';
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

// .devcontainerフォルダをセットアップする関数
export function setupDevContainer(context: vscode.ExtensionContext, targetPath: string) {
    try {
        const sourcePath = path.join(context.extensionUri.fsPath, ".devcontainer");
        copyFolderRecursiveSync(sourcePath, targetPath);
    } catch (error) {
        handleFileSystemError(error);
    }
}

// コンテナでフォルダを開く関数
export function openFolderInContainer(extensionStoragePath: string) {
    const folderUri = vscode.Uri.file(extensionStoragePath);
    vscode.commands.executeCommand("remote-containers.openFolder", folderUri).
    then(() => {
        // トークンは使用しないが、APIの要件として必要
    }, (error) => {
        vscode.window.showErrorMessage(`コンテナでフォルダを開くことができませんでした: ${parseErrorMessage(error)}`);
    });
}

// Docker Composeファイルを生成する関数
export async function generateDockerCompose(context: vscode.ExtensionContext, dockercomposeFilePath: string): Promise<boolean> {
    const templatePath = path.join(context.extensionUri.fsPath, "docker-compose.templete.yml");
    
    // 設定情報の収集
    const config = await collectDockerComposeConfig();
    if (!config) {
        return false;
    }
    
    // ファイルアクセス権の設定
    if (!await setupFolderPermissions(config.projectFolder, config.cacheFolder)) {
        return false;
    }
    
    // テンプレートファイルの処理
    return processTemplateFile(templatePath, dockercomposeFilePath, config);
}

// Docker Compose設定情報を収集する関数
export async function collectDockerComposeConfig(): Promise<{projectFolder: string, cacheFolder: string, githubPat: string} | null> {
    // プロジェクトフォルダの選択
    const projectFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Project Folder"
    });
    if (!projectFolderUri || projectFolderUri.length === 0) {
        vscode.window.showErrorMessage("プロジェクトフォルダが選択されていません。");
        return null;
    }
    const projectFolder = projectFolderUri[0].fsPath;

    // キャッシュディレクトリの選択
    const cacheFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Cache Folder"
    });
    if (!cacheFolderUri || cacheFolderUri.length === 0) {
        vscode.window.showErrorMessage("キャッシュフォルダが選択されていません。");
        return null;
    }
    const cacheFolder = cacheFolderUri[0].fsPath;

    // GitHub PAT の入力
    const githubPat = await vscode.window.showInputBox({
        prompt: "Enter your GitHub Personal Access Token",
        ignoreFocusOut: true,
        password: true,
        validateInput: validateInput
    });
    if (!githubPat) {
        vscode.window.showErrorMessage("GitHub PATが必要です。");
        return null;
    }
    
    return { projectFolder, cacheFolder, githubPat };
}

// フォルダのアクセス権を設定する関数
export async function setupFolderPermissions(projectFolder: string, cacheFolder: string): Promise<boolean> {
    try {
        await vscode.commands.executeCommand("workbench.action.terminal.new");
        const terminal = vscode.window.activeTerminal;
        terminal?.sendText(`chmod 777 "${projectFolder}"`);
        terminal?.sendText(`chmod 777 "${cacheFolder}"`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`権限エラー: フォルダのアクセス権を変更できません。${parseErrorMessage(error)}`);
        return false;
    }
}

// テンプレートファイルを処理する関数
export function processTemplateFile(
    templatePath: string,
    outputPath: string,
    config: {projectFolder: string, cacheFolder: string, githubPat: string}
): boolean {
    try {
        const replacements: Record<string, string> = {
            GITHUB_PAT: config.githubPat,
            CACHE_FOLDER: config.cacheFolder,
            PROJECT_FOLDER: config.projectFolder
        };

        // テンプレートファイルを読み込む
        let template = fs.readFileSync(templatePath, 'utf8');

        // プレースホルダーを置換
        Object.entries(replacements).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g'); // `{{GITHUB_PAT}}` のようなパターンを探す
            template = template.replace(regex, value);
        });

        fs.writeFileSync(outputPath, template.trim());
        return true;  // 成功
    } catch (error) {
        handleFileSystemError(error);
        vscode.window.showErrorMessage(`docker-compose.ymlの生成中にエラーが発生しました。`);
        return false;  // 失敗
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
        vscode.window.showErrorMessage(`Docker Composeファイルの生成に失敗しました: ${parseErrorMessage(error)}`);
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
        
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        const storageUri = { fsPath: path.join(os.tmpdir(), 'work-env') };
        
        // DockerイメージのPull
        if (!await pullDockerImage(CONFIG.DOCKER_IMAGE)) {
            return;
        }
        
        const devcontainerPath = path.join(storageUri.fsPath, ".devcontainer");
        const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");
        
        // .devcontainer の設定
        if (!fs.existsSync(devcontainerPath)) {
            vscode.window.showInformationMessage(".devcontainerを設定中...");
            setupDevContainer({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] } as any, devcontainerPath);
        }
        
        // 設定情報を収集してDocker Composeファイルを生成
        if (!fs.existsSync(dockercomposeFilePath)) {
            const success = await generateDockerCompose({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] } as any, dockercomposeFilePath);
            if (!success) {return;}
        }

        // remote-containers.openFolder コマンドで開く
        openFolderInContainer(storageUri.fsPath);
    } catch (error) {
        const errorMessage = parseErrorMessage(error);
        if (isDockerError(error)) {
            handleDockerError(error);
        } else {
            vscode.window.showErrorMessage(`エラー: ${errorMessage}`);
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
            vscode.window.showErrorMessage(`コマンド実行エラー: ${parseErrorMessage(error)}`);
        }
        return null;
    }
}

/**
 * 設定をリセットする
 */
export async function resetWorkEnvConfig(): Promise<void> {
    try {
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        const storageUri = { fsPath: path.join(os.tmpdir(), 'work-env') };
        
        const devcontainerPath = path.join(storageUri.fsPath, ".devcontainer");
        const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");
        
        // 設定情報を収集してDocker Composeファイルを上書き
        const success = await generateDockerCompose({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] } as any, dockercomposeFilePath);
        if (!success) {return;}
        
        // コンテナの削除
        await removeExistingContainers(CONFIG.CONTAINER_NAME_FILTERS);
        
        vscode.window.showInformationMessage("設定をリセットしました。");
    } catch (error) {
        vscode.window.showErrorMessage(`設定のリセットに失敗しました: ${parseErrorMessage(error)}`);
    }
}