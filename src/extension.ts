import * as vscode from 'vscode';
// chmod は node:fs から直接インポートできないため、fs.chmodSync を使用する想定。一旦コメントアウト
// import { chmod } from 'node:fs'; 
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    parseErrorMessage, isDockerError, handleDockerError,
    handleFileSystemError
} from './error-handlers';
import { TemplateProcessor } from './template-processor';
import { 
    showDockerNotInstalledError, 
    showDockerPermissionError,
    inputGitHubPAT,
    selectParentDirectory,
    validateInputForInputBox // ui-helpersから新しい名前でインポート
} from './ui-helpers';
import {
    ensureDirectory,
    validateParentDirectory as fsValidateParentDirectory,
    setupFolderPermissions as fsSetupFolderPermissions,
    copyFolderRecursiveSync
} from './fs-helpers';
import {
    DOCKER_CONFIG,
    preflightChecks as dockerPreflightChecks,
    pullDockerImage as dockerPullImage,
    removeExistingContainers as dockerRemoveContainers,
    isDockerInstalled as dockerIsInstalled,
    checkDockerPermissions as dockerCheckPermissions,
    openFolderInContainer as dockerOpenInContainer,
    executeDockerCommand as dockerExecuteCommand,
    disposeOutputChannel
} from './docker-helpers';

const execPromise = promisify(exec);

// Settingsオブジェクトの型定義
interface ExtensionSettings {
    containerImage?: string;
    parentDirPath?: string;
}

/**
 * エクステンションアクティベーション時の処理
 * @param context VS Codeのエクステンションコンテキスト
 */
