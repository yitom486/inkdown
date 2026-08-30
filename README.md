# 轻量阅读器

轻量阅读器是一个本地优先的桌面工作区：在同一个窗口里编辑 Markdown、阅读电子书、整理划重点和批注，并在需要时让 Agent 结合当前文件与阅读上下文协助工作。

它适合把学习笔记、技术文档、PDF 资料和 EPUB / MOBI / AZW3 电子书放进一个文件夹，边读边写边整理。日常编辑和阅读完全可以离线使用；Agent 是可选能力。

## 能做什么

### 管理本地工作区

- 打开文件夹作为工作区，在资源管理器中浏览文件和目录。
- 支持 Markdown、文本、PDF、EPUB、MOBI、AZW3 与 AZW 文件。
- 自动刷新工作区内的新增、删除和改名；也可手动刷新。
- 在资源管理器中创建文件或目录、重命名、复制、移动和删除文件。
- 通过面包屑确认当前文件位置；文件可直接拖到 Agent 输入框作为引用。
- 深色 / 浅色主题，以及编辑、预览和阅读相关设置。

### 写 Markdown

- CodeMirror 编辑器提供 Markdown 语法高亮、查找替换和常用格式快捷键。
- 可在编辑、预览、分屏三种视图间切换，预览随内容更新。
- 支持表格、任务列表、代码高亮、KaTeX 数学公式和 Mermaid 图表。
- 支持打开、保存、另存为、自动保存和未保存修改提示。
- 粘贴本地图片时可把图片复制到文档资源目录。
- 可导出当前 Markdown 为 HTML 或 PDF。

### 阅读与做笔记

| 格式 | 阅读能力 |
| --- | --- |
| PDF | 连续滚动、目录、缩放、高 DPI 渲染、文字选择与复制、书签、重点、批注与笔记导出 |
| EPUB | 目录与章节跳转、阅读进度、主题、书签、重点、批注与笔记导出 |
| MOBI / AZW3 / AZW | 多级目录、章内锚点跳转、阅读进度、主题、书签、重点、批注与笔记导出 |

- 阅读器会保存进度；再次打开同一本书时优先回到上次位置。
- 选中文字后可复制、添加彩色重点、撰写批注，或直接把选区带到 Agent 对话。
- 纯批注以虚线标示；重点附带批注时仍保留重点底色。PDF 标记使用页面坐标保存，缩放后会重新贴合页面文字。
- “书签与批注”面板按章节分组，可筛选书签、重点、批注，点击即可回到原文，也可删除条目。
- 可导出“本章”或“全书”的批注、重点或综合笔记为 Markdown，便于复习和二次整理。

> 目录层级、分章粒度和跳转精度取决于电子书本身。经典 MOBI 常按较小节或 pagebreak 拆分；AZW3/KF8 常将整章放入一个正文单元，再由目录锚点定位小节。因此二者的底部翻页粒度可能不同，但不表示正文缺失。

## 基本使用

### 编辑文档

1. 点击“打开”选择 Markdown 文件，或先打开一个工作区文件夹。
2. 在编辑区输入内容；切到预览或分屏查看排版效果。
3. 使用 `Ctrl+S` 保存；使用“另存为”保留原文件。
4. 从“文件”菜单导出 HTML 或 PDF。

### 阅读并整理笔记

1. 在资源管理器中选择 PDF、EPUB、MOBI、AZW3 或 AZW 文件。
2. 通过上方“目录”跳转章节；底部导航用于切换相邻正文单元。
3. 选中原文后，使用浮动工具栏添加重点、批注或向 Agent 提问。
4. 点击“添加书签”保存当前位置。
5. 打开“书签与批注”，按章节回顾标记；需要时从“导出”选择范围和内容类型。

对于 AZW3 中的章内小节跳转，阅读区会在标题上方保留可见空间，避免标题被工具栏遮住。

## Agent（可选）

右侧 Agent 面板通过 ACP 连接本机可用的 Codex Agent。它不是阅读器启动所必需的：未配置 Agent 时，编辑、阅读、书签、批注和导出仍可正常使用。

- 支持新建、切换和恢复本地对话历史，流式显示回答、计划、工具调用和文件差异。
- 可将工作区文件拖入输入框，也可粘贴图片作为附件。
- 发送问题时会附带当前文档、工作区和阅读状态；选区提问会保留选中的原文。
- Agent 可以通过应用提供的本地工具读取当前阅读目录、可见内容、当前章节、阅读标记并检索正文；它不需要自行解析电子书二进制文件。
- 涉及文件改动时，界面会展示对应操作、差异或权限请求，便于确认实际影响。

使用 Agent 前，请先打开一个工作区文件夹（它需要工作目录），并安装 [Bun](https://bun.sh)。应用会使用 `bunx` 启动 `@agentclientprotocol/codex-acp`；安装包不会捆绑 Bun 或 Agent 运行时。

Windows：

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

macOS / Linux：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装后重新打开终端，确认 `bun` / `bunx` 可用。首次连接还需要本机已有 Codex 登录状态（`~/.codex`）或可用 API Key；不需要另行安装 Codex CLI。

## 常用快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+O` | 打开文件或工作区 |
| `Ctrl+S` | 保存当前 Markdown 文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+F` | 查找 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+Shift+A` | 打开或关闭 Agent 面板 |

## 限制与隐私

- 带 DRM 加密的 EPUB、MOBI、AZW3 或 AZW 文件无法直接读取。
- 扫描版 PDF 若不含文本层，可以查看页面，但不能选择文字、划重点或添加基于选区的批注。
- 少数旧版 MOBI 可能没有有效目录；应用会尽量从可读正文生成基础导航。
- 文件内容、阅读进度、书签和批注默认保存在本机。只有主动使用 Agent 时，问题、选区和 Agent 所需上下文才会交给你配置的 Agent 服务处理。

## 下载、安装与开发

Windows 安装包通过 [GitHub Releases](../../releases) 发布。下载 `.exe` 后按安装向导操作，可自行选择安装目录。

项目使用 Bun；开发时不要改用 npm、yarn 或 pnpm。

```bash
bun install
bun run dev
bun run typecheck
bun run test
bun run build
```

生成 Windows 安装包：

```bash
bun run pack
```

主要技术组成：Electron、React、TypeScript、CodeMirror 6、markdown-it、pdf.js、epub.js、`@lingo-reader/mobi-parser` 与 ACP。项目开发约定见 [AGENTS.md](./AGENTS.md)。

## 发布版本

只有推送版本 tag 才会触发 GitHub Actions 打包发布，普通 `git push` 不会创建 Release。

```bash
git tag v0.2.1
git push origin master
git push origin v0.2.1
```

发布工作流位于 [`.github/workflows/release.yml`](./.github/workflows/release.yml)。
