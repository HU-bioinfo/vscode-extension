import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execPromise = promisify(exec);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext) {
    const extensionStoragePath = context.globalStorageUri.fsPath;
    const devcontainerPath = path.join(extensionStoragePath, ".devcontainer");
    const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");

    let startWorkEnvCommand = vscode.commands.registerCommand('work-env.start-work-env', async () => {
        try{
            // Remote Containers拡張機能がインストールされているか確認
            if (!isRemoteContainersExtensionInstalled()) {
                showRemoteContainersNotInstalledError();
                return;
            }

            // Dockerがインストールされているか確認
            if (!await isDockerInstalled()) {
                showDockerNotInstalledError();
                return;
            }

            // Dockerの権限を確認
            if (!await checkDockerPermissions()) {
                showDockerPermissionError();
                return;
            }
            
            // docker imageの更新
            await vscode.commands.executeCommand("workbench.action.terminal.new");
            const terminal = vscode.window.activeTerminal;
            
            try {
                vscode.window.showInformationMessage("Dockerイメージを取得中...");
                await execPromise('docker pull kokeh/hu_bioinfo:stable');
            } catch (error) {
                vscode.window.showErrorMessage(`Dockerイメージの取得に失敗しました: ${error}。ネットワーク接続を確認してください。`);
                return;
            }
            
            // .devcontainer の設定
            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage(".devcontainerを設定中...");
                setupDevContainer(context, devcontainerPath);
            }
            
            if (!fs.existsSync(dockercomposeFilePath)) {
                const success = await generateDockerCompose(context, dockercomposeFilePath);
                if (!success) return;
            }

            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath)
        } catch (error) {
            vscode.window.showErrorMessage(`エラー: ${error}`);
        }
    });
    
    
    let resetConfigCommand = vscode.commands.registerCommand('work-env.reset-config', async () => {
        try {
            // Remote Containers拡張機能がインストールされているか確認
            if (!isRemoteContainersExtensionInstalled()) {
                showRemoteContainersNotInstalledError();
                return;
            }

            // Dockerがインストールされているか確認
            if (!await isDockerInstalled()) {
                showDockerNotInstalledError();
                return;
            }

            // Dockerの権限を確認
            if (!await checkDockerPermissions()) {
                showDockerPermissionError();
                return;
            }
            
            try {
                vscode.window.showInformationMessage("Dockerイメージを取得中...");
                await execPromise('docker pull kokeh/hu_bioinfo:stable');
            } catch (error) {
                vscode.window.showErrorMessage(`Dockerイメージの取得に失敗しました: ${error}。ネットワーク接続を確認してください。`);
                return;
            }

            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage("まず 'Start work-env' を実行してください");
                return;
            }

            // ここで false が返ったら処理を中断
            const success = await generateDockerCompose(context, dockercomposeFilePath);
            if (!success) return;

            // 一度現在存在しているこのextension用のdocker containerを削除
            try {
                await execPromise("docker rm -f $(docker ps -aq --filter 'name=hu-bioinfo-workshop' --filter 'name=work-env')");
            } catch (error) {
                // コンテナが存在しない場合はエラーが出るが無視して続行
            }
            
            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath)
        } catch (error) {
            vscode.window.showErrorMessage(`エラー: ${error}`);
        }
    });

    context.subscriptions.push(startWorkEnvCommand);
    context.subscriptions.push(resetConfigCommand);
}

// Remote Containers拡張機能がインストールされているかを確認する関数
function isRemoteContainersExtensionInstalled(): boolean {
    const extension = vscode.extensions.getExtension('ms-vscode-remote.remote-containers');
    return !!extension;
}

// Remote Containers拡張機能がインストールされていない場合のエラーメッセージを表示
function showRemoteContainersNotInstalledError() {
    const message = 'Remote Containers拡張機能がインストールされていません。この拡張機能を使用する前にインストールしてください。';
    const installButton = '拡張機能をインストール';
    
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.commands.executeCommand('workbench.extensions.search', 'ms-vscode-remote.remote-containers');
        }
    });
}