export function activate(context: vscode.ExtensionContext) {
    let startLauncherCommand = vscode.commands.registerCommand('bioinfo-launcher.start-launcher', async () => {
        try {
            const settingfilePath = await preparation(context);
            // settings.jsonの読み込み
            if (!settingfilePath) {
                return;
            }
            const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
            const dockerImageToUse = settings.containerImage || DOCKER_CONFIG.DOCKER_IMAGE;

            let containerDirPath: string | undefined;

            // 親ディレクトリのパスが設定されていない、または無効な場合は新たに選択
            if (!settings.parentDirPath || !await fsValidateParentDirectory(settings.parentDirPath)) {
                // inputGitHubPAT内でvalidateInputForInputBoxが使われる
                containerDirPath = await setup(context, settings, settingfilePath, dockerImageToUse);
                if (!containerDirPath) {
                    return;
                }
           }else {
                const parentDirUri = vscode.Uri.file(settings.parentDirPath);
                const parentDirPath = parentDirUri.fsPath;
                containerDirPath = path.join(parentDirPath, "container");
                
                // 二回目以降の実行時もテンプレートを更新（GitHub PATは保持）
                const containerDevcontainerPath = path.join(containerDirPath, ".devcontainer");
                const dockerComposeFilePath = path.join(containerDevcontainerPath, "docker-compose.yml");
                
                // 既存のGitHub PATを抽出
                const existingPAT = extractGitHubPATFromDockerCompose(dockerComposeFilePath);
                
                // .devcontainer設定を最新テンプレートで更新
                const cacheDirPath = path.join(parentDirPath, "cache");
                const projectsDirPath = path.join(containerDirPath, "projects");
                await setupDevContainer(context, containerDevcontainerPath, cacheDirPath, projectsDirPath);
                
                // GitHub PATを保持しながらdocker-compose.ymlを再生成
                if (existingPAT) {
                    await generateDockerCompose(
                        context,
                        dockerComposeFilePath,
                        {
                            projectFolder: projectsDirPath,
                            cacheFolder: cacheDirPath,
                            githubPat: existingPAT,
                            dockerImage: dockerImageToUse
                        }
                    );
                    console.log('[bioinfo-launcher] 既存のGitHub PATを保持しながら設定を更新しました');
                }
            }
            
           // コンテナディレクトリをVSCodeで開く
            await dockerOpenInContainer(containerDirPath);
            
            // イメージ更新によるリビルドが行われた場合の通知
            const imageUpdated = context.globalState.get('imageUpdated', false);
            if (imageUpdated) {
                context.globalState.update('imageUpdated', false); // フラグをリセット
                vscode.window.showInformationMessage('[bioinfo-launcher] 新しいDockerイメージでコンテナが作成されます。初回起動時はビルドに時間がかかる場合があります。');
            }
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
            }
        }
    });
    
    let resetConfigCommand = vscode.commands.registerCommand('bioinfo-launcher.reset-config', async () => {
        try {
            const settingfilePath = await preparation(context);
            // settings.jsonの読み込み
            if (!settingfilePath) {
                return;
            }
            const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
            const dockerImageToUse = settings.containerImage || DOCKER_CONFIG.DOCKER_IMAGE;
            
            let containerDirPath: string | undefined;

            // 親ディレクトリのパスが設定されていない、または無効な場合は新たに選択
            // inputGitHubPAT内でvalidateInputForInputBoxが使われる
            containerDirPath = await setup(context, settings, settingfilePath, dockerImageToUse);
            if (!containerDirPath) {
                return;
            }
            
            // コンテナの削除
            await dockerRemoveContainers(DOCKER_CONFIG.CONTAINER_NAME_FILTERS);

            // コンテナディレクトリをVSCodeで開く
            await dockerOpenInContainer(containerDirPath);
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            if (isDockerError(error)) {
                handleDockerError(error);
            } else {
                vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
            }
        }
    });

    let configContainerCommand = vscode.commands.registerCommand('bioinfo-launcher.config-container', async () => {
        try {
            const extensionStoragePath = context.globalStorageUri.fsPath;
            const settingfilePath = path.join(extensionStoragePath, "settings.json");
            
            // settings.jsonの存在確認
            if (!fs.existsSync(settingfilePath)) {
                fs.mkdirSync(extensionStoragePath, { recursive: true });
                fs.writeFileSync(settingfilePath, JSON.stringify({ containerImage: DOCKER_CONFIG.DOCKER_IMAGE }));
            }
            
            // 現在の設定を読み込む
            const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
            
            // 利用可能なイメージのリストを表示
            const selectedImage = await vscode.window.showQuickPick(
                DOCKER_CONFIG.AVAILABLE_IMAGES.map(img => ({
                    label: img.label,
                    description: img.value,
                    value: img.value
                })),
                {
                    placeHolder: '使用するコンテナイメージを選択してください',
                    title: 'BioInfoLauncher - コンテナイメージ設定'
                }
            );
            
            if (selectedImage) {
                // 選択されたイメージを設定に保存
                settings.containerImage = selectedImage.value;
                fs.writeFileSync(settingfilePath, JSON.stringify(settings, null, 2));
                
                vscode.window.showInformationMessage(`[bioinfo-launcher] コンテナイメージを "${selectedImage.label}" (${selectedImage.value}) に設定しました`);
                
                // 親ディレクトリが設定されている場合は、既存のdocker-compose.ymlを更新
                if (settings.parentDirPath && fs.existsSync(settings.parentDirPath)) {
                    const containerDirPath = path.join(settings.parentDirPath, "container");
                    const devcontainerDirPath = path.join(containerDirPath, ".devcontainer");
                    const dockerComposeFilePath = path.join(devcontainerDirPath, "docker-compose.yml");
                    
                    if (fs.existsSync(dockerComposeFilePath)) {
                        try {
                            // 既存のdocker-compose.ymlを読み込む
                            let dockerComposeContent = fs.readFileSync(dockerComposeFilePath, 'utf8');
                            
                            // 現在のGITHUB_PATの値を取得
                            const githubPatRegex = /GITHUB_PAT=([^\s\r\n"']+)/;
                            const githubPatLine = dockerComposeContent.split('\n').find(line => line.includes('GITHUB_PAT='));
                            let githubPat = 'YOUR_GITHUB_PAT';

                            if (githubPatLine) {
                                const match = githubPatLine.match(githubPatRegex);
                                if (match && match[1]) {
                                    githubPat = match[1];
                                }
                                console.log(`GITHUB_PAT行: "${githubPatLine}", 抽出した値: "${githubPat}"`);
                            } else {
                                console.log('GITHUB_PAT行が見つかりませんでした');
                            }
                            
                            // テンプレートプロセッサを使用してdocker-compose.ymlを更新
                            const templateProcessor = new TemplateProcessor();
                            const templatePath = path.join(context.extensionUri.fsPath, 'resources', 'templates', 'container_template', '.devcontainer_template', 'docker-compose.yml.template');
                            
                            if (fs.existsSync(templatePath)) {
                                const templateContent = fs.readFileSync(templatePath, 'utf8');
                                const updatedContent = templateProcessor.replaceVariables(templateContent, {
                                    DOCKER_IMAGE: selectedImage.value,
                                    GITHUB_PAT: githubPat
                                });
                                
                                fs.writeFileSync(dockerComposeFilePath, updatedContent, 'utf8');
                                vscode.window.showInformationMessage(`[bioinfo-launcher] docker-compose.ymlを更新しました`);

                                // 既存コンテナの確認と再作成の提案
                                const decision = await vscode.window.showInformationMessage(
                                    'コンテナイメージが変更されました。既存のコンテナを削除し、次回起動時に新しいイメージで再作成しますか？',
                                    { modal: true }, 
                                    'はい', 'いいえ'
                                );

                                if (decision === 'はい') {
                                    await dockerRemoveContainers(DOCKER_CONFIG.CONTAINER_NAME_FILTERS);
                                    vscode.window.showInformationMessage('[bioinfo-launcher] 既存のコンテナを削除しました。次回 start-launcher 実行時に新しいイメージでコンテナが作成されます。');
                                } else {
                                    vscode.window.showInformationMessage('[bioinfo-launcher] イメージ設定は更新されました。既存のコンテナはそのままです。次回 start-launcher 実行時にVSCodeが再ビルドを提案する場合があります。');
                                }
                            } else {
                                vscode.window.showWarningMessage(`[bioinfo-launcher] テンプレートファイルが見つかりません: ${templatePath}`);
                            }
                        } catch (err) {
                            vscode.window.showWarningMessage(`[bioinfo-launcher] docker-compose.ymlの更新に失敗しました: ${parseErrorMessage(err)}`);
                        }
                    }
                }
            }
        } catch (error) {
            const errorMessage = parseErrorMessage(error);
            vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
        }
    });

    context.subscriptions.push(startLauncherCommand);
    context.subscriptions.push(resetConfigCommand);
    context.subscriptions.push(configContainerCommand);
}

/**
 * Dockerイメージの更新を確認する
 * @param imageName イメージ名
 * @returns 更新情報 { updated: boolean, localHash?: string, newHash?: string }
 */
export async function checkDockerImageUpdate(imageName: string): Promise<{updated: boolean, localHash?: string, newHash?: string}> {
    try {
        // ローカルイメージのハッシュを取得
        let localHash: string | undefined;
        try {
            const { stdout: localOutput } = await execPromise(`docker images --format "{{.ID}}" ${imageName}`);
            localHash = localOutput.trim();
        } catch (error) {
            // ローカルイメージが存在しない場合
            localHash = undefined;
        }

        // リモートイメージをpull（docker-helpers.tsの進捗付きpull関数を使用）
        let pullSuccess = false;
        try {
            pullSuccess = await dockerPullImage(imageName);
        } catch (pullError) {
            // pullエラーの詳細をログに記録
            console.error(`[ERROR] Docker pull failed for ${imageName}:`, pullError);
            throw new Error(`イメージのpullに失敗しました: ${parseErrorMessage(pullError)}`);
        }
        
        if (!pullSuccess) {
            throw new Error('イメージのpullに失敗しました');
        }

        // pull後のローカルイメージのハッシュを取得
        let newHash: string;
        try {
            const { stdout: newOutput } = await execPromise(`docker images --format "{{.ID}}" ${imageName}`);
            newHash = newOutput.trim();
            if (!newHash) {
                throw new Error('イメージハッシュの取得に失敗しました');
            }
        } catch (error) {
            throw new Error(`pull後のイメージハッシュ取得に失敗: ${parseErrorMessage(error)}`);
        }

        // ハッシュを比較
        const updated = !localHash || localHash !== newHash;
        
        console.log(`[DEBUG] イメージ更新確認: ${imageName}`);
        console.log(`[DEBUG] 古いハッシュ: ${localHash || 'なし'}`);
        console.log(`[DEBUG] 新しいハッシュ: ${newHash}`);
        console.log(`[DEBUG] 更新あり: ${updated}`);

        return {
            updated,
            localHash,
            newHash
        };
    } catch (error) {
        // エラーがすでにErrorオブジェクトの場合はそのままスロー
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`イメージ更新確認に失敗しました: ${parseErrorMessage(error)}`);
    }
}

