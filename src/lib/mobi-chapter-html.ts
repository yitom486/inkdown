import DOMPurify from 'dompurify'
import type { MobiProcessedChapter } from '@lingo-reader/mobi-parser'
import { buildReaderLayoutCss, type EpubThemeMode } from '@/lib/epub-themes'

/** 去掉 XML 声明、DOCTYPE，并尽量只保留 body 正文 */
export function normalizeMobiChapterHtml(raw: string): string {
  let html = raw.trim()
  html = html.replace(/<\?xml[\s\S]*?\?>/gi, '')
  // 经典 MOBI 按 pagebreak 切分时，XML 声明可能被拆成 orphan 片段
  html = html.replace(/^version\s*=\s*["'][^"']+["'](?:\s+encoding\s*=\s*["'][^"']*["'])?\s*\?>\s*/i, '')
  html = html.replace(/^<\?xml[\s\S]*$/i, '')
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '')

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i)
  if (bodyMatch?.[1]) {
    html = bodyMatch[1].trim()
  } else {
    html = html.replace(/<head[\s\S]*?<\/head>/gi, '')
    html = html.replace(/<\/?html[^>]*>/gi, '')
    html = html.trim()
  }

  return html
    .replace(/^version\s*=\s*["'][^"']+["'](?:\s+encoding\s*=\s*["'][^"']*["'])?\s*\?>\s*/i, '')
    .trim()
}

const MOBI_XML_ARTIFACT_PATTERN =
  /^version\s*=\s*["'][^"']+["'](?:\s+encoding\s*=\s*["'][^"']*["'])?\s*\?>$/i

export function isMobiXmlArtifactPlain(plain: string): boolean {
  return MOBI_XML_ARTIFACT_PATTERN.test(plain.trim())
}

/** 经典 MOBI 按 pagebreak 拆章时，部分切片只剩 XML 头或空白 */
export function getMobiChapterPlainText(raw: string): string {
  return normalizeMobiChapterHtml(raw).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export function isMobiChapterReadable(raw: string): boolean {
  const normalized = normalizeMobiChapterHtml(raw).trim()
  if (!normalized) return false

  const plain = normalized.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  if (plain) {
    if (isMobiXmlArtifactPlain(plain)) return false
    return true
  }

  return /<(img|svg|table|h[1-6]|p|div|blockquote|li)\b/i.test(normalized)
}

/** @deprecated 使用 isMobiChapterReadable */
export function isLikelyBrokenMobiChapterHtml(raw: string): boolean {
  return !isMobiChapterReadable(raw)
}

/** 无 TOC 时从正文提取章节标题 */
export function extractMobiChapterLabel(raw: string): string | null {
  const normalized = normalizeMobiChapterHtml(raw)
  const headingMatch = normalized.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (headingMatch?.[1]) {
    const text = headingMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (text) return text.length > 48 ? `${text.slice(0, 48)}…` : text
  }

  const paragraphMatch = normalized.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  if (paragraphMatch?.[1]) {
    const text = paragraphMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (text.length >= 2 && text.length <= 48) return text
  }

  return null
}

async function fetchCssText(href: string): Promise<string> {
  try {
    const response = await fetch(href)
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  }
}

export async function buildMobiChapterDocument(
  chapter: MobiProcessedChapter,
  theme: EpubThemeMode,
): Promise<string> {
  const bodyHtml = normalizeMobiChapterHtml(chapter.html)
  const sanitized = DOMPurify.sanitize(bodyHtml, {
    ADD_TAGS: ['img', 'svg', 'video', 'audio', 'picture', 'source'],
    ADD_ATTR: ['href', 'class', 'id', 'style', 'src', 'alt', 'title', 'poster', 'filepos'],
  })

  const cssParts = await Promise.all(chapter.css.map((part) => fetchCssText(part.href)))
  const bookCss = cssParts.filter(Boolean).join('\n')
  const themeCss = buildReaderLayoutCss(theme)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${bookCss}
${themeCss}
</style>
</head>
<body>${sanitized}</body>
</html>`
}

/** @deprecated 使用 buildMobiChapterDocument；保留供测试兼容 */
export function buildMobiChapterHtml(chapter: MobiProcessedChapter): string {
  const bodyHtml = normalizeMobiChapterHtml(chapter.html)
  return DOMPurify.sanitize(bodyHtml, {
    ADD_TAGS: ['img', 'svg', 'video', 'audio'],
    ADD_ATTR: ['href', 'class', 'id', 'style', 'src', 'alt', 'title', 'filepos'],
  })
}
