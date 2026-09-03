# src/lib

渲染进程**纯逻辑**（无 React Hook）。按产品域分子目录；通过 `@/lib/<域>/模块` 引用。  
**不要**在根目录再堆新文件。例外：`utils.ts` 是 shadcn 的 `cn()`，必须留在 `@/lib/utils`。

组件胶水在 `src/hooks/`，IPC 在 `src/api/`，UI 状态在 `src/stores/`。

| 目录 | 管什么 |
|------|--------|
| `editor/` | Markdown 解析/编辑/导出、CodeMirror、草稿、换行规范化 |
| `preview/` | 预览 DOM：代码块复制、消毒、Mermaid hydrate |
| `reader/` | EPUB / PDF / MOBI / **在线文档 HTML** 导航、选区、高亮批注、渲染 |
| `workspace/` | 文件树、对话框路径、全局错误上报 |
| `agent/` | ACP 会话辅助；`context/` 为 Inkdown 注入 Agent 的 Skill / 快照 / 选区 |

---

## 根目录

| 文件 | 功能 |
|------|------|
| `utils.ts` | `cn()`（clsx + tailwind-merge）。shadcn 组件依赖此路径，勿移动 |

## editor/

| 文件 | 功能 |
|------|------|
| `markdown` | markdown-it 解析器（预览与导出同源） |
| `markdown-parts` | 把 Markdown 拆成普通段 / Mermaid 块 |
| `markdown-headings` | 标题大纲、滚动比例 |
| `markdown-images` | 本地图片路径 ↔ data URL |
| `markdown-editing` / `markdown-editor-commands` | 编辑器格式化与快捷键 |
| `code-highlight` / `code-block-lines` | 代码高亮与行号 |
| `codemirror-theme` / `codemirror-syntax-linter` / `codemirror-paste-image` | CodeMirror 主题、语法 gutter、粘贴图 |
| `export-document` / `export-document-styles` | 导出 HTML/PDF 的文档与样式 |
| `draft-utils` | 草稿 key 与可恢复草稿挑选 |
| `editor-focus` | 判断 Markdown 编辑器是否聚焦 |
| `text-normalize` | 换行规范化 |

## preview/

| 文件 | 功能 |
|------|------|
| `preview-sanitize` | 预览 HTML 消毒选项 |
| `code-block-copy` / `code-block-chrome` | 代码块「复制」按钮 DOM 与共享工具栏 HTML |
| `mermaid-hydrate` / `mermaid-debug` | 在容器内渲染 Mermaid |

## reader/

按前缀找文件即可，不逐条列举：

| 前缀 | 功能 |
|------|------|
| `reader-*` | 跨格式导航（flatIndex / 视口 / 翻页 / 目录树 / 选区关闭） |
| `reading-mark-*` / `reader-mark-*` | 高亮颜色、命中、标签、几何 |
| `reading-mark-passages` / `export-reading-notes` / `export-anki-cards` / `save-reading-notes-export` / `reading-mark-kind-filters` | 划重点收集、按章 Markdown 导出、Anki 记忆卡片导出、侧栏类型筛选 |
| `epub-*` | EPUB 目录、主题、选区、批注 overlay、滚动定位 |
| `pdf-*` | PDF 打开/渲染/目录/选区/批注 overlay |
| `mobi-*` / `kindle-*` / `azw3-*` | MOBI/Kindle 初始化、章节 HTML、导航、选区、批注（含 `renderWebMarkOverlays`） |
| `web-doc-html` / `web-doc-chrome` / `web-doc-site` / `web-doc-toc` / `web-doc-outline` / `web-doc-agent-content` / `web-doc-code-blocks` / `web-doc-math` | 在线文档正文提取、页头剥离、URL/目录、**本页标题大纲**、Agent 按页抓文、代码块复制/多语言 Tab、KaTeX 公式 |

## workspace/

| 文件 | 功能 |
|------|------|
| `file-tree-ops` | 文件树路径、剪贴板、粘贴目标 |
| `quick-open` | 全局快速切换（扁平化文件树、模糊匹配与评分排序） |
| `dialog-default-path` | 打开/保存对话框默认目录 |
| `workspace-session` | 启动时恢复上次文件 / 在线文档 |
| `report-error` / `error-reporter` | AppError 与运行时错误上报 |
| `path-utils.test` / `document-types.test` | 测的是 `@shared` 路径与文档类型，放在工作区侧 |

## agent/

| 文件 | 功能 |
|------|------|
| `acp-composer` | 输入框附件、工作区路径拖入 |
| `acp-permission` / `acp-permission-ui` | 权限请求与卡片展示 |
| `acp-plan` | 计划条目解析与进度摘要 |
| `acp-config-preferences` | Mode/Model 等配置记忆 |
| `acp-session-restore` / `acp-thread-prune` / `acp-prune-agent-replies` | 会话恢复与线程修剪 |
| `acp-dev-log` / `acp-layout-probe` | 开发日志与布局探测 |
| `agent-markdown` | Agent 气泡 Markdown（与预览同源解析） |
| `annotation-note-prompts` | 批注 AI 意图/改写 chip 与草稿抽取 |
| `enrich-tool-message` | tool 消息 enrich（提议卡 + 章级建议） |
| `tool-failure-message` | 工具失败 → 聊天气泡内业务说明（折叠标题 + 展开正文） |
| `parse-chapter-mark-plan` / `promote-chapter-mark-plans` | 章级划重点 tool 解析与 promote |
| `mark-proposal-failure` | 提议/采用失败分类与「打开该章 / 去划词」引导 |

`agent/context/`（原 `agent-context/`）：静态 Skill、turn-context、阅读器内容/选区/标记 registry、MCP 快照序列化；标记提议统一走 `propose-mark`（`inkdown_propose_mark`）。

---

新模块先对号入座。预览 DOM 行为放 `preview/`，不要在 `agent/` 再复制一份。  
各子目录另有短 README，文件表以**本文件**为准。