/**
 * イメージ更新時のコンテナリビルド確認
 * @param imageName イメージ名
 * @returns ユーザーがリビルドを選択した場合はtrue
 */
export async function confirmContainerRebuild(imageName: string): Promise<boolean> {
    const decision = await vscode.window.showInformationMessage(
        `Dockerイメージ "${imageName}" が更新されました。既存のコンテナを削除して新しいイメージでリビルドしますか？`,
        { modal: true },
        {
            title: 'リビルドする',
            action: 'rebuild'
        },
        {
            title: '後で決める',
            action: 'later'
        }
    );

    return decision?.action === 'rebuild';
}

/**
 * 事前準備を行う
 * @returns 成功した場合はsettings.jsonのパス、失敗した場合はundefined
 */
export async function preparation(context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        // 事前チェック
        if (!await dockerPreflightChecks()) {
            return;
        }
        
        const extensionStoragePath = context.globalStorageUri.fsPath;
        const settingfilePath = path.join(extensionStoragePath, "settings.json");
        // settings.jsonの存在確認
        if (!fs.existsSync(settingfilePath)) {
            // settings.jsonが存在しない場合は作成
            fs.mkdirSync(extensionStoragePath, { recursive: true });
            fs.writeFileSync(settingfilePath, JSON.stringify({ containerImage: DOCKER_CONFIG.DOCKER_IMAGE }));
        } else {
            // settings.jsonが存在する場合は、コンテナイメージ設定を読み込む
            const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
            // containerImageが設定されていない場合はデフォルト値を設定
            if (!settings.containerImage) {
                settings.containerImage = DOCKER_CONFIG.DOCKER_IMAGE;
                fs.writeFileSync(settingfilePath, JSON.stringify(settings, null, 2));
            }
        }
        
        // DockerイメージのPullと更新確認
        const settings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
        const dockerImage = settings.containerImage || DOCKER_CONFIG.DOCKER_IMAGE;
        
        // イメージ更新確認
        const updateInfo = await checkDockerImageUpdate(dockerImage);
        
        if (updateInfo.updated) {
            if (updateInfo.localHash) {
                vscode.window.showInformationMessage(`[bioinfo-launcher] Dockerイメージが更新されました（${dockerImage}）\n旧バージョン: ${updateInfo.localHash.substring(0, 12)}\n新バージョン: ${updateInfo.newHash?.substring(0, 12)}`);
            } else {
                vscode.window.showInformationMessage(`[bioinfo-launcher] 新しいDockerイメージをダウンロードしました（${dockerImage}）`);
            }
            
            // 既存のコンテナディレクトリが存在する場合のみリビルド確認
            if (settings.parentDirPath && await fsValidateParentDirectory(settings.parentDirPath)) {
                const shouldRebuild = await confirmContainerRebuild(dockerImage);
                
                if (shouldRebuild) {
                    // 既存コンテナを削除
                    await dockerRemoveContainers(DOCKER_CONFIG.CONTAINER_NAME_FILTERS);
                    vscode.window.showInformationMessage('[bioinfo-launcher] 既存のコンテナを削除しました。新しいイメージでコンテナが再作成されます。');
                    
                    // 更新情報をグローバルstateに保存（後でsetup完了時に通知に使用）
                    context.globalState.update('imageUpdated', true);
                } else {
                    vscode.window.showInformationMessage('[bioinfo-launcher] イメージは更新されましたが、既存のコンテナはそのままです。次回VSCodeでコンテナを開いたときに、リビルドを提案される場合があります。');
                }
            } else {
                // 新規セットアップの場合
                context.globalState.update('imageUpdated', true);
            }
        } else {
            vscode.window.showInformationMessage(`[bioinfo-launcher] Dockerイメージは最新です（${dockerImage}）`);
        }

        return settingfilePath;
    } catch (error) {
        const errorMessage = parseErrorMessage(error);
        vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
        return undefined;
    }
}

