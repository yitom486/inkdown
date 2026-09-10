# src/components/reader

电子书阅读 UI：EPUB / PDF / MOBI（含 AZW3）与**在线文档**。

| 文件 | 功能 |
|------|------|
| `WebDocViewer` | 在线文档阅读（iframe 阅读模式、划词批注、标记侧栏与导出、本页标题大纲） |
| `FoliateReaderViewer` | EPUB / MOBI / AZW3 统一阅读（foliate 后端：章节导航、划词批注、标记侧栏与导出） |
| `PdfViewer` | PDF 主 Viewer（Agent 正文走 WASM 结构化阅读顺序，失败回退 pdf.js；UI/选区坐标系不动） |
| `PdfPageView` | PDF 单页（渲染 + text layer + 批注 overlay） |
| `PdfOcrBanner` / `PdfOcrTocEditor` | 扫描版 OCR 提示与目录校正（含偏移自动推算、AI 整理槽位） |
| `TocAiPolishControl` | 目录 AI 整理：目录副会话 + 模型/思考档选择 + JSON 解析回填草稿 |
| `ReaderContentShell` / `ReaderToolbarShell` / `ReaderFooterNav` | 阅读区壳、工具栏、底栏翻页 |
| `ReaderUnitOutline` / `EpubChapterOutline` | 目录大纲 |
| `ReaderTypographyControls` | 阅读排版控件（字号 / 行距） |
| `ReadingMarkPanel` / `ReadingMarkPopover` | 书签/批注列表（目录层级、类型筛选、当前章展开；含导出）与点击编辑浮层 |
| `FlashcardReviewDialog` | 沉浸式 3D 闪卡复习弹窗（挖空遮罩、正反翻转、原书一键秒回与记忆打分） |
| `SelectionToolbar` | 划选工具条（划重点、问 Agent、批注等） |
| `AnnotationNoteDialog` | 批注输入；可选 AI 意图/结果 chip 与草稿确认 |
| `BodyWatermarkPreviewDialog` | 正文水印清洗预览 + 二次确认应用（只读计数/样例 + 签名展示，确认态展示统计/签名，确认后调应用通道，成功展示备份路径/结果；确认前不写库） |
| `PdfBookSearch` | 已入库书手动正文搜索（工具栏搜索框 + 结果面板；只读复用 `queryBook(kind='search')`，≥3 字才请求，最多 20 条，点击跳页；逻辑在 `src/lib/reader/pdf-book-search`） |
| `ProposeMarkChatBlock`（经 Agent 气泡内嵌） | 正式 Agent / 批注助手会话内批注提议 |
| `EpubMarkTooltip` / `ReadingProgressRing` | EPUB 批注提示、进度环 |

导航状态在 `reader-navigation-store`；纯逻辑在 `src/lib/reader/`。
