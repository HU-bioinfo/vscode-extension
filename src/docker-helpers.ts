import * as vscode from 'vscode';
import { exec } from 'child_process';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { handleDockerError, isDockerError, parseErrorMessage } from './error-handlers';
import { showDockerNotInstalledError, showDockerPermissionError } from './ui-helpers';

const execPromise = promisify(exec);

// 設定関連の定数
export const DOCKER_CONFIG = {
  DOCKER_IMAGE: 'hubioinfows/lite_env:latest',
  CONTAINER_NAME_FILTERS: ['bioinfo-launcher'],
  AVAILABLE_IMAGES: [
    { label: 'Light Environment (Recommended)', value: 'hubioinfows/lite_env:latest' },
    { label: 'Full Environment', value: 'hubioinfows/full_env:latest' }
  ]
};

/**
 * 事前チェック（Docker、権限）
 * @returns 全てのチェックが通った場合はtrue
 */
export async function preflightChecks(): Promise<boolean> {
    // Dockerがインストールされているか確認
    if (!await isDockerInstalled()) {
        // Docker未インストールの場合、インストールを提案
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
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `[bioinfo-launcher] Dockerイメージ ${imageName} をダウンロード中...`,
            cancellable: false
        }, async (progress) => {
            // ダウンロード状態を追跡する変数
            let downloadedLayers = new Map<string, number>();
            let extractedLayers = new Map<string, number>();
            let totalLayers = 0;
            
            return new Promise<boolean>((resolve, reject) => {
                const dockerPull = spawn('docker', ['pull', imageName]);
                
                dockerPull.stdout.on('data', (data) => {
                    // 出力をパースして進捗を更新
                    const output = data.toString();
                    const lines = output.split('\n');
                    
                    for (const line of lines) {
                        if (!line.trim()) {
                            continue;
                        }
                        
                        try {
                            // JSON形式のステータス行を処理
                            if (line.includes('{') && line.includes('}')) {
                                const jsonStart = line.indexOf('{');
                                const jsonEnd = line.lastIndexOf('}') + 1;
                                const jsonStr = line.substring(jsonStart, jsonEnd);
                                const status = JSON.parse(jsonStr);
                                
                                if (status.id && status.status) {
                                    if (status.status.includes('Pulling fs layer')) {
                                        totalLayers++;
                                    } else if (status.status.includes('Downloading')) {
                                        if (status.progressDetail && status.progressDetail.current && status.progressDetail.total) {
                                            downloadedLayers.set(status.id, (status.progressDetail.current / status.progressDetail.total) * 100);
                                        }
                                    } else if (status.status.includes('Download complete')) {
                                        downloadedLayers.set(status.id, 100);
                                    } else if (status.status.includes('Extracting')) {
                                        if (status.progressDetail && status.progressDetail.current && status.progressDetail.total) {
                                            extractedLayers.set(status.id, (status.progressDetail.current / status.progressDetail.total) * 100);
                                        }
                                    } else if (status.status.includes('Pull complete')) {
                                        extractedLayers.set(status.id, 100);
                                    }
                                }
                                
                                // 全体の進捗を計算
                                if (totalLayers > 0) {
                                    const downloadProgress = Array.from(downloadedLayers.values()).reduce((sum, val) => sum + val, 0) / (totalLayers * 100);
                                    const extractProgress = Array.from(extractedLayers.values()).reduce((sum, val) => sum + val, 0) / (totalLayers * 100);
                                    
                                    // ダウンロードとの抽出の進捗を50%ずつの重みで計算
                                    const totalProgress = (downloadProgress * 0.5 + extractProgress * 0.5) * 100;
                                    
                                    progress.report({ 
                                        message: `ダウンロード中... ${Math.round(totalProgress)}%`,
                                        increment: undefined 
                                    });
                                }
                            } else {
                                // 非JSON形式の出力を処理
                                progress.report({ message: line.trim() });
                            }
                        } catch (err) {
                            // JSONパースエラー - 通常の出力行として処理
                            progress.report({ message: line.trim() });
                        }
                    }
                });
                
                dockerPull.stderr.on('data', (data) => {
                    progress.report({ message: `エラー: ${data.toString().trim()}` });
                });
                
                dockerPull.on('close', (code) => {
                    if (code === 0) {
                        vscode.window.showInformationMessage(`[bioinfo-launcher] Dockerイメージ ${imageName} のダウンロードが完了しました`);
                        resolve(true);
                    } else {
                        reject(new Error(`docker pull コマンドは終了コード ${code} で失敗しました`));
                    }
                });
                
                dockerPull.on('error', (err) => {
                    reject(err);
                });
            });
        });
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

/**
 * Dockerがインストールされているかを確認する関数
 * @returns インストールされている場合はtrue
 */
export async function isDockerInstalled(): Promise<boolean> {
    try {
        await execPromise('docker --version');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Dockerの権限を確認する関数
 * @returns 権限がある場合はtrue
 */
export async function checkDockerPermissions(): Promise<boolean> {
    try {
        await execPromise('docker info');
        return true;
    } catch (error) {
        // エラーメッセージに権限関連の文字列が含まれているか確認
        const errorMessage = error ? (error instanceof Error ? error.toString() : String(error)).toLowerCase() : '';
        if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('access')) {
            return false;
        }
        // 他のエラーの場合はDockerの問題ではない可能性があるため、インストールされていない扱いにする
        return false;
    }
}

/**
 * コンテナでフォルダを開く関数
 * @param folderPath 開くフォルダのパス
 */
// 出力チャンネルをグローバルで管理
let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel("bioinfo-launcher");
    }
    return outputChannel;
}

export function disposeOutputChannel(): void {
    if (outputChannel) {
        outputChannel.dispose();
        outputChannel = undefined;
    }
}

export async function openFolderInContainer(folderPath: string): Promise<void> {
    try {
        // Dev Containersの正しいコマンドとパラメータ形式を使用
        // remote-containers.openFolderは第二引数にオプションオブジェクトを期待する
        await vscode.commands.executeCommand(
            "remote-containers.openFolder", 
            vscode.Uri.file(folderPath),
            {} // 空のオプションオブジェクトを渡す
        );
        
        vscode.window.showInformationMessage("[bioinfo-launcher] コンテナで開発環境を起動しました");
    } catch (error) {
        // エラーが発生した場合は、代替コマンドを試す
        try {
            // 現在のワークスペースがfolderPathと同じ場合は、reopenInContainerを使用
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders[0].uri.fsPath === folderPath) {
                await vscode.commands.executeCommand("remote-containers.reopenInContainer");
                vscode.window.showInformationMessage("[bioinfo-launcher] コンテナで開発環境を起動しました");
                return;
            }
            
            // 別の方法: forceNewWindowオプションを使用
            await vscode.commands.executeCommand(
                "remote-containers.openFolder",
                vscode.Uri.file(folderPath),
                { forceNewWindow: false }
            );
            
            vscode.window.showInformationMessage("[bioinfo-launcher] コンテナで開発環境を起動しました");
        } catch (secondError) {
            vscode.window.showErrorMessage(`[bioinfo-launcher] コンテナでフォルダを開くことができませんでした: ${parseErrorMessage(error)}`);
            // デバッグ情報を出力チャンネルに表示
            const channel = getOutputChannel();
            channel.appendLine(`Error details: ${JSON.stringify(error)}`);
            channel.appendLine(`Second error details: ${JSON.stringify(secondError)}`);
            channel.show();
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
            vscode.window.showErrorMessage(`[bioinfo-launcher] コマンド実行エラー: ${parseErrorMessage(error)}`);
        }
        return null;
    }
} 