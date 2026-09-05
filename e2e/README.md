# E2E 测试（Playwright + Electron）

Playwright 驱动**已构建**的 Electron 应用（`out/main/main.js`）。运行前需先 `bun run build`。

```bash
bun run build
bun run test:e2e          # 全部 E2E
bun run test:e2e:web-doc  # 仅在线文档 fixture 冒烟
```

## 用例

| 文件 | 说明 |
|------|------|
| `app-smoke.spec.ts` | 启动、欢迎页、菜单 |
| `agent-panel.spec.ts` | Agent 面板壳 |
| `export-pdf.spec.ts` | Markdown 导出 PDF（`E2E_AUTO_EXPORT_PATH`） |
| `quick-open.spec.ts` | 打开文件夹（`E2E_AUTO_OPEN_PATH` 跳过原生对话框）→ Ctrl+P 搜索打开 |
| `reader-foliate.spec.ts` | foliate 统一阅读器 parity（`E2E_FOLIATE_READER` 门控，分支验证用） |
| `reader-smoke.spec.ts` | Markdown 预览（Mermaid/公式/高亮）+ PDF 画布文字层 + EPUB 章节（自研最小 fixture） |
| `sync-webdav.spec.ts` | 本地内存 WebDAV stub → 设置页测试连接 + 一次同步落数 |
| `web-doc-smoke.spec.ts` | 在线文档：打开、地址栏换页、目录跳转 |
| `web-doc-xss.spec.ts` | 在线文档 XSS 回归（真浏览器）：恶意载荷不执行、正文完好 |

## 在线文档 Fixture

不依赖外网。主进程在设置 `E2E_WEB_DOC_FIXTURE_DIR` 时，对 `e2e.inkdown.test` 域名从本地 HTML 返回页面：

```
e2e/fixtures/web-doc/
  manifest.json      # URL → 文件名映射
  start.html
  installation.html
  xss.html           # XSS 回归载荷（script / javascript: / 事件处理器）
```

实现：`electron/services/web-doc/e2e-fixture.ts`（由 `fetchWebDocPage` 优先读取）。

## 辅助

| 文件 | 说明 |
|------|------|
| `helpers/launch-app.ts` | 启动已构建应用 |
| `helpers/web-doc-fixture.ts` | fixture 目录与测试 URL 常量 |
| `helpers/ebook-fixture.ts` | 自研最小 PDF / EPUB / Markdown 生成器（无新依赖） |
