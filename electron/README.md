# electron

**主进程**源码。入口：`main.ts`；渲染进程通过 `preload.ts` 的 `contextBridge` 调 IPC。  
渲染进程在 [`src/`](../src/README.md)；跨进程契约在 `shared/`。

| 目录 / 文件 | 职责 |
|-------------|------|
| `main.ts` | 应用生命周期、注册 IPC、创建窗口、退出时释放 ACP / 工作区监听 |
| `preload.ts` | `contextIsolation` 下暴露 `window.electronAPI` |
| [`ipc/`](./ipc/) | `ipcMain` 处理器注册 |
| [`window/`](./window/) | BrowserWindow 创建、关闭确认、标题 |
| [`services/`](./services/) | 业务服务（文件、工作区、阅读标记、ACP、**在线文档 web-doc**；含 `web-doc/adapters/`、`web-doc/e2e-fixture.ts`） |
| [`vite-plugins/`](./vite-plugins/) | 主进程构建用 Vite 插件 |

`webPreferences`：preload + `contextIsolation: true` + `nodeIntegration: false`。渲染端禁止 Node / `@electron/remote`。

新增能力顺序见 [AGENTS.md](../AGENTS.md)：`shared` → **本目录 services** → ipc → `electron-api.types` → preload → `src/api` → hooks。
