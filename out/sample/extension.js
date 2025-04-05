"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// ... existing code ...
vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Docker イメージ ${imageName} をプルしています...`,
    cancellable: true
}, async (progress) => {
    progress.report({ increment: 0 });
    // ... existing code ...
});
// ... existing code ...
//# sourceMappingURL=extension.js.map