// Dockerがインストールされているかを確認する関数
async function isDockerInstalled(): Promise<boolean> {
    try {
        await execPromise('docker --version');
        return true;
    } catch (error) {
        return false;
    }
}

// Dockerがインストールされていない場合のエラーメッセージを表示
function showDockerNotInstalledError() {
    const message = 'Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
    const installButton = 'インストールガイド';
    
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
        }
    });
}

// Dockerの権限を確認する関数
async function checkDockerPermissions(): Promise<boolean> {
    try {
        await execPromise('docker info');
        return true;
    } catch (error) {
        // エラーメッセージに権限関連の文字列が含まれているか確認
        const errorMessage = (error as Error).toString().toLowerCase();
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('access')) {
            return false;
        }
        // 他のエラーの場合はDockerの問題ではない可能性があるため、インストールされていない扱いにする
        return false;
    }
}

// Dockerの権限エラーの場合のメッセージを表示
function showDockerPermissionError() {
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

function setupDevContainer(context: vscode.ExtensionContext, targetPath: string) {
    const sourcePath = path.join(context.extensionUri.fsPath, ".devcontainer");
    copyFolderRecursiveSync(sourcePath, targetPath);
}

function openFolderInContainer(extensionStoragePath: string) {
    const folderUri = vscode.Uri.file(extensionStoragePath)
    vscode.commands.executeCommand("remote-containers.openFolder", folderUri).
    then(() => {
    }, (error) => {
        vscode.window.showErrorMessage(`コンテナでフォルダを開くことができませんでした: ${error.message}`);
    });
}

async function generateDockerCompose(context: vscode.ExtensionContext, dockercomposeFilePath: string) {
    const dockercomposeTempletePath = path.join(context.extensionUri.fsPath, "docker-compose.templete.yml");
    // プロジェクトフォルダの選択
    const projectFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Project Folder"
    });
    if (!projectFolderUri || projectFolderUri.length === 0) {
        vscode.window.showErrorMessage("プロジェクトフォルダが選択されていません。");
        return false;  // 失敗
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
        return false;  // 失敗
    }
    const cacheFolder = cacheFolderUri[0].fsPath;

    // GitHub PAT の入力
    const githubPat = await vscode.window.showInputBox({
        prompt: "Enter your GitHub Personal Access Token",
        ignoreFocusOut: true,
        password: true
    });
    if (!githubPat) {
        vscode.window.showErrorMessage("GitHub PATが必要です。");
        return false;  // 失敗
    }

    try{
        await vscode.commands.executeCommand("workbench.action.terminal.new");
        const terminal = vscode.window.activeTerminal;
        terminal?.sendText(`chmod 777 "${projectFolder}"`);
        terminal?.sendText(`chmod 777 "${cacheFolder}"`);
    } catch (error) {
        vscode.window.showErrorMessage("権限エラー: フォルダのアクセス権を変更できません。");
        return false;
    }

    try {
        const replacements: Record<string, string> = {
            GITHUB_PAT: githubPat,
            CACHE_FOLDER: cacheFolder,
            PROJECT_FOLDER: projectFolder
        };

        // テンプレートファイルを読み込む
        let template = fs.readFileSync(dockercomposeTempletePath, 'utf8');

        // プレースホルダーを置換
        Object.entries(replacements).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g'); // `{{GITHUB_PAT}}` のようなパターンを探す
            template = template.replace(regex, value);
        });

        fs.writeFileSync(dockercomposeFilePath, template.trim());
        return true;  // 成功
    } catch (error) {
        vscode.window.showErrorMessage("docker-compose.ymlの生成中にエラーが発生しました。");
        return false;  // 失敗
    }
}

function copyFolderRecursiveSync(source: string, target: string) {
    if (!fs.existsSync(source)) return;
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

    const files = fs.readdirSync(source);
    for (const file of files) {
        const srcPath = path.join(source, file);
        const destPath = path.join(target, file);
        if (fs.lstatSync(srcPath).isDirectory()) {
            copyFolderRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}