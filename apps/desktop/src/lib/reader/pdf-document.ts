import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import { buildPdfjsDocumentAssetOptions } from '@/lib/reader/pdf-document-assets'
import { pdfjsLib } from '@/lib/reader/pdf-worker'

export { pdfjsAssetBaseUrl, buildPdfjsDocumentAssetOptions } from '@/lib/reader/pdf-document-assets'

export interface OpenPdfDocumentOptions {
  data: Uint8Array
}

/**
 * 打开 PDF：必须带 CMap，否则 Adobe-GB1 等中文 CID 字体会空白
 *（浏览器自带 PDF 阅读器不依赖这些资源，VS Code pdf 插件与裸 pdf.js 同病）。
 */
export function openPdfDocument(options: OpenPdfDocumentOptions): PDFDocumentLoadingTask {
  return pdfjsLib.getDocument({
    data: options.data,
    ...buildPdfjsDocumentAssetOptions(),
  })
}