// This method is called when your extension is deactivated
export function deactivate() {
    // 出力チャンネルをクリーンアップ
    disposeOutputChannel();
}

/**
 * リソースファイルのURIを取得する
 * @param context VS Codeのエクステンションコンテキスト 
 * @param relativePath リソースフォルダからの相対パス
 * @returns リソースファイルのURI
 */
export function getResourceUri(context: vscode.ExtensionContext, relativePath: string): vscode.Uri {
    return vscode.Uri.joinPath(context.extensionUri, 'resources', relativePath);
}

// 全てのセットアップを行う関数
export async function setup(context: vscode.ExtensionContext, settings: ExtensionSettings ,settingfilePath: string, dockerImageFromSettings?: string): Promise<string|undefined> {
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
        
        // ディレクトリ構造の作成
        vscode.window.showInformationMessage("[bioinfo-launcher] 開発環境を設定中...");
        
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
                githubPat,
                dockerImage: dockerImageFromSettings || DOCKER_CONFIG.DOCKER_IMAGE
            }
        );
        
        // プロジェクトテンプレートの展開
        await setupProjectTemplate(context, projectsDirPath);

        // 親ディレクトリのパスをsettingsに保存
        if (settings.parentDirPath !== parentDirPath) {
            settings.parentDirPath = parentDirPath;
            fs.writeFileSync(settingfilePath, JSON.stringify(settings, null, 2));
            vscode.window.showInformationMessage("[bioinfo-launcher] 親ディレクトリのパスを設定に保存しました");
        }
        
        // イメージ更新による新規セットアップの場合の通知
        const imageUpdated = context.globalState.get('imageUpdated', false);
        if (imageUpdated) {
            vscode.window.showInformationMessage('[bioinfo-launcher] セットアップが完了しました。新しいDockerイメージが使用されます。');
        }
        
        return containerDirPath;
    } catch (error) {
        const errorMessage = parseErrorMessage(error);
        vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
        return undefined;
    }
}

