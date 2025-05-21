// test/util/moduleloader.ts の各モジュールのロード関数を追加

/**
 * テスト用にui-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたui-helpersモジュール
 */
export function loadUiHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/ui-helpers', combinedStubs);
}

/**
 * テスト用にfs-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたfs-helpersモジュール
 */
export function loadFsHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/fs-helpers', combinedStubs);
}

/**
 * テスト用にdocker-helpers.tsモジュールを読み込みます
 * @param additionalStubs 追加のスタブ（オプション）
 * @returns 読み込まれたdocker-helpersモジュール
 */
export function loadDockerHelpersModule(additionalStubs: Record<string, any> = {}): any {
    const defaultMocks = getDefaultMocks();
    const combinedStubs = { ...defaultMocks, ...additionalStubs };
    return loadModuleWithVSCodeMock('../../src/docker-helpers', combinedStubs);
} 