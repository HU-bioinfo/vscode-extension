// テスト環境でない場合のみ実際のVSCodeをインポート
let vscode: any;
if (process.env.NODE_ENV !== 'test') {
    vscode = require('vscode');
} else {
    // テスト環境では、モックを使用
    vscode = {
        window: {
            showInformationMessage: () => Promise.resolve(undefined),
            showErrorMessage: () => Promise.resolve(undefined),
            withProgress: (options: any, task: any) => task({ report: () => {} })
        },
        env: {
            openExternal: () => Promise.resolve(undefined)
        },
        ProgressLocation: {
            Notification: 1
        },
        Uri: {
            parse: (uri: string) => ({ toString: () => uri })
        }
    };
}

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Progress型の定義
interface Progress {
    report: (value: { increment?: number; message?: string }) => void;
}

// テスト環境用のエクスポート (テスト時にモックと入れ替えるため)
export const _test = {
    setVSCodeMock: (mock: any) => {
        if (process.env.NODE_ENV === 'test') {
            vscode = mock;
        }
    }
};

const execPromise = promisify(exec);

/**
 * OSの種類と情報を表す型
 */
export interface OSInfo {
    platform: string;
    isWSL: boolean;
    distro?: LinuxDistroInfo;
}

/**
 * Linuxディストリビューション情報を表す型
 */
export interface LinuxDistroInfo {
    id: string;
    version: string;
}

/**
 * Docker操作の結果を表す型
 */
export interface DockerOperationResult {
    success: boolean;
    message: string;
    details?: string;
}

/**
 * システムのOS情報を検出する
 * @returns OSの種類とWSL環境かどうかの情報
 */
export function detectOS(): OSInfo {
    // テスト環境では環境変数からプラットフォームを取得
    const platform = process.env.TEST_OS_PLATFORM || os.platform();
    const release = process.env.TEST_OS_RELEASE || os.release();
    
    // WSL環境の検出
    const isWSL = platform === 'linux' && release.toLowerCase().includes('microsoft');
    
    return {
        platform,
        isWSL
    };
}

/**
 * Linuxディストリビューションの情報を検出する
 * @returns ディストリビューションIDとバージョン
 */
export async function detectLinuxDistro(): Promise<LinuxDistroInfo> {
    try {
        // lsb_releaseコマンドでディストリビューション情報を取得
        const { stdout: lsbOutput } = await execPromise('lsb_release -is');
        
        // OS-releaseファイルからより詳細な情報を取得
        const { stdout: osReleaseOutput } = await execPromise('cat /etc/os-release');
        
        let id = 'generic';
        let version = '';
        
        // OS-releaseの出力からID/VERSIONを抽出
        const idMatch = osReleaseOutput.match(/ID=([^\n]*)/);
        const versionMatch = osReleaseOutput.match(/VERSION_ID="?([^"\n]*)"?/);
        
        if (idMatch && idMatch[1]) {
            id = idMatch[1].toLowerCase().trim();
        } else if (lsbOutput) {
            id = lsbOutput.toLowerCase().trim();
        }
        
        if (versionMatch && versionMatch[1]) {
            version = versionMatch[1].trim();
        }
        
        return { id, version };
    } catch (error) {
        // コマンドが失敗した場合はgenericを返す
        return { id: 'generic', version: '' };
    }
}

/**
 * Dockerをインストールする
 * @param osInfo 検出されたOS情報
 * @returns インストール結果
 */
