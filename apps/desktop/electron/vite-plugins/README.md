# electron/vite-plugins

主进程 / electron-vite 构建插件。不是运行时服务。

| 文件 | 功能 |
|------|------|
| `copy-pdfjs-assets.ts` | 把 `pdfjs-dist` 的 cmaps/fonts/wasm 拷到 `src/public/pdfjs`（中文 CID 刚需） |
