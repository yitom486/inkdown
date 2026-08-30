# src

Electron **渲染进程**源码。入口：`main.tsx` → `App.tsx`。路径别名 `@/` 指向本目录。

| 目录 / 文件 | 职责 |
|-------------|------|
| `App.tsx` | 根组件：工作区壳、文件操作、对话框、自动保存/草稿 |
| `main.tsx` | React 挂载、Providers |
| `index.html` / `env.d.ts` | Vite 入口与类型 |
| [`api/`](./api/) | 对 preload/`window.electronAPI` 的 IPC 封装 |
| [`hooks/`](./hooks/) | React Hook（按域分子目录） |
| [`lib/`](./lib/) | 无 React 的纯逻辑（按域分子目录） |
| [`stores/`](./stores/) | Zustand 本地 UI / 会话状态 |
| [`components/`](./components/) | UI 组件 |
| [`providers/`](./providers/) | Query / Theme 等全局 Provider |
| [`styles/`](./styles/) | 全局与阅读器/预览 CSS |
| [`types/`](./types/) | 渲染端补充类型声明 |
| [`public/`](./public/) | 静态资源（含 pdf.js 资源） |

主进程代码在 [`electron/`](../electron/README.md)；跨进程契约在 `shared/`。细则见根目录 [AGENTS.md](../AGENTS.md)。

**约定**：本树内带 `README.md` 的目录，增删或改文件名后须同步更新对应 README。
