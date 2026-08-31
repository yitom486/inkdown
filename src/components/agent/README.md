# src/components/agent

ACP Agent 面板（壳自研；消息渲染可复用 Markdown/Mermaid 块）。

| 文件 | 功能 |
|------|------|
| `AgentPanel` | 右侧 Agent 主面板 |
| `AgentComposer` | 输入框、附件、选区标记 |
| `AgentChatItem` / `AgentMessageBubble` / `AgentMermaidBlock` | 消息列表与气泡 |
| `AgentToolCallCard` / `AgentDiffPreview` / `AgentPlanCard` | 工具调用、diff、计划 |
| `ProposeMarkChatBlock` / `ProposeMarkBlockList` / `ProposeMarkCard` | 聊天气泡内可折叠提议块（含批量勾选采用） |
| `ChapterMarkPlanCard` | 章级划重点建议（用户点选章后继续 Agent） |
| `AgentBlockRenderer` | 兼容入口（tool 消息） |
| `AgentPermissionHost` / `AgentPermissionCard` | 权限请求 UI |
| `AgentSnapshotHost` | 向主进程提供 Inkdown 内存快照（MCP） |
| `AgentAuthDialog` / `AgentHistoryMenu` | 认证与历史线程 |
| `AgentActivityGroup` / `AgentMark` | 活动分组与选区标记展示 |

会话状态机：`src/hooks/agent/useAcpSession`；UI 状态：`acp-ui-store`。
