import type { PageViewport } from 'pdfjs-dist'
import type { PdfOcrPageCache } from '@shared/types/ocr'
import { ocrPageCacheToTextContent } from '@shared/reader/ocr-page-words'
import { registerPdfPageTextGeometry } from '@/lib/reader/pdf-selection'

export function mountOcrTextLayer(
  host: HTMLElement,
  pageRoot: HTMLElement,
  viewport: PageViewport,
  cache: PdfOcrPageCache,
): () => void {
  const layer = document.createElement('div')
  layer.className = 'textLayer'

  cache.words.forEach((word, index) => {
    const span = document.createElement('span')
    span.textContent = word.text
    span.dataset.pdfTextItemIndex = String(index)
    span.style.position = 'absolute'
    span.style.left = `${word.bbox.x0 * viewport.width}px`
    span.style.top = `${word.bbox.y0 * viewport.height}px`
    span.style.width = `${(word.bbox.x1 - word.bbox.x0) * viewport.width}px`
    span.style.height = `${(word.bbox.y1 - word.bbox.y0) * viewport.height}px`
    span.style.fontSize = `${Math.max(8, (word.bbox.y1 - word.bbox.y0) * viewport.height * 0.85)}px`
    span.style.lineHeight = '1'
    span.style.color = 'transparent'
    span.style.whiteSpace = 'pre'
    span.style.transformOrigin = '0% 0%'
    layer.appendChild(span)
  })

  host.replaceChildren(layer)
  const textContent = ocrPageCacheToTextContent(cache)
  return registerPdfPageTextGeometry(pageRoot, viewport, textContent)
}
