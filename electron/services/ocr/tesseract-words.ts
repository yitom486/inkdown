import type { TesseractWordLike } from '@shared/reader/ocr-page-words'

interface TesseractPageData {
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        words?: Array<{
          text: string
          confidence: number
          bbox: { x0: number; y0: number; x1: number; y1: number }
        }>
      }>
    }>
  }> | null
}

export function extractTesseractWords(data: TesseractPageData): TesseractWordLike[] {
  const words: TesseractWordLike[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox,
          })
        }
      }
    }
  }
  return words
}