// .devcontainerフォルダをセットアップする関数
export async function setupDevContainer(context: vscode.ExtensionContext, targetPath: string, cacheDirPath: string, projectsDirPath: string) {
    try {
        // TemplateProcessorのインスタンスを作成
        const templateProcessor = new TemplateProcessor();
        
        // .devcontainerディレクトリが存在しない場合は作成
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true ,  mode: 0o777 });
        }
        
        // 既存の.devcontainerディレクトリがある場合は、エクステンション更新を反映するため
        // 設定ファイルを常に最新のテンプレートで上書きする
        const isUpdate = fs.existsSync(path.join(targetPath, 'devcontainer.json'));
        
        // テンプレートディレクトリのパスを取得
        const devcontainerTemplateUri = getResourceUri(context, 'templates/container_template/.devcontainer_template');
        
        // 変数定義（必要に応じて）
        const variables: Record<string, string> = {
            GITHUB_PAT: '', // 初期値は空、後で設定される
            PROJECT_FOLDER: projectsDirPath,
            CACHE_FOLDER: cacheDirPath
        };
        
        // テンプレートを展開（常に上書き）
        await templateProcessor.expandTemplateDirectory(
            devcontainerTemplateUri.fsPath,
            targetPath,
            variables
        );
        
        if (isUpdate) {
            vscode.window.showInformationMessage("[bioinfo-launcher] devcontainer設定を最新版に更新しました");
        } else {
            vscode.window.showInformationMessage("[bioinfo-launcher] devcontainer設定を作成しました");
        }
    } catch (error) {
        handleFileSystemError(error);
        vscode.window.showErrorMessage(`[bioinfo-launcher] devcontainer設定の作成中にエラーが発生しました: ${parseErrorMessage(error)}`);
        throw error; // 上位の関数でエラーハンドリングができるように再スロー
    }
}

