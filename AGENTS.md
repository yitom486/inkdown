# AGENTS.md — Electron Markdown 编辑器

本文档定义本项目的开发准则，供 AI Agent 与开发者共同遵循。

## 项目目标

在 `start/` 目录中从零学习 Electron 桌面应用开发，最终交付一个 **Markdown 编辑器** 桌面应用。

核心能力（按阶段实现）：

1. Electron 基础：窗口、菜单、生命周期
2. 文件操作：打开 / 保存 / 另存为 `.md` 文件
3. Markdown 编辑：语法高亮编辑 + 实时预览
4. 产品化：快捷键、主题、打包发布

## 技术栈（固定，不可随意替换）

| 类别 | 选型 | 说明 |
|------|------|------|
| 运行时 / 包管理 | **Bun** | 安装依赖、运行脚本；禁止使用 npm / yarn / pnpm |
| 桌面框架 | **Electron** | 主进程 + 预加载 + 渲染进程 |
| 构建工具 | **electron-vite** | 统一构建 main / preload / renderer |
| 前端框架 | **React** | 函数组件 + Hooks |
| 语言 | **TypeScript** | 严格模式，全项目统一 |
| UI 组件库 | **shadcn/ui** | 基于 Radix UI，组件源码落在项目中 |
| 样式 | **Tailwind CSS** | 与 shadcn/ui 配套 |
| 图标 | **lucide-react** | shadcn 默认图标库 |
| Markdown 解析 | **markdown-it** | 预览渲染（后续引入） |
| 编辑器 | **CodeMirror 6** | Markdown 语法高亮 |
| 服务端状态 | **TanStack Query v5** | IPC / 后端数据：mutations + query cache |
| 客户端 UI 状态 | **Zustand** | 视图模式、滚动进度、侧栏折叠等本地持久化 |
| 布局 | **react-resizable-panels** | 可拖拽分屏（经 shadcn Resizable 封装） |
| 测试 | **Vitest** + **Playwright** | 单元/集成（`*.test.ts`）；E2E（`e2e/*.spec.ts`） |
| 打包发布 | **electron-builder** | 生成 Windows `.exe` 安装包 |

## Bun 使用准则

- 安装依赖：`bun install`
- 添加依赖：`bun add <pkg>` / 开发依赖 `bun add -d <pkg>`
- 运行脚本：`bun run <script>`（如 `bun run dev`、`bun run build`）
- `package.json` 中所有 scripts 必须兼容 Bun 执行
- 锁文件使用 `bun.lock`（提交到版本库）
- 不使用 npm、yarn、pnpm 命令

