<div align="center">

<img src="./resources/icon.png" alt="Inkdown Logo" width="100" height="100" />

# Inkdown

**本地优先的「阅读 · 写作 · Agent 伴读」三位一体桌面知识工作区**  
*Local-First Desktop Workspace for Reading, Writing, and Thinking with Agent*

[![Release](https://img.shields.io/github/v/release/yitom486/inkdown?color=3b82f6&label=Release)](https://github.com/yitom486/inkdown/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/yitom486/inkdown/releases)
[![Package Manager](https://img.shields.io/badge/Bun-1.x-black?logo=bun)](https://bun.sh)
[![Tests](https://img.shields.io/badge/Tests-608%20passed-success)](./vitest.config.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](./tsconfig.json)

[下载安装](#-下载与安装) • [核心特性](#-核心特性) • [基本使用](#-基本使用) • [Agent 伴读](#-agent-伴读可选) • [快捷键](#️-常用快捷键) • [更新日志](./CHANGELOG.md)

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

## 🚀 基本使用

### 编辑 Markdown 文档
1. 点击“打开”选择 Markdown 文件，或打开一个工作区文件夹。
2. 在主区域编辑内容，通过顶栏切换编辑、分屏或预览视图。
3. 使用快捷键 `Ctrl+S` 保存，或通过菜单导出为 HTML / PDF。

### 阅读电子书并整理笔记
1. 在左侧文件树中点击打开任意 PDF、EPUB、MOBI、AZW3 或 AZW 文件。
2. 通过侧栏“目录”跳转章节，或使用底部导航键切换相邻正文单元。
3. 划选文本后呼出浮动工具栏，添加高亮重点、撰写批注或向 Agent 提问。
4. 打开右侧“书签与批注”面板回顾全部标记，点击“导出”生成 Markdown 笔记。

### 浏览在线技术文档
1. 在欢迎页输入目标文档 URL（如 `https://react.dev/learn`）或从最近列表直接进入。
2. 顶栏地址栏可切换同站路径，侧边栏自动提取大纲目录。
3. 享有与本地电子书完全一致的划词高亮、批注、导出与伴读提问体验。

---

## 🤖 Agent 伴读（可选）

> **说明**：Agent 是辅助增强能力，完全解耦。未配置 Agent 时，所有的本地编辑、阅读、标注与导出功能均 100% 正常使用。

### 前置准备

1. 打开一个本地工作区文件夹（Agent 需要以工作区作为上下文环境）。
2. 本机安装 **[Bun](https://bun.sh)** 运行时（应用使用 `bunx` 自动拉起 `@agentclientprotocol/codex-acp`）：
   - **Windows**（PowerShell）：
     ```powershell
     powershell -c "irm bun.sh/install.ps1|iex"
     ```
   - **macOS / Linux**（终端）：
     ```bash
     curl -fsSL https://bun.sh/install | bash
     ```
3. 确保本机具备 Codex 登录凭证（读取 `~/.codex`）或配置有效 API Key（无需单独安装全局 Codex CLI）。

---

## ⌨️ 常用快捷键

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

---

## 🔒 隐私、离线与规格说明

- **本地优先**：所有电子书、Markdown 文件、阅读进度、书签和批注默认均以本地数据格式持久化存储，应用绝不收集上传个人文献数据。
- **Agent 数据流向**：仅在主动使用 Agent 对话时，读者发送的问题、当前视口文本及必要上下文才会发送给用户自主配置的 Agent 运行时处理。
- **格式说明**：
  - 不支持附带商业 DRM 加密的各类电子书格式；
  - 无文本层的扫描版 PDF 仅支持纯页面图像查看与缩放，暂无法进行文字层选区和基于文本坐标的高亮划线；
  - 部分排版非常规或未声明目录结构的极早期 MOBI 电子书，应用将尽可能依据正文层级构建基础导航。

---

## 📦 下载与安装

- 编译完成的各平台正式安装包均发布于 **[GitHub Releases](https://github.com/yitom486/inkdown/releases)**（支持 Windows `.exe` / macOS `.dmg` / Linux `.AppImage`）。
- **应用内静默更新**：v0.2.3 及以上版本内置自动检查更新功能，启动时会自动检测新版本；也可随时在「关于」或「设置 → 应用」中手动检查并一键更新。

---

## 🛠️ 本地开发与构建

项目采用严谨的 TypeScript + Bun 体系构建，遵循代码安全与进程隔离规范：

```bash
# 1. 安装依赖（请使用 Bun，禁止使用 npm/yarn/pnpm）
bun install

# 2. 启动本地开发热重载
bun run dev

# 3. 类型检查与单元测试
bun run typecheck
bun run test

# 4. 构建跨平台桌面应用
bun run build

# 5. 打包本地可执行安装包
bun run pack
```

### 发布新版本

版本号遵循自动化管理机制（默认自动递增 patch 版本号）：

```bash
# 1. 在 CHANGELOG.md 的 [未发布] 中登记本次更新特性
# 2. 执行发版脚本（自动更新版本号、归档日志、打 Tag）
bun run release          # 默认 patch 自增
# bun run release -- minor
# bun run release -- major

# 3. 推送至远端，自动触发 GitHub Actions 多平台打包流水线
bun run release:push
```

项目架构与编码规范请参考 [AGENTS.md](./AGENTS.md)。
