/**
 * Diagnose CJK glyph failure with/without pdf.js cmaps (serves local assets over HTTP).
 * Run: bun run scripts/diagnose-pdf-fonts.ts [pdfPath]
 */
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const pdfPath =
  process.argv[2] ??
  'D:/stm32/stm32-start/book/[野火EmbedFire]《STM32库开发实战指南——基于野火霸天虎开发板》—20210712.pdf'

const root = path.resolve(import.meta.dir, '..')
const pdfjsRoot = path.join(root, 'node_modules/pdfjs-dist')
const { getDocument, GlobalWorkerOptions } = await import(
  pathToFileURL(path.join(pdfjsRoot, 'legacy/build/pdf.mjs')).href
)

GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(pdfjsRoot, 'legacy/build/pdf.worker.mjs'),
).href

const data = new Uint8Array(readFileSync(pdfPath))

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url)
    const rel = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const filePath = path.join(pdfjsRoot, rel)
    if (!filePath.startsWith(pdfjsRoot) || !existsSync(filePath)) {
      return new Response('missing', { status: 404 })
    }
    return new Response(readFileSync(filePath))
  },
})

const assetBase = `http://127.0.0.1:${server.port}/`

async function inspect(label: string, options: Record<string, unknown>) {
  const task = getDocument({ data: data.slice(), ...options })
  const pdf = await task.promise
  const page = await pdf.getPage(1)
  const text = await page.getTextContent()
  const sample = text.items
    .slice(0, 20)
    .map((it: { str?: string }) => it.str ?? '')
    .join('|')
  console.log(`\n=== ${label} ===`)
  console.log('textItems', text.items.length)
  console.log('textSample', JSON.stringify(sample))
  await task.destroy()
}

await inspect('without cmaps', {})
await inspect('with cmaps+stdfonts', {
  cMapUrl: `${assetBase}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${assetBase}standard_fonts/`,
  useSystemFonts: true,
  useWorkerFetch: true,
})

server.stop()
