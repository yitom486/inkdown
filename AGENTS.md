# AGENTS.md — 轻量阅读器（Inkdown）

项目开发准则。细则见 `.cursor/rules/`（Git 身份、Zustand、阅读器导航）。

## 目标与产品

Electron 桌面应用：**Markdown 编辑** + **PDF/EPUB/MOBI/AZW3 阅读**（书签/批注）。打包：Win / macOS / Linux。

## 技术栈（不可随意替换）

| 类别 | 选型 |
|------|------|
| 包管理 | **Bun**（禁用 npm / yarn / pnpm） |
| 桌面 | **Electron** + **electron-vite** |
| UI | **React** + **TypeScript** + **shadcn/ui** + **Tailwind** + **lucide-react** |
| 编辑 / 预览 | **CodeMirror 6** + **markdown-it**（DOMPurify） |
| 状态 | **TanStack Query v5**（IPC 数据）+ **Zustand**（本地 UI） |
| 布局 | **react-resizable-panels** |
| 测试 / 打包 | **Vitest** + **Playwright** / **electron-builder** |

```bash
bun install
bun add <pkg>          # 依赖
bun add -d <pkg>       # 开发依赖
bun run dev|build|test|typecheck|pack
bun run test:e2e       # 需先 build
bunx shadcn@latest add <component>
```

锁文件：`bun.lock`。

## 目录要点

```
shared/          # 跨进程契约（ipc / types / core Result）
electron/        # main、preload、ipc、window、services
src/api/         # 渲染端 IPC 封装（禁止组件直调 window.electronAPI 文件 API）
src/stores/      # Zustand
src/components/  # ui | editor | preview | reader | layout | shared
.plan/           # 可执行计划与进度（见 .plan/README.md）
.cursor/rules/   # Agent 强制细则
```

路径别名：`@/` → `src/`，`@shared/` → `shared/`。

## Electron / IPC

- **main**：窗口、菜单、dialog、fs  
- **preload**：`contextBridge`  
- **renderer**：禁止 Node / `@electron/remote`

```typescript
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.mjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
}
```

新增能力顺序：`shared` 类型/错误 → `electron/services` → `ipc/register-handlers` → `electron-api.types` → `preload` → `src/api` → hooks。

有返回值的 IPC 一律 `Result<T, AppError>`；用户取消用 `CANCELLED`（不弹错误）。

## 状态管理

| 类型 | 工具 |
|------|------|
| IPC / 服务端数据 | TanStack Query（`src/api/query-keys.ts`） |
| 本地 UI 偏好 | Zustand + persist |
| 阅读器导航 | `reader-navigation-store`（详见 rule） |
| 编辑器正文 / dirty | `useState` |

Zustand selector 返回对象时必须 `useShallow`：见 `.cursor/rules/zustand-selectors.mdc`。  
阅读器侧栏 vs 底栏粒度：见 `.cursor/rules/reader-navigation.mdc`。

## UI / 代码风格

- 函数组件；组件 `PascalCase.tsx`，Hook `use*.ts`
- shadcn 组件落在 `src/components/ui/`；用 `cn()`；勿改 ui 核心逻辑
- 严格 TypeScript；`async/await`；注释只写非显而易见逻辑

## Git 与 Agent

- **作者身份 / Attribution**：`.cursor/rules/git-identity.mdc`（`yitom486@gmail.com`）
- Message：`type: 中文描述`（feat / fix / docs / chore…）
- 最小改动；不擅自引入冲突技术栈；不擅自 commit；不提交密钥
- 任务进度同步更新 `.plan/`（状态标记见该目录 README）

## 计划

- 准则与架构 → 本文件 + `.cursor/rules/`
- 可执行清单 → `.plan/*.md`
- 不擅自新建计划文件；优先追加现有路线图
