// テスト環境でない場合のみ実際のVSCodeをインポート
let vscode: any;
if (process.env.NODE_ENV !== 'test') {
    vscode = require('vscode');
} else {
    // テスト環境では、モックを使用
    vscode = {
        window: {
            showInformationMessage: () => Promise.resolve(undefined),
            showErrorMessage: () => Promise.resolve(undefined)
        }
    };
}

// テスト環境用のエクスポート (テスト時にモックと入れ替えるため)
export const _test = {
    setVSCodeMock: (mock: any) => {
        if (process.env.NODE_ENV === 'test') {
            vscode = mock;
        }
    }
};

/**
 * エラーメッセージをパースして表示可能な文字列にする
 * @param error エラーオブジェクトまたは文字列
 * @returns 表示用のエラーメッセージ
 */
export function parseErrorMessage(error: any): string {
    if (error === undefined || error === null) {
        return '不明なエラー';
    }
    
    if (typeof error === 'string') {
        return error;
    }
    
    // Errorオブジェクトの場合
    if (error instanceof Error) {
        return error.message;
    }
    
    // オブジェクトでmessageプロパティを持つ場合
    if (error.message) {
        if (error.details) {
            return `${error.message}: ${error.details}`;
        }
        return error.message;
    }
    
    // それ以外はJSONに変換して表示
    try {
        return JSON.stringify(error);
    } catch (e) {
        return '不明なエラー';
    }
}

/**
 * DockerエラーかどうかをチェックするためのAPIの公開
 * @param error エラーオブジェクト
 * @returns Dockerエラーの場合はtrue
 */
export function isDockerError(error: any): boolean {
    const message = parseErrorMessage(error).toLowerCase();
    return message.includes('docker') || 
        message.includes('daemon') || 
        message.includes('container') ||
        message.includes('image');
}

/**
 * Docker関連のエラーを処理する
 * @param error Dockerエラー
 */
export function handleDockerError(error: any): void {
    const message = parseErrorMessage(error).toLowerCase();
    
    if (message.includes('cannot connect to the docker daemon') || 
        message.includes('daemon is not running')) {
        vscode.window.showErrorMessage('Dockerデーモンに接続できません。Dockerが起動しているか確認してください。');
    } else if (message.includes('permission denied')) {
        vscode.window.showErrorMessage('Dockerの実行権限がありません。管理者権限で実行するか、ユーザーをdockerグループに追加してください。');
    } else if (message.includes('not found')) {
        vscode.window.showErrorMessage('Dockerイメージまたはコンテナが見つかりません。イメージ名やタグを確認してください。');
    } else {
        vscode.window.showErrorMessage(`Dockerコマンドの実行中にエラーが発生しました: ${message}`);
    }
}

/**
 * 入力値を検証する関数
 * @param value 検証する値
 * @returns エラーメッセージまたはnull（検証成功時）
 */
export function validateInput(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') {
        return '値を入力してください';
    }
    
    return null; // 検証成功
}

/**
 * Docker Compose関連のエラーを処理する
 * @param error Docker Composeエラー
 */
export function handleDockerComposeError(error: any): void {
    const message = parseErrorMessage(error).toLowerCase();
    
    if (message.includes('version not found')) {
        vscode.window.showErrorMessage('Docker Composeのバージョンが古いか、互換性がありません。Docker Composeを更新してください。');
    } else if (message.includes('file not found')) {
        vscode.window.showErrorMessage('docker-compose.ymlファイルが見つかりません。設定を確認してください。');
    } else {
        vscode.window.showErrorMessage(`Docker Composeコマンドの実行中にエラーが発生しました: ${message}`);
    }
}

/**
 * ファイルシステム関連のエラーを処理する
 * @param error ファイルシステムエラー
 */
export function handleFileSystemError(error: any): void {
    const message = parseErrorMessage(error).toLowerCase();
    
    if (message.includes('permission denied')) {
        vscode.window.showErrorMessage('ファイルへのアクセス権限がありません。管理者権限で実行するか、ファイルのアクセス権を確認してください。');
    } else if (message.includes('no such file') || message.includes('not found')) {
        vscode.window.showErrorMessage('ファイルまたはディレクトリが見つかりません。パスを確認してください。');
    } else if (message.includes('already exists')) {
        vscode.window.showErrorMessage('ファイルまたはディレクトリがすでに存在します。');
    } else {
        vscode.window.showErrorMessage(`ファイル操作中にエラーが発生しました: ${message}`);
    }
}

/**
 * ネットワーク関連のエラーを処理する
 * @param error ネットワークエラー
 */
export function handleNetworkError(error: any): void {
    const message = parseErrorMessage(error).toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
        vscode.window.showErrorMessage('ネットワーク接続がタイムアウトしました。インターネット接続を確認してください。');
    } else if (message.includes('network') || message.includes('connect')) {
        vscode.window.showErrorMessage('ネットワーク接続エラーが発生しました。インターネット接続を確認してください。');
    } else {
        vscode.window.showErrorMessage(`ネットワークエラーが発生しました: ${message}`);
    }
} 