# ocr

PDF OCR（按需）：`inspector-ocr-runtime.ts` 分发识别引擎（PDFium + ONNX Runtime + PP-OCRv6 Small 模型，按平台按需下载验签，离线模式运行）；`ocr-component-manager.ts` 管理引擎状态（下载进度/取消，与设置页同构）；`pdf-ocr-toc-service.ts` / `pdf-page-ocr-service.ts` 识别（整范围/单页选择性 OCR，文本进启发式目录解析、几何进页缓存）；缓存 `userData/ocr-cache/`。页级缓存 `ocr-page-cache.ts`、目录缓存 `ocr-toc-cache.ts`。中英文字库内置于识别模型，无语言包。
