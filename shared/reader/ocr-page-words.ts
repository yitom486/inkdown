import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import type { OcrPageWord, PdfOcrPageCache } from '@shared/types/ocr'

/** inspector 行框置信度门限（0–1；与 napi minimum_confidence 对齐） */
const INSPECTOR_MIN_CONFIDENCE = 0.3

export interface InspectorSpanLike {
  text: string
  /** 0–1 置信度 */
  confidence: number
  /** PDF 点坐标，与 TextItem 同帧（左、下、宽、高，y-up） */
  x: number
  y: number
  width: number
  height: number
}

const CJK_CHAR = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/u

function isCjkChar(char: string): boolean {
  return CJK_CHAR.test(char)
}

/**
 * 行文本切词：逐字扫描，CJK（含标点）逐字成词，拉丁/数字按空白分词。
 * 中文全角字接近等宽，框按权重比例切分近似精确；纯拉丁行是近似值。
 */
export function splitCjkUnits(text: string): string[] {
  const units: string[] = []
  let latin = ''
  const flushLatin = (): void => {
    if (latin) {
      units.push(latin)
      latin = ''
    }
  }
  for (const char of text) {
    if (/\s/.test(char)) {
      flushLatin()
      continue
    }
    if (isCjkChar(char)) {
      flushLatin()
      units.push(char)
      continue
    }
    latin += char
  }
  flushLatin()
  return units
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * inspector 行框 → 归一化词（0–1，左上原点；与 normalizeOcrWords 输出同契约）。
 * 置信度不足、空文本、非法尺寸一律丢弃。
 */
export function normalizeInspectorSpans(
  spans: InspectorSpanLike[],
  pageWidthPt: number,
  pageHeightPt: number,
): OcrPageWord[] {
  if (!(pageWidthPt > 0) || !(pageHeightPt > 0)) return []
  const words: OcrPageWord[] = []
  for (const span of spans) {
    if (!span || typeof span.text !== 'string') continue
    if (!(span.confidence >= INSPECTOR_MIN_CONFIDENCE)) continue
    if (!(span.width > 0) || !(span.height > 0)) continue
    const units = splitCjkUnits(span.text)
    if (units.length === 0) continue
    const weights = units.map((unit) =>
      [...unit].reduce((sum, char) => sum + (isCjkChar(char) ? 2 : 1), 0),
    )
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    if (totalWeight <= 0) continue
    let acc = 0
    units.forEach((unit, index) => {
      const weight = weights[index] ?? 0
      const x0 = clamp01((span.x + (span.width * acc) / totalWeight) / pageWidthPt)
      acc += weight
      const x1 = clamp01((span.x + (span.width * acc) / totalWeight) / pageWidthPt)
      // y-up（底边）→ 归一化左上原点：y0 为顶边
      const y0 = clamp01(1 - (span.y + span.height) / pageHeightPt)
      const y1 = clamp01(1 - span.y / pageHeightPt)
      if (unit.trim().length > 0 && x1 > x0 && y1 > y0) {
        words.push({ text: unit, bbox: { x0, y0, x1, y1 } })
      }
    })
  }
  return words
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
