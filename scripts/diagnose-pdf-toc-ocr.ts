/**
 * 对扫描 PDF 的目录页做 OCR 原型（开发诊断，非产品路径）。
 * Run: bun run scripts/diagnose-pdf-toc-ocr.ts [pdfPath] [fromPage] [toPage]
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pdf } from 'pdf-to-img'
import { createWorker } from 'tesseract.js'
import { extractOcrTocFromText, ocrTocToReaderUnits } from '@shared/reader/ocr-toc-extractor'

const pdfPath =
  process.argv[2] ?? 'D:/book/2027计算机组成原理_高清带书签版.pdf'
const fromPage = Number.parseInt(process.argv[3] ?? '2', 10)
const toPage = Number.parseInt(process.argv[4] ?? '6', 10)

const outDir = path.join(import.meta.dir, '.tmp-toc-ocr')
mkdirSync(outDir, { recursive: true })

console.log('PDF:', pdfPath)
console.log('OCR pages:', fromPage, '-', toPage)

const worker = await createWorker('chi_sim+eng', 1, {
  logger: (m) => {
    if (m.status === 'recognizing text') {
      process.stdout.write(`\r  OCR ${m.progress.toFixed(0)}%`)
    }
  },
})

const doc = await pdf(pdfPath, { scale: 2 })
let pageNum = 0
const allLines: string[] = []

for await (const image of doc) {
  pageNum++
  if (pageNum < fromPage) continue
  if (pageNum > toPage) break

  const pngPath = path.join(outDir, `page-${pageNum}.png`)
  writeFileSync(pngPath, image)
  console.log(`\n--- page ${pageNum} ---`)

  const { data } = await worker.recognize(image)
  console.log('confidence:', data.confidence.toFixed(1))
  const text = data.text.trim()
  console.log(text.slice(0, 800))

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed) allLines.push(trimmed)
  }
}

await worker.terminate()

/** 常见目录行：标题 + 页码（末尾数字） — 已由 ocr-toc-extractor 替代 */
const tocEntries = extractOcrTocFromText(allLines.join('\n'))

console.log('\n=== extracted TOC entries ===')
console.log('count:', tocEntries.length)
for (const e of tocEntries.slice(0, 40)) {
  console.log(`  L${e.level}\tprint p${e.printedPage}\t${e.title}`)
}

// 王道书：封面+前言约 7 页，印刷页码 1 ≈ PDF 页 9（需手工校准）
const OFFSET_CANDIDATES = [7, 8, 9, 10]
console.log('\n=== offset candidates (printedPage + offset → pdf page) ===')
for (const off of OFFSET_CANDIDATES) {
  const units = ocrTocToReaderUnits(tocEntries.slice(0, 5), off)
  console.log(`  offset ${off}:`, units.map((u) => `${u.href}:${u.label.slice(0, 12)}`).join(' | '))
}

if (tocEntries.length === 0) {
  console.log('\n(no TOC lines matched — try other page range or tune pattern)')
}
