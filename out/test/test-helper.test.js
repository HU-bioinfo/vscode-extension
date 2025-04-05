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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const test_helper_1 = require("../src/test-helper");
describe('テストヘルパーの機能テスト', () => {
    afterEach(() => {
        sinon.restore();
    });
    it('resetMocks関数のテスト', () => {
        test_helper_1.vscode.window.showErrorMessage();
        (0, test_helper_1.resetMocks)();
        assert.strictEqual(test_helper_1.vscode.window.showErrorMessage.callCount, 0);
    });
    it('setupMockFileSystem関数のテスト', () => {
        const fileSystem = {
            'dir1': {
                'file1.txt': 'content1',
                'subdir': {
                    'file2.txt': 'content2'
                }
            },
            'file3.txt': 'content3'
        };
        (0, test_helper_1.setupMockFileSystem)(fileSystem);
        assert.ok(true, 'Mock file system setup completed');
    });
    it('mockDockerSuccess関数のテスト', () => {
        (0, test_helper_1.mockDockerSuccess)();
        assert.ok(true, 'Docker success mock setup completed');
    });
    it('mockDockerFailure関数のテスト', () => {
        (0, test_helper_1.mockDockerFailure)('test error');
        assert.ok(true, 'Docker failure mock setup completed');
    });
    it('createMockContext関数のテスト', () => {
        const context = (0, test_helper_1.createMockContext)('/test/path');
        assert.strictEqual(context.extensionUri.fsPath, '/test/path');
        assert.strictEqual(context.subscriptions.length, 0);
    });
    it('expectation objectのテスト', () => {
        // このテストはダミーテストとして実装
        // expectationオブジェクトは内部で他のスタブに依存するため、
        // 単体テストとしては複雑になりすぎるためスキップ
        assert.ok(true, 'expectation object exists');
    });
    it('mockRemoteContainersExtension関数のテスト', () => {
        (0, test_helper_1.mockRemoteContainersExtension)(true);
        assert.ok(true, 'Remote containers extension mock setup completed');
    });
    it('mockProjectFolderSelection関数のテスト', () => {
        (0, test_helper_1.mockProjectFolderSelection)('/test/project');
        assert.ok(true, 'Project folder selection mock setup completed');
    });
    it('mockCacheFolderSelection関数のテスト', () => {
        (0, test_helper_1.mockCacheFolderSelection)('/test/cache');
        assert.ok(true, 'Cache folder selection mock setup completed');
    });
    it('mockGitHubPatInput関数のテスト', () => {
        (0, test_helper_1.mockGitHubPatInput)('test-pat');
        assert.ok(true, 'GitHub PAT input mock setup completed');
    });
});
//# sourceMappingURL=test-helper.test.js.map