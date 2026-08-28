# 轻量阅读器

基于 **Electron + React** 的桌面应用：Markdown 编辑 + 多格式电子书阅读。  
产品中文名 **轻量阅读器**；仓库名仍为 `markdown-editor`（历史原因）。

## 下载

> **GitHub Releases** 提供 Windows 安装包（`.exe`）。  
> 首发版本 **v0.1.x 不含 AI 功能**，专注编辑与阅读；AI Agent 计划在 **v0.2.x** 通过 [ACP](https://agentclientprotocol.com/) 接入。

| 版本 | 说明 | 下载 |
|------|------|------|
| v0.1.x | Markdown + PDF/EPUB/MOBI/AZW3，书签批注 | [Releases](../../releases) |
| v0.2.x（计划） | 上述全部 + AI Agent 侧栏（Codex / ACP） | 待发布 |

### 如何发新版本（维护者）

**不是**每次 `git push` 都会发版；只有 **推送版本 tag** 才会自动打包并发布：

```bash
# 更新 package.json 版本号 → 提交 → 打 tag → 推送 tag
git tag v0.1.0
git push origin master
git push origin v0.1.0
```

GitHub Actions 工作流 [`.github/workflows/release.yml`](./.github/workflows/release.yml) 会在 Windows 上执行 `bun run pack`，并将 `.exe` 上传至 Releases。

详细说明见 [`.plan/2026-08-29-GitHub发布与版本路线.md`](./.plan/2026-08-29-GitHub发布与版本路线.md)。

---

## 当前功能（v0.1）

### Markdown 编辑器

- CodeMirror 6 语法高亮、分屏实时预览
- KaTeX 公式、Mermaid 图表、GFM 表格/任务列表
- 快捷键（Ctrl+B/I/K）、查找替换、主题切换
- 打开/保存/另存为、未保存提示、自动保存（可选）
- 导出 PDF / HTML、粘贴图片到 assets

### 电子书阅读（只读）

| 格式 | 能力 |
|------|------|
| PDF | 连续滚动、高清渲染、选区复制 |
| EPUB | 目录、章节导航、主题、书签/高亮/批注 |
| MOBI / AZW3 | KF8 解析、目录、一级章节切换、书签/批注 |

### 其他

- 工作区侧栏（文件夹扫描、文件变更自动刷新）
- 深色 / 浅色主题、设置面板（`Ctrl+,`）

---

## 路线图

### 已完成

- [x] Markdown 编辑器核心（编辑、预览、导出）
- [x] PDF / EPUB 阅读 MVP
- [x] MOBI / AZW3 双格式解析与阅读
- [x] 跨格式书签、高亮、批注
- [x] Windows NSIS 安装包（`bun run pack`）

### 进行中

- [ ] 电子书体验收尾（PDF 虚拟滚动优化等，见 `.plan/`）
- [ ] **GitHub Releases 首发 v0.1.0**（无 AI 安装包）

### 计划中 — AI Agent（v0.2+）

通过 **[Agent Client Protocol (ACP)](https://agentclientprotocol.com/)** 对接已有 Agent 运行时，**不自研大模型或 Agent 引擎**。

| 能力 | 说明 | 目标版本 |
|------|------|----------|
| ACP Client | 主进程 stdio JSON-RPC，IPC 桥接渲染进程 | v0.2.0 |
| Codex 适配器 | 对接 [`codex-acp`](https://github.com/agentclientprotocol/codex-acp) | v0.2.0 |
| Agent 侧栏 | 流式对话、取消、连接状态 | v0.2.0 |
| 工作区上下文 | 会话 `cwd` 绑定当前工作区 | v0.2.0 |
| 工具权限 | 写文件/工具调用前用户确认 | v0.2.0 |
| 文件读写回调 | Agent 经 ACP 读取/修改项目内文件 | v0.3.0 |
| 多 Agent 配置 | 可选 Gemini CLI、Claude 等适配器 | v0.3.0+ |

**重要说明：**

- **v0.1 安装包不包含 AI**，也无需 API Key 即可使用编辑/阅读功能。
- **v0.2 起**，AI 为可选模块：用户需自行安装 Agent 运行时（如 `codex-acp`）并配置 `OPENAI_API_KEY` 或 `CODEX_API_KEY`；密钥**不会**写入应用或仓库。
- 开发计划详见 [`.plan/2026-08-29-ACP客户端.md`](./.plan/2026-08-29-ACP客户端.md)。

#### AI 前置条件（v0.2 发布后）

```bash
# 运行 Codex ACP 适配器（示例；应用内将自动 spawn）
bunx -y @agentclientprotocol/codex-acp

# 环境变量（任选其一）
set OPENAI_API_KEY=sk-...
# 或
set CODEX_API_KEY=...
# Electron 桌面环境建议禁用浏览器 OAuth
set NO_BROWSER=1
```

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 包管理 | [Bun](https://bun.sh) |
| 桌面 | Electron + electron-vite |
| 前端 | React + TypeScript + shadcn/ui + Tailwind |
| 编辑器 | CodeMirror 6 |
| 电子书 | pdf.js、epub.js、@lingo-reader/mobi-parser |
| 测试 | Vitest + Playwright |
| 打包 | electron-builder（Windows NSIS） |

架构与开发准则见 [AGENTS.md](./AGENTS.md)。

---

## 快速开始（开发）

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 类型检查 + 单元测试 + 构建 + E2E
bun run test:all

# 打包 Windows 安装程序（输出到 release/）
bun run pack
```

## 添加 shadcn 组件

```bash
bunx shadcn@latest add dialog
```

> Windows：若组件生成到 `@/` 而非 `src/components/ui/`，需手动移动到正确位置。

---

## 项目结构

```
start/
├── electron/          # 主进程、preload、IPC、services
├── src/               # React 渲染进程
├── shared/            # 跨进程类型与 IPC 契约
├── e2e/               # Playwright E2E
├── .plan/             # 开发计划与路线图
└── resources/         # 应用图标等资源
```

更多细节见 [AGENTS.md](./AGENTS.md) 与 [`.plan/README.md`](./.plan/README.md)。

---

## 许可证

见 [LICENSE](./LICENSE)（若尚未添加，发版前补充）。
