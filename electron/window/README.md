# electron/window

主窗口生命周期。不把业务 IO 写在这里，文件/ACP 走 `services/`。

| 文件 | 功能 |
|------|------|
| `create-window.ts` | 创建 `BrowserWindow`、preload、图标、会话登记；`before-input` 全局快捷键 |
| `app-menu.ts` | Application Menu（`editMenu` 等），保证 Ctrl+C/V 在隐藏菜单栏时仍可用 |
| `window-session.ts` | 按 `webContents` 登记窗口会话（dirty、允许关闭等） |
| `window-close.ts` / `close-gate.ts` | 关闭前与渲染进程确认未保存 |
| `window-title.ts` | 窗口标题（应用名 + 文件名） |
