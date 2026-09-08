import { readFileSync } from 'node:fs'
import { classifyPdf, processPdfWithOcr } from '@firecrawl/pdf-inspector'

// 一次性 macOS OCR 冒烟（CI workflow 调用，验证后连同 workflow 一起删除）。
// 断言 OCR 整链在 mac arm64 可用，不测识别精度。
const fixture = 'e2e/fixtures/ocr/scanned-hello.pdf'
const buf = readFileSync(fixture)

const cls = classifyPdf(buf)
console.log('classify:', JSON.stringify(cls))
if (cls.pdfType !== 'Scanned' && cls.pdfType !== 'Mixed') {
  throw new Error(`fixture 应被分类为 Scanned/Mixed，实际 ${cls.pdfType}`)
}

const ocr = await processPdfWithOcr(buf, { mode: 'Auto', dpi: 150 })
const page = ocr.pages[0]
if (!page) throw new Error('OCR 无返回页')
console.log(`source=${page.provenance.source} conf=${page.provenance.ocrConfidence}`)
console.log(JSON.stringify(page.markdown.slice(0, 120)))
if (page.provenance.source !== 'Ocr') throw new Error('该页应走 OCR 分支')
if (!page.markdown.includes('Hello Inkdown OCR')) {
  throw new Error('OCR 文本不含预期内容')
}
console.log('OCR-MAC-SMOKE-PASS')
