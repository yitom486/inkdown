# src/public

Vite/Electron 静态资源。打包后按原路径可达。

| 路径 | 说明 |
|------|------|
| `icon.png` | 应用图标等 |
| `pdfjs/` | pdf.js 运行时资源（cmaps、fonts、wasm 等）。**视为上游资源，勿手改**；升级 pdf.js 时整包替换 |

业务代码不要往这里堆；样式在 `src/styles/`，逻辑在 `src/lib/`。
