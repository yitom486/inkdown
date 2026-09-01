/**
 * Run: bun run scripts/diagnose-pdf-page-ocr.ts [pdfPath] [page]
 */
import { readFile } from 'node:fs/promises'
import { pdf } from 'pdf-to-img'
import { createWorker } from 'tesseract.js'
import { extractTesseractWords } from '../electron/services/ocr/tesseract-words'
import { normalizeOcrWords } from '../shared/reader/ocr-page-words'

const pdfPath = process.argv[2] ?? 'D:/book/2027计算机组成原理_高清带书签版.pdf'
const pageNumber = Number.parseInt(process.argv[3] ?? '14', 10)
const OCR_SCALE = 2

function readPngSize(image: Buffer) {
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) }
}

const data = await readFile(pdfPath)
const doc = await pdf(data, { scale: OCR_SCALE })
let current = 0
let image: Buffer | null = null
let width = 0
let height = 0

for await (const page of doc) {
  current += 1
  if (current === pageNumber) {
    image = Buffer.from(page)
    ;({ width, height } = readPngSize(image))
    break
  }
}

if (!image) {
  console.error('page not found')
  process.exit(1)
}

console.log('page', pageNumber, 'image', width, 'x', height)

const worker = await createWorker('chi_sim+eng', 1)
const { data: ocrData } = await worker.recognize(image, {}, { blocks: true })
await worker.terminate()

console.log('text length:', ocrData.text?.length ?? 0)
console.log('text sample:', JSON.stringify(ocrData.text?.slice(0, 200)))
console.log('blocks:', ocrData.blocks?.length ?? 'null')

const rawWords = extractTesseractWords(ocrData)
console.log('extractTesseractWords count:', rawWords.length)

const normalized = normalizeOcrWords(rawWords, width, height)
console.log('normalizeOcrWords count:', normalized.length)

if (rawWords.length === 0 && ocrData.text) {
  console.log('FALLBACK: OCR has text but no word blocks — need line-level fallback')
}
