# src/components/layout

应用壳与主工作区布局（非阅读器内部工具栏）。

| 文件 | 功能 |
|------|------|
| `WorkspaceShell` | 顶栏 + ActivityBar + 可折叠侧栏 + 主区 + Agent 面板 |
| `TitleBar` / `ActivityBar` | 标题栏与左侧活动条 |
| `Sidebar` / `FileExplorer` / `FileBreadcrumb` | 文件树与面包屑；无工作区且打开在线文档时展示当前页 / 最近 URL；有工作区时侧栏底部可输入网址 |
| `WebDocUrlField` / `WebDocSidebarPanel` | 在线文档 URL 输入（欢迎页与侧栏共用） |
| `DocumentOutline` | Markdown 大纲 |
| `EditorWorkspaceMain` | Markdown 编辑 + 预览分栏 |
| `ReaderWorkspaceMain` | 电子书阅读主区入口 |
| `WebDocWorkspaceMain` | 在线文档阅读主区（顶栏地址栏 + Viewer）；向侧栏上报本页标题大纲 |
| `WebDocAddressBar` | 在线文档 URL 输入与最近列表 |
| `ViewModeToggle` / `SplitPane` | 编辑/预览/分屏切换 |
| `WelcomePage` | 无打开文件时的欢迎页（含在线文档 URL 入口） |
