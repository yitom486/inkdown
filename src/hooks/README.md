# src/hooks

渲染进程 React Hook。按产品域分子目录；组件通过 `@/hooks/<域>/useXxx` 引用。  
**不要**在根目录再堆新文件。IPC 封装在 `src/api/`，本地 UI 状态在 `src/stores/`，本目录只放「把数据接到组件」的胶水。

| 目录 | 管什么 |
|------|--------|
| `editor/` | Markdown 编辑：预览、草稿、自动保存、导出、粘贴图、滚动同步 |
| `preview/` | 预览 DOM 增强：代码块复制、hljs 主题、Mermaid（预览与 Agent 气泡共用） |
| `reader/` | EPUB / PDF / MOBI：二进制加载、侧栏、书签批注、高亮浮层 |
| `workspace/` | 工作区壳：打开/保存文件、文件树、侧栏折叠、全局错误 |
| `agent/` | ACP Agent 会话 |

---

## editor/

| 文件 | 功能 |
|------|------|
| `useMarkdownPreview` | 把 Markdown debounce 渲染成消毒后的 HTML（含本地图片转 data URL） |
| `useScrollSync` | 编辑器 ↔ 预览滚动同步，并记住各文件滚动位置 |
| `usePasteImage` | 粘贴图片写入文档旁目录，返回 Markdown 相对路径 |
| `useExportDocument` | 当前文档导出 HTML / PDF |
| `useAutoSave` | 按设置间隔对已保存且 dirty 的文件自动保存 |
| `useDraftPersistence` | dirty 内容 debounce 写入本地草稿；`clearDraftForFile` 保存后清草稿 |
| `useDraftRecovery` | 启动时检测可恢复草稿（`useDraftRecoveryPrompt`） |

## preview/

| 文件 | 功能 |
|------|------|
| `useCodeBlockCopy` | 容器内 `.code-block-copy` 点击复制代码 |
| `useHighlightTheme` | 随亮/暗色切换 highlight.js 样式（预览与 Agent 共用） |
| `useMermaidInContainer` | 在容器内 hydrate `.mermaid` 节点。当前预览/Agent 已改独立块，此 Hook **暂无引用** |

## reader/

| 文件 | 功能 |
|------|------|
| `useReaderBinary` | TanStack Query 读电子书二进制 |
| `useReadingMarks` | 当前文档书签 / 高亮 / 批注的 list + create/update/delete |
| `useDeferredReaderLayout` | 等待 iframe 排版稳定后合并执行标记几何重算 |
| `useReadingMarkInspector` | 点击高亮后的浮层：命中栈、当前标记、位置 |
| `useReaderSidePanels` | 目录侧栏与标记侧栏互斥开关 |
| `useReaderWheelNavigation` | 滚轮到顶/底翻页。逻辑已抽出，Viewer 里仍有内联调用，此 Hook **暂无引用** |

## workspace/

| 文件 | 功能 |
|------|------|
| `useFileOperations` | 打开/保存/另存、工作区扫描；正文 `content` / `filePath` 的源头。另导出 `useAppMeta` |
| `useFileTreeActions` | 文件树新建、重命名、删除、复制粘贴、导出 |
| `useSidebarPanelSync` | 布尔可见性 ↔ `react-resizable-panels` 折叠（`useCollapsiblePanelSync`） |
| `useGlobalErrorHandlers` | 捕获未处理 Promise / `window.error`，并同步 verbose 日志开关 |

## agent/

| 文件 | 功能 |
|------|------|
| `useAcpSession` | 连接 ACP、发 prompt、流式消息、权限与配置；Agent 面板主状态机 |
| `useAnnotationAgentAssist` | 批注对话框：独立 ACP session；意图/写成批注 → 不进右侧时间线 |
| `useStickToBottomScroll` | Agent 消息列表贴底滚动；`streaming` 时 rAF 合并 ResizeObserver；返回 `pinned` / `scrollToBottom` |

---

新 Hook：先对号入座再新建文件。跨域共用的预览 DOM 行为放 `preview/`，不要复制一份到 `agent/`。  
各子目录另有短 README，文件表以**本文件**为准。
