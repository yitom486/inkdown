# ocr

PDF OCR（按需）：`pdf-ocr-toc-service.ts` 识别目录；`pdf-page-ocr-service.ts` 识别正文页；缓存至 `userData/ocr-cache/`（页 `pages/`、目录 `{hash}.json`）；`ocr:clear-pdf-cache` / `ocr:clear-all-cache` 可清除；语言包缓存至 `userData/ocr-tessdata/`（`tesseract-config.ts`）。