export async function installDocker(osInfo: OSInfo): Promise<DockerOperationResult> {
    // インストール確認ダイアログ
    const confirmResult = await vscode.window.showInformationMessage(
        'Dockerをインストールしますか？', 
        { modal: true },
        'はい', 'いいえ'
    );
    
    if (confirmResult !== 'はい') {
        return {
            success: false,
            message: 'インストールはキャンセルされました。'
        };
    }
    
    // Windows非WSL環境の場合は警告を表示
    if (osInfo.platform === 'win32' && !osInfo.isWSL) {
        const wslResult = await vscode.window.showInformationMessage(
            'Windowsの場合、WSL2で実行することを推奨します。WSL2のセットアップガイドを表示しますか？',
            'はい', 'いいえ'
        );
        
        if (wslResult === 'はい') {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/ja-jp/windows/wsl/install'));
        }
        
        return {
            success: false,
            message: 'WindowsネイティブでのDockerインストールはサポートされていません。WSL2を使用してください。'
        };
    }
    
    // プログレスバーを表示してインストール実行
    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Dockerをインストール中...',
            cancellable: false
        },
        async (progress) => {
            progress.report({ increment: 0, message: 'インストールを準備中...' });
            
            try {
                // OS別のインストールコマンド実行
                if (osInfo.platform === 'linux') {
                    return await installDockerOnLinux(osInfo, progress);
                } else if (osInfo.platform === 'darwin') {
                    return await installDockerOnMac(progress);
                } else if (osInfo.platform === 'win32' && osInfo.isWSL) {
                    return await installDockerOnWSL(osInfo, progress);
                } else {
                    return {
                        success: false,
                        message: 'サポートされていないOSです'
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'インストール中にエラーが発生しました',
                    details: error instanceof Error ? error.message : String(error)
                };
            }
        }
    );
}

/**
 * Linux環境でDockerをインストールする
 * @param osInfo Linux OS情報
 * @param progress プログレスレポーター
 * @returns インストール結果
 */
