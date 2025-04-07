"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.forTesting = exports.CONFIG = void 0;
exports.activate = activate;
exports.preflightChecks = preflightChecks;
exports.pullDockerImage = pullDockerImage;
exports.removeExistingContainers = removeExistingContainers;
exports.isRemoteContainersInstalled = isRemoteContainersInstalled;
exports.showRemoteContainersNotInstalledError = showRemoteContainersNotInstalledError;
exports.isDockerInstalled = isDockerInstalled;
exports.showDockerNotInstalledError = showDockerNotInstalledError;
exports.checkDockerPermissions = checkDockerPermissions;
exports.showDockerPermissionError = showDockerPermissionError;
exports.deactivate = deactivate;
exports.getResourceUri = getResourceUri;
exports.setupDevContainer = setupDevContainer;
exports.openFolderInContainer = openFolderInContainer;
exports.generateDockerCompose = generateDockerCompose;
exports.collectDockerComposeConfig = collectDockerComposeConfig;
exports.setupFolderPermissions = setupFolderPermissions;
exports.processTemplateFile = processTemplateFile;
exports.copyFolderRecursiveSync = copyFolderRecursiveSync;
exports.generateDockerComposeFiles = generateDockerComposeFiles;
exports.startWorkEnv = startWorkEnv;
exports.executeDockerCommand = executeDockerCommand;
exports.resetWorkEnvConfig = resetWorkEnvConfig;
exports.showDockerInstallPrompt = showDockerInstallPrompt;
exports.installDockerWithProgress = installDockerWithProgress;
exports.validateSettings = validateSettings;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const os = __importStar(require("os"));
const error_handlers_1 = require("./error-handlers");
const dockerInstaller = __importStar(require("./docker-installer"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// 設定関連の定数
exports.CONFIG = {
    DOCKER_IMAGE: 'kokeh/hu_bioinfo:stable',
    CONTAINER_NAME_FILTERS: ['hu-bioinfo-workshop', 'work-env'],
    // Remote Containers拡張のIDは複数の可能性があるため配列で定義
    REMOTE_CONTAINERS_IDS: [
        'ms-vscode-remote.remote-containers',
        'ms-vscode-remote.remote-containers-nightly'
    ]
};
/**
 * エクステンションアクティベーション時の処理
 * @param context VS Codeのエクステンションコンテキスト
 */
function activate(context) {
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
            if (!await pullDockerImage(exports.CONFIG.DOCKER_IMAGE)) {
                return;
            }
            // .devcontainer の設定
            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage("[work-env] .devcontainerを設定中...");
                setupDevContainer(context, devcontainerPath);
            }
            if (!fs.existsSync(dockercomposeFilePath)) {
                const success = await generateDockerCompose(context, dockercomposeFilePath);
                if (!success) {
                    return;
                }
            }
            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath);
        }
        catch (error) {
            const errorMessage = (0, error_handlers_1.parseErrorMessage)(error);
            if ((0, error_handlers_1.isDockerError)(error)) {
                (0, error_handlers_1.handleDockerError)(error);
            }
            else {
                vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
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
            if (!await pullDockerImage(exports.CONFIG.DOCKER_IMAGE)) {
                return;
            }
            if (!fs.existsSync(devcontainerPath)) {
                vscode.window.showInformationMessage("まず 'Start work-env' を実行してください");
                return;
            }
            // ここで false が返ったら処理を中断
            const success = await generateDockerCompose(context, dockercomposeFilePath);
            if (!success) {
                return;
            }
            // コンテナの削除
            await removeExistingContainers(exports.CONFIG.CONTAINER_NAME_FILTERS);
            // remote-containers.openFolder コマンドで開く
            openFolderInContainer(extensionStoragePath);
        }
        catch (error) {
            const errorMessage = (0, error_handlers_1.parseErrorMessage)(error);
            if ((0, error_handlers_1.isDockerError)(error)) {
                (0, error_handlers_1.handleDockerError)(error);
            }
            else {
                vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
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
async function preflightChecks() {
    // Remote Containers拡張機能がインストールされているか確認
    if (!await isRemoteContainersInstalled()) {
        showRemoteContainersNotInstalledError();
        return false;
    }
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
async function pullDockerImage(imageName) {
    try {
        vscode.window.showInformationMessage(`[work-env] Dockerイメージ ${imageName} を取得中...`);
        await execPromise(`docker pull ${imageName}`);
        return true;
    }
    catch (error) {
        (0, error_handlers_1.handleDockerError)(error);
        return false;
    }
}
/**
 * 既存のコンテナを削除する
 * @param nameFilters コンテナ名フィルタ
 * @returns 成功した場合はtrue
 */
async function removeExistingContainers(nameFilters) {
    try {
        // フィルタ文字列の作成
        const filterStr = nameFilters.map(name => `--filter 'name=${name}'`).join(' ');
        await execPromise(`docker rm -f $(docker ps -aq ${filterStr})`);
        return true;
    }
    catch (error) {
        // コンテナが存在しない場合はエラーが出るが無視して続行
        return true;
    }
}
// Remote Containers拡張機能がインストールされているかを確認する関数
async function isRemoteContainersInstalled() {
    try {
        // コマンドラインでチェック
        try {
            // remote-containersを含む拡張機能をチェック
            const { stdout } = await execPromise('code --list-extensions | grep -i "remote-containers"');
            return stdout.trim().length > 0;
        }
        catch (cmdError) {
            // コマンド実行エラーの場合は失敗とみなす（grepでマッチしない場合もエラーになるため）
            return false;
        }
    }
    catch (error) {
        vscode.window.showWarningMessage(`[work-env] Remote Containers拡張機能の確認中にエラーが発生しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false;
    }
}
// Remote Containers拡張機能がインストールされていない場合のエラーメッセージを表示
function showRemoteContainersNotInstalledError() {
    const message = '[work-env] Remote Containers拡張機能がインストールされていません。この拡張機能を使用する前にインストールしてください。';
    const installButton = '拡張機能をインストール';
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.commands.executeCommand('workbench.extensions.search', 'ms-vscode-remote.remote-containers');
        }
    });
}
// Dockerがインストールされているかを確認する関数
async function isDockerInstalled() {
    try {
        await execPromise('docker --version');
        return true;
    }
    catch (error) {
        return false;
    }
}
// Dockerがインストールされていない場合のエラーメッセージを表示
function showDockerNotInstalledError() {
    const message = '[work-env] Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
    const installButton = 'インストールガイド';
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
        }
    });
}
// Dockerの権限を確認する関数
async function checkDockerPermissions() {
    try {
        await execPromise('docker info');
        return true;
    }
    catch (error) {
        // エラーメッセージに権限関連の文字列が含まれているか確認
        const errorMessage = error ? error.toString().toLowerCase() : '';
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('access')) {
            return false;
        }
        // 他のエラーの場合はDockerの問題ではない可能性があるため、インストールされていない扱いにする
        return false;
    }
}
// Dockerの権限エラーの場合のメッセージを表示
function showDockerPermissionError() {
    const message = '[work-env] Dockerの実行権限がありません。';
    const helpButton = '対処方法を確認';
    let helpMessage = '';
    if (os.platform() === 'linux') {
        helpMessage = 'ユーザーをdockerグループに追加してください: sudo usermod -aG docker $USER\nその後、ログアウトして再度ログインしてください。';
    }
    else if (os.platform() === 'darwin') {
        helpMessage = 'macOSでDockerの権限エラーが発生した場合は、Docker Desktopを再起動してみてください。';
    }
    else {
        helpMessage = 'Dockerの実行権限を確認してください。管理者権限で実行するか、適切なユーザー権限を設定してください。';
    }
    vscode.window.showErrorMessage(message, helpButton).then(selection => {
        if (selection === helpButton) {
            vscode.window.showInformationMessage(helpMessage);
        }
    });
}
// This method is called when your extension is deactivated
function deactivate() { }
/**
 * リソースファイルのURIを取得する
 * @param context VS Codeのエクステンションコンテキスト
 * @param relativePath リソースフォルダからの相対パス
 * @returns リソースファイルのURI
 */
function getResourceUri(context, relativePath) {
    return vscode.Uri.joinPath(context.extensionUri, 'resources', relativePath);
}
// .devcontainerフォルダをセットアップする関数
function setupDevContainer(context, targetPath) {
    try {
        // .devcontainerディレクトリが存在しない場合は作成
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        // devcontainer.json.templateからdevcontainer.jsonを生成
        const devcontainerJsonTemplateUri = getResourceUri(context, 'templates/devcontainer_template/devcontainer.json.template');
        const devcontainerJsonPath = path.join(targetPath, "devcontainer.json");
        try {
            const template = fs.readFileSync(devcontainerJsonTemplateUri.fsPath, 'utf8');
            fs.writeFileSync(devcontainerJsonPath, template);
            vscode.window.showInformationMessage("[work-env] devcontainer.jsonを作成しました");
        }
        catch (err) {
            throw new Error(`devcontainer.json.templateが見つかりません: ${(0, error_handlers_1.parseErrorMessage)(err)}`);
        }
    }
    catch (error) {
        (0, error_handlers_1.handleFileSystemError)(error);
        vscode.window.showErrorMessage(`[work-env] devcontainer設定の作成中にエラーが発生しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
    }
}
// コンテナでフォルダを開く関数
function openFolderInContainer(extensionStoragePath) {
    const folderUri = vscode.Uri.file(extensionStoragePath);
    vscode.commands.executeCommand("remote-containers.openFolder", folderUri).
        then(() => {
        // トークンは使用しないが、APIの要件として必要
    }, (error) => {
        vscode.window.showErrorMessage(`[work-env] コンテナでフォルダを開くことができませんでした: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
    });
}
// Docker Composeファイルを生成する関数
async function generateDockerCompose(context, dockercomposeFilePath) {
    const templateUri = getResourceUri(context, 'templates/devcontainer_template/docker-compose.yml.template');
    // テンプレートファイルの存在確認
    try {
        const templatePath = templateUri.fsPath;
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
    catch (error) {
        vscode.window.showErrorMessage(`[work-env] docker-compose.yml.templateが見つかりません: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false;
    }
}
// Docker Compose設定情報を収集する関数
async function collectDockerComposeConfig() {
    // プロジェクトフォルダの選択
    const projectFolderUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Project Folder"
    });
    if (!projectFolderUri || projectFolderUri.length === 0) {
        vscode.window.showErrorMessage("[work-env] プロジェクトフォルダが選択されていません。");
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
        vscode.window.showErrorMessage("[work-env] キャッシュフォルダが選択されていません。");
        return null;
    }
    const cacheFolder = cacheFolderUri[0].fsPath;
    // GitHub PAT の入力
    const githubPat = await vscode.window.showInputBox({
        prompt: "Enter your GitHub Personal Access Token",
        ignoreFocusOut: true,
        password: true,
        validateInput: error_handlers_1.validateInput
    });
    if (!githubPat) {
        vscode.window.showErrorMessage("[work-env] GitHub PATが必要です。");
        return null;
    }
    return { projectFolder, cacheFolder, githubPat };
}
// フォルダのアクセス権を設定する関数
async function setupFolderPermissions(projectFolder, cacheFolder) {
    try {
        await vscode.commands.executeCommand("workbench.action.terminal.new");
        const terminal = vscode.window.activeTerminal;
        terminal?.sendText(`chmod 777 "${projectFolder}"`);
        terminal?.sendText(`chmod 777 "${cacheFolder}"`);
        return true;
    }
    catch (error) {
        vscode.window.showErrorMessage(`[work-env] 権限エラー: フォルダのアクセス権を変更できません。${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false;
    }
}
// テンプレートファイルを処理する関数
function processTemplateFile(templatePath, outputPath, config) {
    try {
        const replacements = {
            GITHUB_PAT: config.githubPat,
            CACHE_FOLDER: config.cacheFolder,
            PROJECT_FOLDER: config.projectFolder
        };
        // テンプレートファイルを読み込む
        let template;
        try {
            template = fs.readFileSync(templatePath, 'utf8');
        }
        catch (err) {
            vscode.window.showErrorMessage(`[work-env] テンプレートファイルの読み込みに失敗しました: ${(0, error_handlers_1.parseErrorMessage)(err)}`);
            return false;
        }
        // プレースホルダーを置換
        Object.entries(replacements).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g'); // `{{GITHUB_PAT}}` のようなパターンを探す
            template = template.replace(regex, value);
        });
        // 出力ディレクトリの確保
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        // ファイル書き込み
        try {
            fs.writeFileSync(outputPath, template.trim());
            vscode.window.showInformationMessage(`[work-env] 設定ファイルを生成しました: ${path.basename(outputPath)}`);
            return true; // 成功
        }
        catch (err) {
            vscode.window.showErrorMessage(`[work-env] 設定ファイルの書き込みに失敗しました: ${(0, error_handlers_1.parseErrorMessage)(err)}`);
            return false;
        }
    }
    catch (error) {
        (0, error_handlers_1.handleFileSystemError)(error);
        vscode.window.showErrorMessage(`[work-env] 設定ファイルの生成中にエラーが発生しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false; // 失敗
    }
}
// フォルダを再帰的にコピーする関数
function copyFolderRecursiveSync(source, target, fsModule = fs) {
    try {
        if (!fsModule.existsSync(source)) {
            return;
        }
        if (!fsModule.existsSync(target)) {
            fsModule.mkdirSync(target, { recursive: true });
        }
        const files = fsModule.readdirSync(source);
        for (const file of files) {
            const srcPath = path.join(source, file);
            const destPath = path.join(target, file);
            if (fsModule.lstatSync(srcPath).isDirectory()) {
                copyFolderRecursiveSync(srcPath, destPath, fsModule);
            }
            else {
                fsModule.copyFileSync(srcPath, destPath);
            }
        }
    }
    catch (error) {
        (0, error_handlers_1.handleFileSystemError)(error);
    }
}
/**
 * Docker Composeファイルを生成する
 * @param config 設定情報
 * @returns 成功した場合はtrue
 */
function generateDockerComposeFiles(config) {
    try {
        const devcontainerPath = path.join(os.tmpdir(), '.devcontainer');
        if (!fs.existsSync(devcontainerPath)) {
            fs.mkdirSync(devcontainerPath, { recursive: true });
        }
        const dockerComposePath = path.join(devcontainerPath, 'docker-compose.yml');
        const dockerComposeContent = `version: '3'
services:
  workspace:
    image: ${exports.CONFIG.DOCKER_IMAGE}
    volumes:
      - "${config.projectFolder}:/workspace"
      - "${config.cacheFolder}:/cache"
    environment:
      - GITHUB_TOKEN=${config.githubPat}
    command: sleep infinity`;
        fs.writeFileSync(dockerComposePath, dockerComposeContent);
        return true;
    }
    catch (error) {
        (0, error_handlers_1.handleFileSystemError)(error);
        vscode.window.showErrorMessage(`[work-env] Docker Composeファイルの生成に失敗しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false;
    }
}
/**
 * 開発環境を起動する
 */
async function startWorkEnv() {
    try {
        // 事前チェック
        if (!await preflightChecks()) {
            return;
        }
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        const storageUri = { fsPath: path.join(os.tmpdir(), 'work-env') };
        // DockerイメージのPull
        if (!await pullDockerImage(exports.CONFIG.DOCKER_IMAGE)) {
            return;
        }
        const devcontainerPath = path.join(storageUri.fsPath, ".devcontainer");
        const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");
        // .devcontainer の設定
        if (!fs.existsSync(devcontainerPath)) {
            vscode.window.showInformationMessage("[work-env] .devcontainerを設定中...");
            setupDevContainer({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] }, devcontainerPath);
        }
        // 設定情報を収集してDocker Composeファイルを生成
        if (!fs.existsSync(dockercomposeFilePath)) {
            const success = await generateDockerCompose({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] }, dockercomposeFilePath);
            if (!success) {
                return;
            }
        }
        // remote-containers.openFolder コマンドで開く
        openFolderInContainer(storageUri.fsPath);
    }
    catch (error) {
        const errorMessage = (0, error_handlers_1.parseErrorMessage)(error);
        if ((0, error_handlers_1.isDockerError)(error)) {
            (0, error_handlers_1.handleDockerError)(error);
        }
        else {
            vscode.window.showErrorMessage(`[work-env] エラー: ${errorMessage}`);
        }
    }
}
/**
 * Dockerコマンドを実行する
 * @param command 実行するコマンド
 * @returns 成功した場合はコマンドの出力、失敗した場合はnull
 */
async function executeDockerCommand(command) {
    try {
        const { stdout } = await execPromise(command);
        return stdout;
    }
    catch (error) {
        if ((0, error_handlers_1.isDockerError)(error)) {
            (0, error_handlers_1.handleDockerError)(error);
        }
        else {
            vscode.window.showErrorMessage(`[work-env] コマンド実行エラー: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        }
        return null;
    }
}
/**
 * 設定をリセットする
 */
async function resetWorkEnvConfig() {
    try {
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.work-env')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'work-env-extension') };
        const storageUri = { fsPath: path.join(os.tmpdir(), 'work-env') };
        const devcontainerPath = path.join(storageUri.fsPath, ".devcontainer");
        const dockercomposeFilePath = path.join(devcontainerPath, "docker-compose.yml");
        // 設定情報を収集してDocker Composeファイルを上書き
        const success = await generateDockerCompose({ extensionUri: context, globalStorageUri: storageUri, subscriptions: [] }, dockercomposeFilePath);
        if (!success) {
            return;
        }
        // コンテナの削除
        await removeExistingContainers(exports.CONFIG.CONTAINER_NAME_FILTERS);
        vscode.window.showInformationMessage("[work-env] 設定をリセットしました。");
    }
    catch (error) {
        vscode.window.showErrorMessage(`[work-env] 設定のリセットに失敗しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
    }
}
// Dockerがインストールされていない場合のプロンプト表示
async function showDockerInstallPrompt() {
    const message = 'Dockerがインストールされていません。自動的にインストールしますか？';
    const installButton = 'インストールする';
    const cancelButton = 'キャンセル';
    const selection = await vscode.window.showInformationMessage(message, { modal: true }, installButton, cancelButton);
    return selection === installButton;
}
// Dockerインストールの実行
async function installDockerWithProgress() {
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
    }
    else {
        if (result.details) {
            vscode.window.showErrorMessage(`[work-env] ${result.message}: ${result.details}`);
        }
        else {
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
async function validateSettings() {
    try {
        const config = await collectDockerComposeConfig();
        return config !== null;
    }
    catch (error) {
        vscode.window.showErrorMessage(`[work-env] 設定のバリデーションに失敗しました: ${(0, error_handlers_1.parseErrorMessage)(error)}`);
        return false;
    }
}
// E2Eテスト用のエクスポート
// 統合テストで使用する関数をここでエクスポート
exports.forTesting = {
    validateSettings,
    collectDockerComposeConfig,
    isDockerInstalled,
    isRemoteContainersInstalled,
    preflightChecks
};
//# sourceMappingURL=extension.js.map