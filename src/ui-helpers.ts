import * as vscode from 'vscode';
import * as os from 'os';

/**
 * Dockerがインストールされていない場合のエラーメッセージをVSCodeウィンドウに表示します。
 * ユーザーにインストールガイドへのリンクを提示します。
 */
export function showDockerNotInstalledError(): void {
    const message = '[bioinfo-launcher] Dockerがインストールされていません。この拡張機能を使用する前にDockerをインストールしてください。';
    const installButton = 'インストールガイド';
    
    vscode.window.showErrorMessage(message, installButton).then(selection => {
        if (selection === installButton) {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
        }
    });
}

/**
 * Dockerの実行権限がない場合のエラーメッセージをVSCodeウィンドウに表示します。
 * OSに応じて対処方法のヘルプを提示します。
 */
export function showDockerPermissionError(): void {
    const message = '[bioinfo-launcher] Dockerの実行権限がありません。';
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

/**
 * GitHub Personal Access Tokenの入力をユーザーに促すためのVSCode InputBoxを表示します。
 * 
 * @returns 入力されたGitHub PAT。未入力またはキャンセルされた場合はundefined。
 */
export async function inputGitHubPAT(): Promise<string | undefined> {
    const githubPat = await vscode.window.showInputBox({
        prompt: "GitHub Personal Access Tokenを入力してください",
        ignoreFocusOut: true,
        password: true,
        validateInput: validateInputForInputBox
    });
    
    if (!githubPat) {
        vscode.window.showErrorMessage("[bioinfo-launcher] GitHub PATが必要です。");
        return undefined;
    }
    
    return githubPat;
}

/**
 * 開発環境の親ディレクトリを選択するようユーザーに促すためのVSCode OpenDialogを表示します。
 * 
 * @returns 選択された親ディレクトリのUri。未選択またはキャンセルされた場合はundefined。
 */
export async function selectParentDirectory(): Promise<vscode.Uri | undefined> {
    const parentDirUri = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "開発環境の親ディレクトリを選択",
        title: "開発環境を作成する親ディレクトリを選択してください"
    });
    
    if (!parentDirUri || parentDirUri.length === 0) {
        vscode.window.showErrorMessage("[bioinfo-launcher] 親ディレクトリが選択されていません。");
        return undefined;
    }
    
    return parentDirUri[0];
}

/**
 * VSCodeのInputBoxで使用するための入力値バリデーション関数。
 * @param value 検証する文字列
 * @returns エラーメッセージ、もしくはnull (エラーなし)
 */
export function validateInputForInputBox(value: string): string | null {
    if (!value) {
        return '入力値は必須です。';
    }
    return null;
} 