### 常用脚本约定

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "pack": "bun run build && electron-builder",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:all": "bun run typecheck && bun run test && bun run build && bun run test:e2e",
    "typecheck": "tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json"
  }
}
```

## 项目结构

```
start/
├── AGENTS.md                 # 本文件：项目准则
├── .plan/                    # 开发计划（日期-名称.md，含状态标记）
├── package.json
├── bun.lock
├── vitest.config.ts          # Vitest 配置
├── playwright.config.ts      # Playwright E2E 配置
├── e2e/                      # Electron E2E（需先 bun run build）
│   ├── helpers/launch-app.ts
│   ├── app-smoke.spec.ts
│   └── export-pdf.spec.ts
├── .github/workflows/ci.yml  # CI：typecheck + test + E2E
├── electron.vite.config.ts   # electron-vite 配置
├── electron-builder.yml      # 打包配置
├── tsconfig.json
├── components.json           # shadcn/ui 配置
├── shared/                   # 跨进程共享契约（与 src/components/shared/ 无关）
│   ├── ipc/                  # IPC 通道名 + preload API 类型
│   ├── types/                # 跨进程 DTO 与文档/编辑器类型
│   ├── core/                 # Result、AppError
│   ├── constants/            # 扩展名、对话框、工作区等常量
│   └── utils/                # 跨进程路径工具
├── electron/
│   ├── main.ts                    # 应用生命周期入口（whenReady / activate / quit）
│   ├── preload.ts                 # contextBridge 桥接
│   ├── ipc/
│   │   └── register-handlers.ts   # ipcMain 集中注册
│   ├── window/
│   │   ├── create-window.ts       # BrowserWindow 创建与 session 绑定
│   │   ├── window-session.ts      # 多窗口 session 映射
│   │   ├── window-close.ts        # 关闭前未保存确认
│   │   ├── close-gate.ts          # 关闭决策状态机
│   │   └── window-title.ts        # 窗口标题格式化
│   └── services/
│       ├── file-service.ts        # 文件 dialog + fs（返回 Result）
│       ├── workspace.ts           # 工作区目录扫描
│       ├── reading-marks-service.ts  # 书签/批注持久化
│       ├── error-log-service.ts   # 渲染端错误日志
│       ├── app-service.ts         # 应用元信息
│       ├── app-paths.ts           # 图标等资源路径
│       └── runtime-state.ts       # 主进程运行时开关（如 verbose 日志）
├── src/
│   ├── index.html
│   ├── main.tsx              # React 入口（含 QueryProvider）
│   ├── App.tsx
│   ├── api/                  # 渲染进程 API 层（封装 IPC，返回 Result）
│   │   ├── file-api.ts
│   │   └── query-keys.ts
│   ├── providers/
│   │   └── QueryProvider.tsx
│   ├── stores/               # Zustand 本地 UI 状态
│   ├── components/
│   │   ├── ui/               # shadcn/ui 原子组件
│   │   ├── editor/
│   │   ├── preview/
│   │   ├── layout/
│   │   └── shared/           # ErrorBanner、AboutDialog 等
│   ├── hooks/
│   ├── lib/
│   └── styles/
└── resources/
```

## Electron 架构准则

### 进程职责

- **main（主进程）**：`BrowserWindow`、应用菜单、`dialog` 文件对话框、`fs` 读写
- **preload（预加载）**：通过 `contextBridge.exposeInMainWorld` 暴露类型安全的 API
- **renderer（渲染进程）**：React UI，禁止直接访问 Node.js API

### 安全要求（必须遵守）

```typescript
// electron/main.ts 中 BrowserWindow webPreferences 固定配置
webPreferences: {
  preload: path.join(__dirname, '../preload/preload.mjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
}
```

- 渲染进程不得 `require('fs')` 或使用 `@electron/remote`
- 所有文件操作经 IPC：renderer → `src/api/` → preload → main
- IPC channel 命名：`模块:动作`（如 `file:open`、`file:save`）
- **有返回值的 IPC 统一返回 `Result<T, AppError>`**，禁止用 `null` 表示失败（用户取消用 `CANCELLED` 错误码）

### IPC 与 Result 约定

新增跨进程能力时，按以下顺序改动：

```
shared/core/errors.ts + shared/core/result.ts → 错误码与 Result 类型
shared/types/file.ts                          → DTO（纯数据，不含 Result 包装）
electron/services/file-service.ts             → 业务实现，返回 Result
electron/ipc/register-handlers.ts             → ipcMain.handle 注册
shared/ipc/electron-api.types.ts              → ElectronAPI 接口
electron/preload.ts                   → contextBridge 暴露
src/api/*.ts                          → 渲染端 API 封装
src/hooks/                            → useMutation / useQuery 消费
```

```typescript
// 主进程 / API 层标准形态
async function readFileByPath(path: string): Promise<Result<OpenFileResult, AppError>> {
  try {
    const content = await readFile(path, 'utf-8')
    return ok({ filePath: path, content })
  } catch (error) {
    return err(toAppError(error, '读取文件失败'))
  }
}

// 渲染进程消费
const result = await fileApi.readFile(path)
if (!isOk(result)) {
  if (!isCancelled(result.error)) reportError(result.error)
  return
}
loadFile(result.value)
```

- `CANCELLED`：用户关闭对话框，**不弹错误提示**
- 其他错误码：通过 `ErrorBanner` 或后续 Sonner 提示用户
- 主进程非预期异常：记录 `console.error` 并返回 `err(...)`

## 状态管理准则

| 状态类型 | 工具 | 示例 |
|----------|------|------|
| IPC / 后端数据 | **TanStack Query** | 工作区树、应用版本；文件操作用 `useMutation` |
| 本地 UI 偏好 | **Zustand + persist** | 视图模式、滚动进度、目录折叠 |
| 编辑器即时内容 | **useState** | 当前文档 content、dirty 标记 |

- 渲染进程 **禁止** 在组件/hook 中直接调用 `window.electronAPI` 的文件方法；统一走 `src/api/file-api.ts`
- 例外：`updateTitle`、`quit` 等 fire-and-forget 操作可在 hook 内直连 preload API
- Query Key 集中定义在 `src/api/query-keys.ts`
- 工作区等「仅用户操作触发、无自动 refetch」的数据：mutation 成功后 `setQueryData`

## React 准则

- 仅使用函数组件，禁止 class 组件
- 跨组件共享：Query cache（服务端态）、Zustand（UI 态）、必要时 Context
- 副作用集中在 `useEffect`，注意 Electron 环境下的清理
- 组件文件命名：`PascalCase.tsx`（如 `EditorPane.tsx`）
- Hook 文件命名：`use*.ts`（如 `useFileOperations.ts`）
- 每个组件职责单一；编辑器、预览、工具栏拆分为独立组件

### 组件分层

```
src/components/
├── ui/           # shadcn/ui 原子组件（Button、Dialog、Menubar 等）
├── editor/       # Markdown 编辑器相关
├── preview/      # 预览面板相关
├── layout/       # 布局（Sidebar、Toolbar、SplitPane）
└── shared/       # 跨模块复用组件
```

## shadcn/ui 准则

- 初始化：`bunx shadcn@latest init`（Tailwind + TypeScript 配置完成后）
- 添加组件：`bunx shadcn@latest add button dialog menubar separator ...`
- 组件生成到 `src/components/ui/`，**不要**从 `node_modules` 直接 import shadcn 组件
- 使用 `cn()` 合并 className（来自 `@/lib/utils`）
- 优先使用 shadcn 组件构建 UI，避免重复造轮子：
  - 菜单栏 → `Menubar`
  - 对话框 → `Dialog` / `AlertDialog`
  - 按钮 → `Button`
  - 分隔 → `Separator`
  - 主题切换 → 配合 `next-themes` 或自建 theme provider
- 不修改 `src/components/ui/` 内组件的核心逻辑；需要定制时通过 props 或 wrapper 组件扩展

## Markdown 编辑器功能准则（目标架构）

### 布局

- 默认左右分屏：左侧编辑，右侧预览
- 使用 shadcn 风格的分隔布局；窗口可调整分屏比例

### 编辑区

- CodeMirror 6 + Markdown 语言包
- 支持基础 Markdown 语法高亮
- 内容变更 debounce（约 300ms）后触发预览更新

### 预览区

- markdown-it 渲染 HTML
- 预览区使用 `prose` 排版样式（Tailwind Typography 或 github-markdown-css）
- 渲染 HTML 使用 DOMPurify 消毒，防止 XSS

### 文件操作

- `Ctrl+O` 打开、`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为
- 未保存修改关闭窗口时弹出确认（shadcn AlertDialog）
- 标题栏或 Tab 显示当前文件名与修改状态（`*`）

## 代码风格

- TypeScript 严格模式，`noImplicitAny: true`
- 路径别名：`@/` → `src/`，`@shared/` → `shared/`（与 shadcn 默认一致）
- 优先 `async/await`，IPC 调用返回 `Promise<Result<T, AppError>>`
- 错误处理：主进程 `try/catch` → `Result`；渲染进程 `isOk()` 分支 + `ErrorBanner`（后续可换 Sonner）
- 注释仅解释非显而易见的业务逻辑，避免赘述

## Git 提交规范

- Commit message 使用**简体中文**
- 格式：`type: 中文描述`（type 可保留英文前缀）

```
feat: 添加 Markdown 实时预览面板
fix: 修复保存文件路径丢失问题
docs: 更新 AGENTS.md 构建说明
chore: 使用 bun 初始化项目依赖
```

## Agent 行为准则

1. **最小改动**：只改与任务相关的文件，不重构无关代码
2. **遵循技术栈**：不引入 Vue、Svelte、npm 等与本项目冲突的工具
3. **先读后写**：修改前先阅读周边代码，匹配现有命名与结构
4. **安全优先**：新增 API 必须走 preload 桥接，不破坏 contextIsolation
5. **UI 一致**：新界面使用 shadcn/ui + Tailwind，不写内联 style 或裸 HTML 表单
6. **不提交密钥**：`.env`、token 等敏感文件不入库
7. **不擅自 commit**：仅在用户明确要求时提交代码
8. **维护计划**：完成或启动任务时同步更新 `.plan/` 中对应条目的状态标记（见下文）

## 计划管理模式（`.plan/`）

项目使用 **`.plan/` 目录** 跟踪开发计划，与 AGENTS.md 中的阶段路线互补：AGENTS.md 定准则与架构，`.plan/` 定可执行清单与进度。

### 目录与命名

```
.plan/
├── README.md                              # 格式说明与计划索引
└── YYYY-MM-DD-计划名称.md                 # 单份计划，如 2026-08-28-编辑器功能路线图.md
```

- 文件名：**创建日期（ISO）+ 连字符 + 计划中文名称**
- 新需求优先写入已有路线图；仅当范围独立、周期较长时再新建计划文件

### 状态标记

**计划级**（文档顶部）：

```markdown
> **计划状态**: `pending` | `in-progress` | `done` | `cancelled`
```

**任务级**（checklist 每一项）：

```markdown
- [ ] **[pending]** 任务描述
- [ ] **[in-progress]** 任务描述
- [x] **[done]** 任务描述 — 2026-08-28，`commit-hash`
- [x] **[cancelled]** 任务描述 — 取消原因
```

| 标签 | 含义 |
|------|------|
| `[pending]` | 待开始 |
| `[in-progress]` | 进行中 |
| `[done]` | 已完成 |
| `[cancelled]` | 已取消 |

### Agent 更新义务

1. **领取任务前**：阅读 `.plan/` 最新路线图，确认优先级与依赖
2. **开始实现**：将对应条目改为 `[in-progress]`，更新「最后更新」日期
3. **完成实现**：勾选 `[x]`，改为 `[done]`，补充完成日期与 commit hash
4. **计划收尾**：所有条目均为 `[done]` / `[cancelled]` 时，将计划状态改为 `done`
5. **不擅自新建计划**：除非用户明确要求拆分，否则追加到现有路线图

当前主计划见 [`.plan/2026-08-28-编辑器功能路线图.md`](./.plan/2026-08-28-编辑器功能路线图.md)。

## 开发阶段路线

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| 0 | Bun + electron-vite + React + shadcn 脚手架 | `bun run dev` 打开空白 Electron 窗口 |
| 1 | IPC 基础 + 应用菜单 | 菜单可触发 about 对话框 |
| 2 | 文件打开 / 保存 | 可读写 `.md` 文件 |
| 3 | CodeMirror 编辑 + markdown-it 预览 | 分屏实时预览、KaTeX/Mermaid |
| 4 | 快捷键、主题、未保存提示、Result + Query | 完整编辑体验与服务端状态管理（进度见 `.plan/`） |
| 5 | electron-builder 打包 | 生成可安装 `.exe` |

## 参考命令速查

```bash
# 初始化（后续脚手架阶段执行）
bun init
bun add react react-dom
bun add -d electron electron-vite electron-builder typescript @types/react @types/react-dom
bunx shadcn@latest init

# 日常开发
bun run dev
bun run build
bun run test
bun run build && bun run test:e2e
bun run test:all
bun run typecheck
bun run pack

# 添加 shadcn 组件
bunx shadcn@latest add button dialog menubar toast
```
