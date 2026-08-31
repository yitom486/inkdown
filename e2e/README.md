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
| `web-doc-smoke.spec.ts` | 在线文档：打开、地址栏换页、目录跳转 |

## 在线文档 Fixture

不依赖外网。主进程在设置 `E2E_WEB_DOC_FIXTURE_DIR` 时，对 `e2e.inkdown.test` 域名从本地 HTML 返回页面：

```
e2e/fixtures/web-doc/
  manifest.json      # URL → 文件名映射
  start.html
  installation.html
```

实现：`electron/services/web-doc/e2e-fixture.ts`（由 `fetchWebDocPage` 优先读取）。

## 辅助

| 文件 | 说明 |
|------|------|
| `helpers/launch-app.ts` | 启动已构建应用 |
| `helpers/web-doc-fixture.ts` | fixture 目录与测试 URL 常量 |
