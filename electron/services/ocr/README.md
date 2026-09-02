# ocr

PDF OCR（按需）：`ocr-component-manager.ts` 管理语言包下载；`pdf-ocr-toc-service.ts` 识别目录；`pdf-page-ocr-service.ts` 识别正文页；缓存至 `userData/ocr-cache/`；语言包至 `userData/ocr-tessdata/`（`tesseract-config.ts`）。
