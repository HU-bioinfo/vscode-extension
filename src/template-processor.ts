import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * テンプレートファイルとディレクトリの処理を行うクラス
 */
export class TemplateProcessor {
  /**
   * ファイル名またはディレクトリ名からテンプレート拡張子を削除する
   * @param filename ファイル名またはディレクトリ名
   * @returns テンプレート拡張子が削除されたファイル名またはディレクトリ名
   */
  public removeTemplateExtension(filename: string): string {
    // _template 拡張子の処理
    if (filename.includes('_template')) {
      return filename.replace('_template', '');
    }
    
    // .template 拡張子の処理
    if (filename.endsWith('.template')) {
      return filename.substring(0, filename.length - 9);
    }
    
    return filename;
  }
  
  /**
   * テンプレート内のプレースホルダーを変数で置換する
   * @param content テンプレートの内容
   * @param variables 置換する変数のマップ
   * @returns プレースホルダーが置換されたコンテンツ
   */
  public replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    
    // 全ての変数について処理
    for (const [key, value] of Object.entries(variables)) {
      // {{KEY}} 形式のプレースホルダーを置換
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }
  
  /**
   * テンプレートディレクトリを展開する
   * @param templateDir テンプレートディレクトリのパス
   * @param targetDir 展開先ディレクトリのパス
   * @param variables 置換する変数のマップ
   */
  public async expandTemplateDirectory(
    templateDir: string, 
    targetDir: string, 
    variables: Record<string, string>
  ): Promise<void> {
    // テンプレートディレクトリの存在確認
    if (!fs.existsSync(templateDir)) {
      throw new Error(`テンプレートディレクトリが存在しません: ${templateDir}`);
    }
    
    // ターゲットディレクトリの作成
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // テンプレートディレクトリ内の全ファイルを処理
    const entries = fs.readdirSync(templateDir);
    
    for (const entry of entries) {
      const sourcePath = path.join(templateDir, entry);
      const targetName = this.removeTemplateExtension(entry);
      const targetPath = path.join(targetDir, targetName);
      
      const stats = fs.statSync(sourcePath);
      
      if (stats.isDirectory()) {
        // ディレクトリの場合は再帰的に処理
        await this.expandTemplateDirectory(sourcePath, targetPath, variables);
      } else {
        // ファイルの場合はテンプレート処理を行う
        const content = fs.readFileSync(sourcePath, 'utf8');
        const processedContent = this.replaceVariables(content, variables);
        fs.writeFileSync(targetPath, processedContent, 'utf8');
      }
    }
  }
} 