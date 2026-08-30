# src/components/reader

电子书阅读 UI：EPUB / PDF / MOBI（含 AZW3）。

| 文件 | 功能 |
|------|------|
| `EpubViewer` / `PdfViewer` / `MobiViewer` | 各格式主 Viewer |
| `PdfPageView` | PDF 单页（渲染 + text layer + 批注 overlay） |
| `ReaderContentShell` / `ReaderToolbarShell` / `ReaderFooterNav` | 阅读区壳、工具栏、底栏翻页 |
| `ReaderUnitOutline` / `EpubChapterOutline` | 目录大纲 |
| `ReadingMarkPanel` / `ReadingMarkPopover` | 书签/批注列表（按目录分组、当前章展开；含导出）与点击编辑浮层 |
| `SelectionToolbar` | 划选工具条（划重点、问 Agent、批注等） |
| `AnnotationNoteDialog` | 批注输入对话框 |
| `EpubMarkTooltip` / `ReadingProgressRing` | EPUB 批注提示、进度环 |

导航状态在 `reader-navigation-store`；纯逻辑在 `src/lib/reader/`。
