import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { parseErrorMessage, handleFileSystemError } from './error-handlers';

/**
 * ディレクトリの存在を確認し、なければ作成する
 * @param dirPath 作成するディレクトリのパス
 */
export function ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o777 });
    }
}

/**
 * 親ディレクトリの有効性を確認する
 * @param parentDirPath 親ディレクトリのパス
 * @returns 有効な場合はtrue、無効な場合はfalse
 */
export async function validateParentDirectory(parentDirPath: string): Promise<boolean> {
    if (!fs.existsSync(parentDirPath)) {
        return false;
    }
    
    const containerDirPath = path.join(parentDirPath, "container");
    const devcontainerDirPath = path.join(containerDirPath, ".devcontainer");
    if (!fs.existsSync(devcontainerDirPath)) {
        return false;
    }
    
    if (!fs.existsSync(path.join(devcontainerDirPath, "docker-compose.yml"))) {
        return false;
    }
    if (!fs.existsSync(path.join(devcontainerDirPath, "devcontainer.json"))) {
        return false;
    }
    return true;
}

/**
 * フォルダのアクセス権を設定する関数
 * @param projectFolder プロジェクトフォルダのパス
 * @param cacheFolder キャッシュフォルダのパス
 * @returns 成功した場合はtrue
 */
export async function setupFolderPermissions(projectFolder: string, cacheFolder: string): Promise<boolean> {
    try {
        fs.chmodSync(projectFolder, 0o777);
        fs.chmodSync(cacheFolder, 0o777);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`[bioinfo-launcher] 権限エラー: フォルダのアクセス権を変更できません。${parseErrorMessage(error)}`);
        return false;
    }
}

/**
 * フォルダを再帰的にコピーする関数
 * @param source コピー元フォルダのパス
 * @param target コピー先フォルダのパス
 * @param fsModule ファイルシステムモジュール（テスト用）
 */
export function copyFolderRecursiveSync(source: string, target: string, fsModule: any = fs): void {
    try {
        if (!fsModule.existsSync(source)) {return;}
        if (!fsModule.existsSync(target)) {fsModule.mkdirSync(target, { recursive: true, mode: 0o777 });}

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