<div align="center">

<img src="./apps/desktop/resources/icon.png" alt="Inkdown Logo" width="100" height="100" />

# Inkdown

**本地优先的「阅读 · 写作 · Agent 伴读」三位一体桌面知识工作区**  
*Local-First Desktop Workspace for Reading, Writing, and Thinking with Agent*

[![Release](https://img.shields.io/github/v/release/yitom486/inkdown?color=3b82f6&label=Release)](https://github.com/yitom486/inkdown/releases)
[![Version](https://img.shields.io/badge/Version-v0.3.1-blue)](./CHANGELOG.md)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/yitom486/inkdown/releases)
[![Package Manager](https://img.shields.io/badge/Bun-1.x-black?logo=bun)](https://bun.sh)
[![Tests](https://img.shields.io/badge/Tests-1243%20passed-success)](./.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](./tsconfig.json)

[核心特性](#-核心特性) • [快速开始](#-快速开始) • [本地开发](#-本地开发) • [Monorepo 地图](#-monorepo-地图) • [发版](#-发版) • [文档与规范](#-文档与规范) • [更新日志](./CHANGELOG.md)

</div>

---

## 💡 为什么选择 Inkdown？

在日常学习与研究工作中，工具链往往是割裂的：用阅读器看 PDF，用单独软件看 EPUB/MOBI，用浏览器读在线技术文档，再打开笔记软件记录摘抄。频繁切换窗口不仅打断心流，也让笔记与原文的章节定位、页码彻底脱节。

**Inkdown** 将这一切收拢到同一个窗口中：
- 📂 **统一工作区**：以本地文件夹为基准，轻松容纳笔记、PDF、EPUB、MOBI 与 AZW3 电子书。
- 📖 **全格式排版阅读**：深度支持各类电子书与 Web 在线文档，提供高精度的视口跳转与页面渲染。
- 🖍️ **坐标级标注系统**：划重点、彩色高亮、写批注，支持按章节归档与一键导出结构化 Markdown。
- 🤖 **原生 ACP 智能伴读**：基于标准 Agent Client Protocol（ACP v1），Agent 能够直接感知视口位置与阅读上下文，随时答疑并主动提供划线批注建议。
- 🔒 **本地优先与隐私安全**：核心读写能力 100% 离线可用，数据沉淀在本地磁盘，无云端绑架与隐私焦虑。

---

## ✨ 核心特性

### 1. 📚 全格式深度阅读与笔记标注

Inkdown 为不同格式的文献与书籍提供了针对性的深度渲染与排版支持：

| 阅读媒介 | 支持格式 | 核心能力 |
| :--- | :--- | :--- |
| **文档资料** | `PDF` | 连续滚动、多级目录、缩放重排、高 DPI 渲染、文字选区、**视口坐标级重点与批注**、OCR 目录抽取、笔记导出 |
| **电子书籍** | `EPUB` | 虚拟滚动、目录与章节无缝跳转、阅读进度记忆、主题字号调整、书签、重点批注与导出 |
| **Kindle 图书** | `MOBI` / `AZW3` / `AZW` | 多级目录、**章内锚点精确定位与视口补偿**、进度记忆、正文字号与行距自定义、书签与批注导出 |
| **技术文档** | 在线文档（URL） | 网页阅读模式抽取、目录与底栏导航、代码块一键复制、同站地址步进、划词标记与 Agent 上下文 |

- **多层级视觉反馈**：纯批注以优雅虚线标识，高亮重点支持多种预设色彩；PDF 标记采用真实页面几何坐标计算，缩放比例改变后仍精准贴合文字。
- **书签与批注中心**：按章节分组清晰汇聚所有标记，一键即可跳转至原文对应视口，支持按类型过滤与管理。
- **结构化笔记导出**：支持将“本章”或“全书”的批注、重点或综合阅读笔记一键导出为标准 Markdown，无缝沉淀至个人知识库。

### 2. ✍️ 专业级 Markdown 编辑与排版

- **现代编辑器核心**：基于 **CodeMirror 6**，提供平滑流畅的编辑手感、语法高亮、查找替换与常用 Markdown 快捷键。
- **三重视图随心切换**：支持纯编辑、纯预览、分屏实时对照三种视图模式。
- **丰富扩展语法**：原生支持 GFM 表格、交互式任务列表、代码块高亮复制、**KaTeX 数学公式** 与 **Mermaid 流程图/图表渲染**。
- **本地资源无缝集成**：粘贴截图时自动归档至文档本地资源目录；支持一键将文档导出为美观排版的 **HTML** 或 **PDF**。

### 3. 🤖 原生 ACP 智能伴读（可选）

通过行业标准的 **Agent Client Protocol（ACP v1）**，Inkdown 可直接连通本地 Codex Agent，打造沉浸式的 AI 伴读体验：

- **深度情境感知**：Agent 无需自行解析庞大复杂的二进制电子书，而是通过应用暴露的本地 Virtual Tools 实时获知读者当前的**视口位置、可见章节大纲、选区文本以及历史批注**。
- **双向交互提案（Proposals）**：Agent 不仅能流式回答问题，还能发起划重点与做批注的交互式建议卡片，读者确认后一键落盘至原文中。
- **工作区协同**：支持拖拽工作区文件引用、粘贴图片作为附件，查看工具执行差异与文件修改权限审批。

---

## 🚀 快速开始

### 下载与安装

- 各平台正式安装包均发布于 **[GitHub Releases](https://github.com/yitom486/inkdown/releases)**（Windows `.exe` / macOS `.dmg`（Apple Silicon） / Linux `.AppImage`）。
- **应用内静默更新**：现版本 **v0.3.1** 已内置自动检查更新（自 v0.2.3 引入），启动时自动检测新版本；也可随时在「关于」或「设置 → 应用」中手动检查并一键更新。

> **从 v0.2.x 升级**：安装包 appId 已变更，旧版「轻量阅读器」无法原地自动升级，请下载新安装包覆盖或并行安装；此后同 Inkdown 安装包之间可走应用内更新。

### 基本使用

**编辑 Markdown 文档**
1. 点击“打开”选择 Markdown 文件，或打开一个工作区文件夹。
2. 在主区域编辑内容，通过顶栏切换编辑、分屏或预览视图。
3. 使用快捷键 `Ctrl+S` 保存，或通过菜单导出为 HTML / PDF。

**阅读电子书并整理笔记**
1. 在左侧文件树中点击打开任意 PDF、EPUB、MOBI、AZW3 或 AZW 文件。
2. 通过侧栏“目录”跳转章节，或使用底部导航键切换相邻正文单元。
3. 划选文本后呼出浮动工具栏，添加高亮重点、撰写批注或向 Agent 提问。
4. 打开右侧“书签与批注”面板回顾全部标记，点击“导出”生成 Markdown 笔记。

**浏览在线技术文档**
1. 在欢迎页输入目标文档 URL（如 `https://react.dev/learn`）或从最近列表直接进入。
2. 顶栏地址栏可切换同站路径，侧边栏自动提取大纲目录。
3. 享有与本地电子书完全一致的划词高亮、批注、导出与伴读提问体验。

### Agent 伴读（可选）

> Agent 是辅助增强能力，完全解耦。未配置 Agent 时，所有的本地编辑、阅读、标注与导出功能均 100% 正常使用。

1. 打开一个本地工作区文件夹（Agent 需要以工作区作为上下文环境）。
2. 本机安装 **[Bun](https://bun.sh)** 运行时（应用使用 `bunx` 自动拉起 `@agentclientprotocol/codex-acp`）。
3. 确保本机具备 Codex 登录凭证（读取 `~/.codex`）或配置有效 API Key（无需单独安装全局 Codex CLI）。

### 常用快捷键

| 快捷键 | 功能说明 |
| :--- | :--- |
| `Ctrl+O` | 打开文件或工作区文件夹 |
| `Ctrl+S` | 保存当前 Markdown 文件 |
| `Ctrl+Shift+S` | 另存为文件 |
| `Ctrl+Shift+A` | 快速展开 / 收起 Agent 伴读面板 |
| `Ctrl+F` | 编辑器内搜索与替换 |
| `Ctrl+B` | 粗体文本格式 |
| `Ctrl+I` | 斜体文本格式 |
| `Ctrl+K` | 插入超链接 |
| `Ctrl+,` | 打开系统设置 |

### 隐私与规格

- **本地优先**：电子书、Markdown、阅读进度、书签和批注默认均以本地数据格式持久化，应用不收集上传个人文献数据。
- **Agent 数据流向**：仅在主动使用 Agent 对话时，问题、当前视口文本及必要上下文才会发送给用户自主配置的 Agent 运行时。
- **格式说明**：不支持商业 DRM 加密电子书；无文本层的扫描版 PDF 支持单页 OCR（含目录 OCR、划词、Agent 读页），首次使用需从 GitHub Release 下载 OCR 运行时与语言包；排版非常规或无目录的极早期 MOBI 将尽量依据正文层级构建基础导航。

---

## 🛠️ 本地开发

前置：**Bun 1.x**（禁用 npm / yarn / pnpm）+ Git（含 submodule，`third-party/foliate-js` 为阅读后端子模块，CI 以 `submodules: recursive` 检出）。

```bash
# 1. 克隆（含子模块；已克隆则用第二行补齐）
git clone --recurse-submodules https://github.com/yitom486/inkdown.git
git submodule update --init --recursive

# 2. 安装依赖（单一根 bun.lock，不建嵌套锁）
bun install

# 3. 启动开发热重载
bun run dev
```

| 命令 | 说明 |
|------|------|
| `bun run dev` | 开发热重载（根命令自带 `--config apps/desktop/electron.vite.config.ts`，勿另传） |
| `bun run build` | 构建主进程 / preload / 渲染器三端，产物落根 `out/` |
| `bun run typecheck` | `tsconfig.web.json` + `tsconfig.node.json` 双工程类型检查 |
| `bun run test` | Vitest 全量单测 |
| `bun run test:e2e` | Playwright E2E（需先 `build`，配置 `apps/desktop/playwright.config.ts`） |
| `bun run lint:docs` | 子目录 README 与文件清单一致性（`scripts/lint-docs.ts`，CI 门禁） |
| `bun run lint:deps` | Monorepo 依赖边界 R1–R6（`scripts/check-deps.ts`，CI 门禁） |
| `bun run check:bundle` | 体积预算 + 主进程打包白名单（需先 `build`，`scripts/check-bundle.ts`，CI 门禁） |
| `bun run pack:win` | 打包 Windows 安装包（另有 `pack` / `pack:mac` / `pack:linux`，配置 `apps/desktop/electron-builder.yml`） |

**产物声明**：`out/`（`main/` / `preload/` / `renderer/` 构建输出）与 `release/`（安装包）**均落在仓库根**，两者皆已 gitignore，不提交。`apps/desktop/` 下无独立 `out/` 与 `package.json`，单根锁保留。

---

## 🗺️ Monorepo 地图

```
inkdown/
├── apps/desktop/          # 桌面应用（Electron 主进程 + React 渲染进程 + E2E/资源/三配置）
├── packages/@inkdown/*    # 私有 workspace 包（纯逻辑与契约，不独立发版）
├── scripts/               # 发版 / 文档 lint / 依赖边界 / 打包门禁脚本
├── third-party/foliate-js # EPUB/MOBI 统一阅读后端（git submodule）
├── out/ + release/        # 构建与打包产物（根目录，gitignore）
└── package.json + bun.lock # 单根依赖与 workspace 声明（packages/*）
```

### apps/desktop 三配置（根命令已自带 `--config` 引用，直接跑根命令即可）

| 配置 | 被谁引用 | 职责 |
|------|----------|------|
| `apps/desktop/electron.vite.config.ts` | `dev` / `build` / `preview` | 三端构建入口、路径别名、preload CJS 打包、pdf.js 资源拷贝 |
| `apps/desktop/electron-builder.yml` | `pack` / `pack:win` / `pack:mac` / `pack:linux` | 安装包目标、文件白名单（主进程运行时依赖）、`output: release`（落根） |
| `apps/desktop/playwright.config.ts` | `test:e2e`（含 `test:e2e:web-doc`） | E2E 目录 `apps/desktop/e2e/`、已构建应用回归 |

### packages/@inkdown/* 一句话

| 包 | 一句话 |
|----|--------|
| `@inkdown/contracts` | 跨进程契约：`Result` / `AppError`、IPC 通道与 `electron-api.types`、跨边界 DTO、稳定常量 |
| `@inkdown/reader-core` | 阅读纯逻辑：导航 / TOC / 选区 / 标记几何 / 主题排版与阅读模型 |
| `@inkdown/pdf` | PDF 原生结果归一与拼装（页码归一 / 分类映射 / 整档拼装，`normalize` / `models` / `ports`） |
| `@inkdown/ocr-core` | OCR 纯逻辑：目录抽取与重组 / 水印清洗 / 页词与质量判断，另含 `pdf-bytes` 与缓存 `ports`、外部运行时版本 pin（`inspector-pins`） |
| `@inkdown/acp` | ACP 协议纯逻辑：stdio JSON-RPC 传输 / 认证决策链 / 会话能力与 registry / 终端缓冲 / MCP RPC 与工具表（子进程与会话编排留守主进程） |
| `@inkdown/annotations` | 标注纯逻辑：标记合并 / 纯核 / Anki 构建 / Flashcard 模型与复习，另含标记提议模型（`mark-proposal` 单条·批量、`chapter-mark-plan` 章级建议） |
| `@inkdown/web-doc` | 在线文档纯逻辑：目录抽取（`extract-toc-links` / `extract-llms-toc`）与站点谓词（`hrtt` / `people-daily`） |

### shared/ 已删声明

`shared/` **已清空**（仅剩无文件的空目录，阶段 10 删除）：全部契约与纯逻辑已分别迁入 `@inkdown/contracts` / `@inkdown/reader-core` / `@inkdown/pdf` / `@inkdown/ocr-core` / `@inkdown/acp` / `@inkdown/annotations` / `@inkdown/web-doc`。新代码一律走 `@inkdown/*`，**禁止引用 `@shared`**。各目录 README 中的“原 `shared/…`”仅为迁移溯源备注。

### 路径别名

| 别名 | 指向 | 说明 |
|------|------|------|
| `@/` | `apps/desktop/src/` | 渲染进程源码 |
| `@inkdown/*` | `packages/*/src/index.ts` | workspace 包（构建与测试均已接线） |
| `@foliate` | `third-party/foliate-js` | 阅读后端子模块 |
| `@shared` | `shared/` | **已废弃**：渲染与测试工程已剔除，仅主进程构建保留兼容，新代码禁用 |

---

## 📦 发版

约定：日常把本版要点写在 `CHANGELOG.md` 顶部 `## [未发布]`（至少一条 `- ` 要点）；发版脚本自动递增版本号、归档日志、本地 commit + 打 tag。写法以 `scripts/release.ts` 头注释与根 `package.json` 为准。

```bash
# 1. 在 CHANGELOG.md 的 [未发布] 中登记本次更新特性
# 2. 先预览（不写文件、不 commit）
bun run release -- --dry-run

# 3. 发版到本地（默认 patch 自动 +1，仅本地 commit/tag）
bun run release
bun run release -- minor      # 次版本
bun run release -- major      # 主版本
bun run release -- major --push  # 递增并直接推送

# 4. 确认后推送 tag，触发 GitHub Actions 多平台打包
bun run release:push
```

**单 `--` 与双 `--`**：Bun 用 `--` 向脚本传参。`-- minor` / `-- major` 传递递增种类；`-- --push` / `-- --dry-run` 传递 flag（`--` 后再接 `--push` 写法）。`bun run release:push` 即 `scripts/release.ts -- --push` 的快捷方式。

**分支警告**：请在 **`master` 稳定分支**发版，**勿在 `refactor/monorepo` 等迁移分支打 tag**；发版前工作区必须干净且目标 tag 不存在（脚本会自动校验，不满足则中断）。

---

## 📚 文档与规范

- 开发准则与架构：[AGENTS.md](./AGENTS.md)（技术栈、目录要点、Electron/IPC、状态管理、发版摘要）+ `.cursor/rules/`（Git 身份、Zustand、阅读器导航强制细则）。
- 渲染进程总览：[`apps/desktop/src/README.md`](./apps/desktop/src/README.md)；主进程：[`apps/desktop/electron/README.md`](./apps/desktop/electron/README.md)。各子目录另有短 README：**增删文件或改文件名后必须同步更新对应 README**（机器门禁 `bun run lint:docs`，EXIT 非零即不合规）。
- 依赖边界：`packages/*` 禁 `electron` / `node:` / `react` / `@/` / 跨包相对越界，渲染非 `api/` 禁直调 `window.electronAPI`（门禁 `bun run lint:deps`，豁免须行尾 `// check-deps:allow` 并注明理由）。
- 流水线：`.github/workflows/ci.yml`（检出 `submodules: recursive` → typecheck → lint:docs → lint:deps → test → build → check:bundle → E2E）；`.github/workflows/release.yml`（tag `v*` 触发三平台打包 + GitHub Release）。
- 版本历史：[CHANGELOG.md](./CHANGELOG.md)（版本号与 Git tag 对齐）。