// openFolderInContainer は docker-helpers.ts に移動

// 既存のdocker-compose.ymlからGitHub PATを抽出する関数
function extractGitHubPATFromDockerCompose(dockerComposeFilePath: string): string | null {
    try {
        if (!fs.existsSync(dockerComposeFilePath)) {
            return null;
        }
        
        const content = fs.readFileSync(dockerComposeFilePath, 'utf8');
        // GITHUB_PAT=値 の形式を探す
        const patMatch = content.match(/GITHUB_PAT=([^\s\n"']+)/);
        
        if (patMatch && patMatch[1]) {
            console.log(`[DEBUG] 既存のGITHUB_PATを検出: ${patMatch[1].substring(0, 4)}...`);
            return patMatch[1];
        }
        
        return null;
    } catch (error) {
        console.error('[ERROR] docker-compose.ymlの読み取りに失敗:', error);
        return null;
    }
}

// Docker Composeファイルを生成する関数
export async function generateDockerCompose(context: vscode.ExtensionContext, dockercomposeFilePath: string, config: {projectFolder: string, cacheFolder: string, githubPat: string, dockerImage?: string}): Promise<boolean> {
    try {
        // TemplateProcessorのインスタンスを作成
        const templateProcessor = new TemplateProcessor();
        
        // テンプレートディレクトリのパスを取得
        const devcontainerTemplateUri = getResourceUri(context, 'templates/container_template/.devcontainer_template');
        
        // ファイルアクセス権の設定
        if (!await fsSetupFolderPermissions(config.projectFolder, config.cacheFolder)) {
            return false;
        }
        
        const variables: Record<string, string> = {
            GITHUB_PAT: config.githubPat,
            DOCKER_IMAGE: config.dockerImage || DOCKER_CONFIG.DOCKER_IMAGE
        };
        
        console.log(`[DEBUG] generateDockerCompose: GITHUB_PAT=${config.githubPat}, DOCKER_IMAGE=${variables.DOCKER_IMAGE}`);
        
        // docker-compose.yml.templateを処理
        try {
            // devcontainerテンプレートを展開
            await templateProcessor.expandTemplateDirectory(
                devcontainerTemplateUri.fsPath,
                path.dirname(dockercomposeFilePath),
                variables
            );
            
            // 生成されたファイルの内容を確認
            if (fs.existsSync(dockercomposeFilePath)) {
                const generatedContent = fs.readFileSync(dockercomposeFilePath, 'utf8');
                console.log(`[DEBUG] 生成されたdocker-compose.ymlの内容:`);
                console.log(generatedContent);
                
                // GITHUB_PATの値が正しく設定されているか確認
                const patLine = generatedContent.split('\n').find(line => line.includes('GITHUB_PAT='));
                console.log(`[DEBUG] GITHUB_PAT行: ${patLine || 'not found'}`);
            } else {
                console.log(`[DEBUG] docker-compose.ymlファイルが生成されませんでした: ${dockercomposeFilePath}`);
            }
            
            vscode.window.showInformationMessage("[bioinfo-launcher] Docker Compose設定を生成しました");
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`[bioinfo-launcher] テンプレート展開に失敗しました: ${parseErrorMessage(err)}`);
            return false;
        }
    } catch (error) {
        vscode.window.showErrorMessage(`[bioinfo-launcher] Docker Compose設定の生成中にエラーが発生しました: ${parseErrorMessage(error)}`);
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
            fs.mkdirSync(projectFolder, { recursive: true ,  mode: 0o777 });
        }
        
        // プロジェクトディレクトリが既に存在し、ファイルが含まれている場合は
        // ユーザーデータを保護するためテンプレート展開をスキップ
        const projectFiles = fs.readdirSync(projectFolder);
        if (projectFiles.length > 0) {
            console.log("[bioinfo-launcher] プロジェクトディレクトリに既存ファイルがあるため、テンプレート展開をスキップします");
            return true;
        }
        
        // 変数定義（必要に応じて）
        const variables: Record<string, string> = {};
        
        // テンプレートを展開（初回のみ）
        await templateProcessor.expandTemplateDirectory(
            projectsTemplateUri.fsPath,
            projectFolder,
            variables
        );
        
        vscode.window.showInformationMessage("[bioinfo-launcher] プロジェクトテンプレートを展開しました");
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`[bioinfo-launcher] プロジェクトテンプレートの展開中にエラーが発生しました: ${parseErrorMessage(error)}`);
        return false;
    }
}