async function installDockerOnLinux(
    osInfo: OSInfo, 
    progress: Progress
): Promise<DockerOperationResult> {
    if (!osInfo.distro) {
        osInfo.distro = await detectLinuxDistro();
    }
    
    progress.report({ increment: 20, message: 'パッケージリストを更新中...' });
    
    try {
        if (osInfo.distro.id === 'ubuntu' || osInfo.distro.id === 'debian') {
            // Ubuntuの場合
            await execPromise('sudo apt-get update');
            progress.report({ increment: 40, message: '必要なパッケージをインストール中...' });
            await execPromise('sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release');
            
            progress.report({ increment: 60, message: 'Dockerをインストール中...' });
            await execPromise('curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg');
            await execPromise('echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null');
            await execPromise('sudo apt-get update');
            await execPromise('sudo apt-get install -y docker-ce docker-ce-cli containerd.io');
            
            progress.report({ increment: 80, message: 'ユーザー権限を設定中...' });
            await execPromise(`sudo usermod -aG docker ${os.userInfo().username}`);
            
        } else if (osInfo.distro.id === 'centos' || osInfo.distro.id === 'rhel' || osInfo.distro.id === 'fedora') {
            // CentOS/RHELの場合
            await execPromise('sudo yum install -y yum-utils');
            await execPromise('sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo');
            
            progress.report({ increment: 60, message: 'Dockerをインストール中...' });
            await execPromise('sudo yum install -y docker-ce docker-ce-cli containerd.io');
            
            progress.report({ increment: 80, message: 'Dockerサービスを開始中...' });
            await execPromise('sudo systemctl start docker');
            await execPromise('sudo systemctl enable docker');
            await execPromise(`sudo usermod -aG docker ${os.userInfo().username}`);
            
        } else {
            // その他のLinuxディストリビューション
            progress.report({ increment: 60, message: 'Dockerをインストール中(汎用スクリプト)...' });
            await execPromise('curl -fsSL https://get.docker.com -o get-docker.sh');
            await execPromise('sudo sh get-docker.sh');
            
            progress.report({ increment: 80, message: 'ユーザー権限を設定中...' });
            await execPromise(`sudo usermod -aG docker ${os.userInfo().username}`);
        }
        
        progress.report({ increment: 90, message: 'インストールを検証中...' });
        const verification = await verifyDockerInstallation();
        
        if (verification.success) {
            return {
                success: true,
                message: 'Dockerのインストールが完了しました。ユーザー権限を反映するために再ログインが必要な場合があります。'
            };
        } else {
            return {
                success: false,
                message: verification.message
            };
        }
    } catch (error) {
        return {
            success: false,
            message: 'Dockerのインストールに失敗しました',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * macOS環境でDockerをインストールする
 * @param progress プログレスレポーター
 * @returns インストール結果
 */
async function installDockerOnMac(
    progress: Progress
): Promise<DockerOperationResult> {
    try {
        // Homebrewが入っているか確認
        progress.report({ increment: 20, message: 'Homebrewの確認中...' });
        try {
            await execPromise('which brew');
        } catch (error) {
            // Homebrewがない場合はインストール
            progress.report({ increment: 30, message: 'Homebrewをインストール中...' });
            await execPromise('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
        }
        
        // Docker Desktop for Macをインストール
        progress.report({ increment: 50, message: 'Docker Desktop for Macをインストール中...' });
        await execPromise('brew install --cask docker');
        
        progress.report({ increment: 80, message: 'Docker Desktopを開始中...' });
        await execPromise('open -a Docker');
        
        // インストール完了を待つ
        progress.report({ increment: 90, message: 'Dockerの起動を待っています...(30秒)' });
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        const verification = await verifyDockerInstallation();
        if (verification.success) {
            return {
                success: true,
                message: 'Docker Desktop for Macのインストールが完了しました。'
            };
        } else {
            return {
                success: false,
                message: 'Docker Desktopがインストールされましたが、起動に時間がかかっています。アプリを手動で起動してください。'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: 'Dockerのインストールに失敗しました',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * WSL環境でDockerをインストールする
 * @param osInfo WSL OS情報
 * @param progress プログレスレポーター
 * @returns インストール結果
 */
async function installDockerOnWSL(
    osInfo: OSInfo,
    progress: Progress
): Promise<DockerOperationResult> {
    // WSLでは基本的にLinuxと同じだが、追加の設定が必要
    const linuxResult = await installDockerOnLinux(osInfo, progress);
    if (!linuxResult.success) {
        return linuxResult;
    }
    
    // WSL特有の設定
    try {
        progress.report({ increment: 95, message: 'WSL固有の設定を適用中...' });
        
        // dockerdの自動起動設定
        const dockerdServiceContent = `
#!/bin/sh
service docker start
`;
        const userHome = os.homedir();
        const startupScriptPath = path.join(userHome, 'docker-startup.sh');
        
        fs.writeFileSync(startupScriptPath, dockerdServiceContent);
        await execPromise(`chmod +x ${startupScriptPath}`);
        
        // .bashrcまたは.zshrcに追加
        const shellConfigPath = path.join(userHome, '.bashrc');
        if (fs.existsSync(shellConfigPath)) {
            const configContent = fs.readFileSync(shellConfigPath, 'utf8');
            if (!configContent.includes('docker-startup.sh')) {
                fs.appendFileSync(shellConfigPath, `\n# Docker自動起動\nif [ -f ${startupScriptPath} ]; then\n  ${startupScriptPath}\nfi\n`);
            }
        }
        
        return {
            success: true,
            message: 'WSL環境でDockerのインストールが完了しました。WSLを再起動して変更を適用してください。'
        };
    } catch (error) {
        return {
            success: false,
            message: 'WSL環境でのDockerセットアップに一部問題が発生しました',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Dockerのインストールが成功したか確認する
 * @returns 検証結果
 */
export async function verifyDockerInstallation(): Promise<DockerOperationResult> {
    try {
        // Docker versionコマンドを実行
        await execPromise('docker --version');
        
        // Docker情報を取得
        await execPromise('docker info');
        
        // Hello Worldイメージのテスト実行
        await execPromise('docker run --rm hello-world');
        
        return {
            success: true,
            message: 'Dockerが正常に動作しています'
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // エラーメッセージからより具体的な問題を特定
        if (errorMessage.includes('permission denied')) {
            return {
                success: false,
                message: 'Dockerデーモンにアクセスする権限がありません。ユーザーをdockerグループに追加した後、再ログインしてください。'
            };
        } else if (errorMessage.includes('daemon is not running')) {
            return {
                success: false,
                message: 'Dockerデーモンが実行されていません。Docker serviceを起動してください。'
            };
        } else if (errorMessage.includes('command not found')) {
            return {
                success: false,
                message: 'Dockerコマンドが見つかりません。インストールが正しく完了していない可能性があります。'
            };
        }
        
        return {
            success: false,
            message: 'Dockerの検証中にエラーが発生しました',
            details: errorMessage
        };
    }
} 