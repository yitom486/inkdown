# src/components/markdown

预览与 Agent 气泡**共用**的 Markdown 渲染块。

| 文件 | 功能 |
|------|------|
| `MarkdownContent` | 按 `markdown-parts` 拆分后渲染普通段 + Mermaid |
| `MermaidBlock` | 单个 Mermaid 图（独立 hydrate，避免整段 HTML 重灌竞态） |