// setupFolderPermissions は fs-helpers.ts に移動
// copyFolderRecursiveSync は fs-helpers.ts に移動

/**
 * Docker Composeファイルを生成する
 * @param config 設定情報
 * @returns 成功した場合はtrue
 */
export function generateDockerComposeFiles(config: {projectFolder: string, cacheFolder: string, githubPat: string}): boolean {
    try {
        const devcontainerPath = path.join(os.tmpdir(), '.devcontainer');
        if (!fs.existsSync(devcontainerPath)) {
            fs.mkdirSync(devcontainerPath, { recursive: true ,  mode: 0o777 });
        }
        
        const dockerComposePath = path.join(devcontainerPath, 'docker-compose.yml');
        const dockerComposeContent = `version: '3'
services:
  workspace:
    image: ${DOCKER_CONFIG.DOCKER_IMAGE}
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
        vscode.window.showErrorMessage(`[bioinfo-launcher] Docker Composeファイルの生成に失敗しました: ${parseErrorMessage(error)}`);
        return false;
    }
}

/**
 * 開発環境を起動する
 */
export async function startLauncher(): Promise<void> {
    try {
        // 事前チェック
        if (!await dockerPreflightChecks()) {
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
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.bioinfo-launcher')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'bioinfo-launcher-extension') };
        
        // 設定の読み込み
        const extensionStoragePath = path.join(os.homedir(), '.vscode', 'globalStorage', 'hu-bioinfo-workshop.bioinfo-launcher');
        const settingfilePath = path.join(extensionStoragePath, "settings.json");
        let dockerImage = DOCKER_CONFIG.DOCKER_IMAGE;
        
        if (fs.existsSync(settingfilePath)) {
            try {
                const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
                if (settings.containerImage) {
                    dockerImage = settings.containerImage;
                }
            } catch (err) {
                // 設定の読み込みに失敗した場合はデフォルト値を使用
                console.error('設定の読み込みに失敗しました:', err);
            }
        }
        
        // DockerイメージのPull
        if (!await dockerPullImage(dockerImage)) {
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
                githubPat,
                dockerImage // 選択されたイメージを使用
            }
        );
        
        // プロジェクトテンプレートの展開
        await setupProjectTemplate({ extensionUri: context } as any, projectsDirPath);
        
        // コンテナディレクトリをVSCodeで開く
        dockerOpenInContainer(containerDirPath);
    } catch (error) {
        const errorMessage = parseErrorMessage(error);
        if (isDockerError(error)) {
            handleDockerError(error);
        } else {
            vscode.window.showErrorMessage(`[bioinfo-launcher] エラー: ${errorMessage}`);
        }
    }
}

// executeDockerCommand は docker-helpers.ts に移動

/**
 * 設定をリセットする
 */
export async function resetLauncherConfig(): Promise<void> {
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
            vscode.window.showInformationMessage("まず 'Start bioinfo-launcher' を実行してください");
            return;
        }
        
        // テスト用コンテキスト
        const context = vscode.extensions.getExtension('hu-bioinfo-workshop.bioinfo-launcher')?.extensionUri || { fsPath: path.join(os.tmpdir(), 'bioinfo-launcher-extension') };
        
        // 設定の読み込み
        const extensionStoragePath = path.join(os.homedir(), '.vscode', 'globalStorage', 'hu-bioinfo-workshop.bioinfo-launcher');
        const settingfilePath = path.join(extensionStoragePath, "settings.json");
        let dockerImage = DOCKER_CONFIG.DOCKER_IMAGE; // デフォルト値
        
        if (fs.existsSync(settingfilePath)) {
            try {
                const settings: ExtensionSettings = JSON.parse(fs.readFileSync(settingfilePath, 'utf8'));
                if (settings.containerImage) {
                    dockerImage = settings.containerImage;
                    console.log(`[DEBUG] resetLauncherConfig: settings.jsonから読み込んだdockerImage=${dockerImage}`);
                }
            } catch (err) {
                console.error('設定の読み込みに失敗しました:', err);
            }
        } else {
            console.log(`[DEBUG] resetLauncherConfig: settings.jsonが存在しません: ${settingfilePath}`);
        }
        
        // DockerイメージのPull
        if (!await dockerPullImage(dockerImage)) {
            return;
        }
        
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
                githubPat,
                dockerImage // 選択されたイメージを渡す
            }
        );
        
        // コンテナの削除
        await dockerRemoveContainers(DOCKER_CONFIG.CONTAINER_NAME_FILTERS);
        
        // コンテナディレクトリをVSCodeで開く
        dockerOpenInContainer(containerDirPath);
        
        vscode.window.showInformationMessage("[bioinfo-launcher] 設定をリセットしました。");
    } catch (error) {
        vscode.window.showErrorMessage(`[bioinfo-launcher] 設定のリセットに失敗しました: ${parseErrorMessage(error)}`);
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
    vscode.window.showErrorMessage(`[bioinfo-launcher] 設定のバリデーションに失敗しました: ${parseErrorMessage(error)}`);
    return false;
  }
}

// E2Eテスト用のエクスポート
// 統合テストで使用する関数をここでエクスポート
export const forTesting = {
  validateSettings,
  isDockerInstalled: dockerIsInstalled,
  preflightChecks: dockerPreflightChecks
};

// テスト用にエクスポートする関数
export const EXPORTED_FUNCTIONS = {
    parseErrorMessage,
    isDockerInstalled: dockerIsInstalled,
    pullDockerImage: dockerPullImage,
    openFolderInContainer: dockerOpenInContainer,
    setupDevContainer,
    generateDockerCompose,
    setupFolderPermissions: fsSetupFolderPermissions,
    removeExistingContainers: dockerRemoveContainers,
    setupProjectTemplate,
    startLauncher,
    resetLauncherConfig,
    checkDockerPermissions: dockerCheckPermissions,
    preflightChecks: dockerPreflightChecks,
    checkDockerImageUpdate,
    confirmContainerRebuild
};

// commonjs用にエクスポート
module.exports = {
    activate,
    deactivate,
    preparation,
    setup,
    startLauncher,
    resetLauncherConfig,
    setupDevContainer,
    generateDockerCompose,
    openFolderInContainer: dockerOpenInContainer,
    setupFolderPermissions: fsSetupFolderPermissions,
    isDockerInstalled: dockerIsInstalled,
    checkDockerPermissions: dockerCheckPermissions,
    preflightChecks: dockerPreflightChecks,
    checkDockerImageUpdate,
    confirmContainerRebuild
};