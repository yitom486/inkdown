# 轻量阅读器

轻量阅读器是一款 Windows 桌面应用，把 Markdown 写作和电子书阅读放在同一个工作区中。它适合整理本地文档、编写 Markdown，以及阅读 PDF、EPUB、MOBI 和 AZW3 文件。

编辑与阅读开箱即用。可选的 AI Agent 侧栏需要本机另装 [Bun](https://bun.sh)，见下方「AI Agent」。

## 主要功能

### Markdown 编辑

- 使用语法高亮编辑 Markdown，实时查看排版结果
- 支持标题、列表、引用、代码块、表格和任务列表
- 支持 KaTeX 数学公式与 Mermaid 图表
- 支持查找替换、粗体、斜体、链接等常用编辑操作
- 支持打开、保存、另存为和可选的自动保存
- 文件有未保存修改时给出明确提示
- 粘贴本地图片时可复制到文档的资源目录
- 可将文档导出为 HTML 或 PDF

### 电子书阅读

| 格式 | 当前支持的能力 |
| --- | --- |
| PDF | 连续滚动、缩放与高清渲染、文本选择和复制、目录导航 |
| EPUB | 目录导航、章节切换、阅读进度、主题、书签、高亮和批注 |
| MOBI | 目录导航、章节或小节切换、阅读进度、主题、书签、高亮和批注 |
| AZW3 | 多级目录、章内小节跳转、阅读进度、主题、书签、高亮和批注 |

阅读器会记住最近阅读的章节。再次打开同一本书时，会优先恢复到上次的阅读位置。

> MOBI 与 AZW3 的分章方式由电子书文件自身决定。经典 MOBI 经常把正文拆成较小的节或 pagebreak；AZW3/KF8 通常把整章放在一个正文单元中，再通过目录锚点定位章内小节。因此，两种格式的换章粒度可能不同，这并不代表正文缺失。

### 本地文件管理

- 打开一个文件夹作为工作区
- 在资源管理器中浏览 Markdown 和电子书文件
- 自动刷新新增、删除或改名后的文件
- 使用面包屑查看当前文件位置
- 深色与浅色主题
- 通过设置面板调整编辑器和阅读体验

## 基本使用方法

### 编辑 Markdown

1. 点击“打开”，选择 Markdown 文件或工作区文件夹。
2. 在编辑区输入内容，右侧预览会自动更新。
3. 使用 `Ctrl+S` 保存；需要保留原文件时使用“另存为”。
4. 通过“导出”生成 HTML 或 PDF 文件。

### 阅读电子书

1. 在资源管理器中选择 PDF、EPUB、MOBI 或 AZW3 文件。
2. 点击阅读区上方的“目录”打开章节列表。
3. 点击目录项跳转到对应章节或小节。
4. 使用底部导航切换上一个或下一个正文单元。
5. 选中文字后可以复制、划重点、填写批注，或把选区加入 Agent 对话。
6. 点击“添加书签”保存当前阅读位置。

对于一个正文单元中包含多个小节的 AZW3 文件，点击目录后会在目标标题上方保留一定距离，方便确认跳转位置。

## 常用快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存当前 Markdown 文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+F` | 查找 |
| `Ctrl+,` | 打开设置 |

## 下载与安装

Windows 安装包通过 [GitHub Releases](../../releases) 发布。下载 `.exe` 后按安装向导操作，可自行选择安装目录。

| 版本 | 内容 |
| --- | --- |
| v0.1.x | Markdown 编辑、PDF/EPUB/MOBI/AZW3 阅读、书签与批注 |
| v0.2.x | 可选 AI Agent 侧栏（ACP + Codex）；阅读与编辑不依赖 AI |

## AI Agent

阅读、编辑、书签和批注**不需要** Bun。只有使用右侧 Agent 时，才需要本机安装 Bun：应用通过 `bunx` 动态启动 `@agentclientprotocol/codex-acp`（安装包内不捆绑该运行时）。

Windows：

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

macOS / Linux：

```bash
curl -fsSL https://bun.sh/install | bash
```

装好后新开一个终端，确认 `bun` / `bunx` 可用。首次连接 Agent 时会下载适配器，还需本机已有 Codex 登录（`~/.codex`）或 API Key。不必单独再装 Codex CLI。

## 当前限制

- 电子书的目录质量、标题层级和分章粒度取决于文件自身的制作质量。
- 带 DRM 加密的 EPUB、MOBI 或 AZW3 文件无法直接读取。
- 扫描版 PDF 如果没有文本层，只能查看页面，不能直接选择文字。
- 少数旧版 MOBI 文件可能缺少有效目录；应用会尝试根据可读正文生成基础章节列表。
- Agent 不会打进安装包；未安装 Bun 或未完成 Codex 认证时，编辑与阅读仍可正常使用。

## 隐私与数据

- 文档和电子书默认在本机处理，不会自动上传。
- 阅读进度、书签和批注保存在本地应用数据中。
- 编辑与阅读不需要账号。使用 Agent 时会走本机 Codex 登录或你配置的 API Key。

## 本地开发

项目使用 Bun，日常开发不要改用 npm、yarn 或 pnpm。

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

主要技术组成：Electron、React、TypeScript、CodeMirror 6、markdown-it、pdf.js、epub.js 和 `@lingo-reader/mobi-parser`。开发约定与项目结构见 [AGENTS.md](./AGENTS.md)。

## 发布版本

只有推送版本 tag 才会触发 GitHub Actions 打包发布，普通 `git push` 不会创建 Release。

```bash
git tag v0.1.0
git push origin master
git push origin v0.1.0
```

发布工作流位于 [`.github/workflows/release.yml`](./.github/workflows/release.yml)。
