# ocr

PDF OCR（按需）：`ocr-component-manager.ts` 管理运行时与语言包下载；`ocr-runtime.ts` 从 Release 安装 tesseract（打包版）；`inspector-ocr-runtime.ts` 分发 pdf-inspector OCR 外部运行时（PDFium/ORT/模型，按平台按需下载验签）；`pdf-ocr-toc-service.ts` / `pdf-page-ocr-service.ts` 识别（主路径 inspector，tesseract 回退）；缓存 `userData/ocr-cache/`；语言包 `userData/ocr-tessdata/`。页级缓存 `ocr-page-cache.ts`、目录缓存 `ocr-toc-cache.ts`、worker 生命周期 `ocr-worker.ts`、图片识别 `recognize-image.ts`、tesseract 配置 `tesseract-config.ts` 与词级结果归一 `tesseract-words.ts`。发版前执行 `bun run build:ocr-runtime` 并附带 `ocr-runtime-*.tar.gz`。
