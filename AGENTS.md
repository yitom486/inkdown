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
| 编辑器 | **CodeMirror 6** | Markdown 语法高亮（后续引入） |
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
    "typecheck": "tsc --noEmit"
  }
}
```

## 项目结构

```
start/
├── AGENTS.md                 # 本文件：项目准则
├── package.json
├── bun.lock
├── electron.vite.config.ts   # electron-vite 配置
├── electron-builder.yml      # 打包配置
├── tsconfig.json
├── components.json           # shadcn/ui 配置
├── tailwind.config.ts
├── electron/
│   ├── main.ts               # 主进程：窗口、菜单、文件 IO
│   └── preload.ts            # contextBridge 暴露安全 API
├── src/                      # 渲染进程（React 应用）
│   ├── index.html
│   ├── main.tsx              # React 入口
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/               # shadcn/ui 生成组件（勿手改结构）
│   │   └── ...               # 业务组件
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/
│   │   └── utils.ts          # cn() 等 shadcn 工具函数
│   └── styles/
│       └── globals.css       # Tailwind 指令 + 全局样式
└── resources/                # 应用图标等静态资源
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
- 所有文件操作经 IPC：renderer → preload → main
- IPC channel 命名：`模块:动作`（如 `file:open`、`file:save`）

## React 准则

- 仅使用函数组件，禁止 class 组件
- 状态优先用 `useState` / `useReducer`；跨组件共享用 Context 或后续引入的状态库
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
- 路径别名：`@/` → `src/`（与 shadcn 默认一致）
- 优先 `async/await`，IPC 调用返回 Promise
- 错误处理：主进程记录日志；渲染进程用 toast（shadcn Sonner）提示用户
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

## 开发阶段路线

| 阶段 | 内容 | 验收标准 |
|------|------|----------|
| 0 | Bun + electron-vite + React + shadcn 脚手架 | `bun run dev` 打开空白 Electron 窗口 |
| 1 | IPC 基础 + 应用菜单 | 菜单可触发 about 对话框 |
| 2 | 文件打开 / 保存 | 可读写 `.md` 文件 |
| 3 | CodeMirror 编辑 + markdown-it 预览 | 分屏实时预览 |
| 4 | 快捷键、主题、未保存提示 | 完整编辑体验 |
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
bun run pack

# 添加 shadcn 组件
bunx shadcn@latest add button dialog menubar toast
```
