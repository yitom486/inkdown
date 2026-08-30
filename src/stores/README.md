# src/stores

Zustand 本地状态（可 persist）。IPC / 服务端数据用 TanStack Query（`src/api/`），不要塞进这里。

Selector 返回对象时必须 `useShallow`：见 `.cursor/rules/zustand-selectors.mdc`。  
阅读器导航粒度：见 `.cursor/rules/reader-navigation.mdc`。

| 文件 | 功能 |
|------|------|
| `editor-ui-store.ts` | 主题、视图模式、侧栏、各文件滚动位置等编辑器 UI |
| `app-settings-store.ts` | 用户设置（自动保存间隔、verbose 日志等） |
| `active-document-store.ts` | 当前打开文档路径/类型（供 Agent turn-context 等） |
| `draft-store.ts` | 未保存草稿（localStorage） |
| `error-log-store.ts` | 渲染端错误日志列表 |
| `reader-navigation-store.ts` | 阅读器目录 / flatIndex / 当前章（侧栏与底栏共用） |
| `reading-progress-store.ts` | 阅读进度百分比等 |
| `reading-mark-panel-store.ts` | 标记侧栏筛选（重点/批注/书签，persist） |
| `acp-ui-store.ts` | Agent 线程、消息、连接状态、权限与配置偏好 |
| `annotation-agent-store.ts` | 批注 AI 助手：按书线程、独立 agentSessionId、pendingDraft |
| `acp-chat-types.ts` | Agent 聊天消息结构与解析辅助（非独立 store） |
