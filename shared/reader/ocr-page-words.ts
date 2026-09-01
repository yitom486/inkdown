import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import type { OcrPageWord, PdfOcrPageCache } from '@shared/types/ocr'

export interface TesseractWordLike {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

const MIN_CONFIDENCE = 25

/** 将 tesseract 词块转为 0–1 归一化 bbox */
export function normalizeOcrWords(
  words: TesseractWordLike[],
  imageWidth: number,
  imageHeight: number,
): OcrPageWord[] {
  if (imageWidth <= 0 || imageHeight <= 0) return []

  return words
    .filter((word) => word.confidence >= MIN_CONFIDENCE)
    .map((word) => ({
      text: word.text.replace(/\s+/g, '').trim(),
      bbox: word.bbox,
    }))
    .filter((item) => item.text.length > 0)
    .map((item) => ({
      text: item.text,
      bbox: {
        x0: item.bbox.x0 / imageWidth,
        y0: item.bbox.y0 / imageHeight,
        x1: item.bbox.x1 / imageWidth,
        y1: item.bbox.y1 / imageHeight,
      },
    }))
}

export function ocrPageCacheToTextContent(cache: PdfOcrPageCache): TextContent {
  const { pageWidth, pageHeight, words } = cache
  const items: TextItem[] = words.map((word) => {
    const width = Math.max((word.bbox.x1 - word.bbox.x0) * pageWidth, 1)
    const height = Math.max((word.bbox.y1 - word.bbox.y0) * pageHeight, 1)
    const x = word.bbox.x0 * pageWidth
    const y = pageHeight - word.bbox.y1 * pageHeight
    return {
      str: word.text,
      dir: 'ltr',
      width,
      height,
      transform: [height, 0, 0, height, x, y],
      fontName: 'OCR',
      hasEOL: false,
    }
  })
  return { items, styles: {}, lang: null }
}

export function pageHasNativeText(charCount: number): boolean {
  return charCount >= 8
}
