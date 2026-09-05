import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** 自研最小 fixture 生成器：不引入新依赖，跨平台可跑。 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 最小 stored（不压缩）zip，jszip/epubjs 可读 */
function buildStoredZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = encodeUtf8(entry.name)
    const crc = crc32(entry.data)
    const local = concat(
      u32(0x04034b50),
      u16(20),
      u16(0x0800), // UTF-8 文件名
      u16(0), // stored
      u16(0),
      u16(0),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      entry.data,
    )
    chunks.push(local)
    central.push(
      concat(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ),
    )
    offset += local.length
  }
  const centralDir = concat(...central)
  const end = concat(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  )
  return concat(...chunks, centralDir, end)
}

const EPUB_CHAPTER = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Smoke Chapter</title></head>
<body><h1>Smoke Chapter</h1><p>Inkdown E2E minimal EPUB paragraph.</p></body>
</html>`

const EPUB_OPF = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Smoke Book</dc:title><dc:identifier id="bookid">inkdown-e2e-smoke</dc:identifier><dc:language>en</dc:language></metadata>
<manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="ch1"/></spine>
</package>`

const EPUB_CONTAINER = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

export async function writeMinimalEpub(filePath: string): Promise<void> {
  const zip = buildStoredZip([
    { name: 'mimetype', data: encodeUtf8('application/epub+zip') },
    { name: 'META-INF/container.xml', data: encodeUtf8(EPUB_CONTAINER) },
    { name: 'OEBPS/content.opf', data: encodeUtf8(EPUB_OPF) },
    { name: 'OEBPS/ch1.xhtml', data: encodeUtf8(EPUB_CHAPTER) },
  ])
  await writeFile(filePath, zip)
}

/** 单页文字 PDF（xref 偏移与流长度程序化计算，pdf.js 可渲染） */
export async function writeMinimalPdf(filePath: string): Promise<void> {
  const enc = new TextEncoder()
  const streamText = 'BT /F1 24 Tf 72 720 Td (Inkdown E2E minimal PDF paragraph.) Tj ET\n'
  const streamLen = enc.encode(streamText).length
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${streamLen} >>\nstream\n${streamText}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const header = '%PDF-1.4\n'
  let body = ''
  const offsets: number[] = []
  let cursor = enc.encode(header).length
  objects.forEach((content, index) => {
    const entry = `${index + 1} 0 obj\n${content}\nendobj\n`
    offsets.push(cursor)
    body += entry
    cursor += enc.encode(entry).length
  })
  const xrefOffset = cursor
  const count = objects.length + 1
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  await writeFile(filePath, enc.encode(header + body + xref + trailer))
}

export async function writeReaderSmokeWorkspace(dir: string): Promise<{
  mdName: string
  pdfName: string
  epubName: string
}> {
  await mkdir(dir, { recursive: true })
  const mdName = 'smoke-demo.md'
  const pdfName = 'smoke-sample.pdf'
  const epubName = 'smoke-sample.epub'
  const md = [
    '# Reader Smoke',
    '',
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
    '',
    'Inline math \\(E=mc^2\\) and block:',
    '',
    '\\[\\frac{a}{b}\\]',
    '',
    '```ts',
    'const answer: number = 42',
    '```',
    '',
  ].join('\n')
  await writeFile(join(dir, mdName), md, 'utf-8')
  await writeMinimalPdf(join(dir, pdfName))
  await writeMinimalEpub(join(dir, epubName))
  return { mdName, pdfName, epubName }
}
