# src/components

React UI。按产品域分子目录；shadcn 落在 `ui/`。

| 目录 | 管什么 |
|------|--------|
| [`ui/`](./ui/) | shadcn 基础组件（勿轻易改核心逻辑） |
| [`layout/`](./layout/) | 窗口壳、侧栏、编辑/阅读主工作区 |
| [`editor/`](./editor/) | CodeMirror Markdown 编辑器 |
| [`preview/`](./preview/) | Markdown 预览面板 |
| [`markdown/`](./markdown/) | 可复用的 Markdown/Mermaid 渲染块 |
| [`reader/`](./reader/) | EPUB / PDF / MOBI 阅读器与批注 UI |
| [`quiz/`](./quiz/) | AI 伴读考官出题、作答批卷与成绩回放 UI |
| [`agent/`](./agent/) | ACP Agent 面板与消息卡片 |
| [`shared/`](./shared/) | 跨工作区对话框、错误边界 |

命名：组件 `PascalCase.tsx`。样式优先 Tailwind + `cn()`；阅读器特殊样式见 `src/styles/`。
