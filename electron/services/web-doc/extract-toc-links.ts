import type { WebDocTocEntry } from '@shared/types/web-doc'

const MAX_TOC_ENTRIES = 240

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''))
}

/** 从整页 HTML 中提取同站文档链接，供 generic-ssr 目录发现 */
export function extractSameOriginDocLinks(html: string, baseUrl: string): WebDocTocEntry[] {
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const entries: WebDocTocEntry[] = []

  const anchorPattern = /<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(html)) !== null) {
    const hrefRaw = match[1]?.trim()
    if (!hrefRaw || hrefRaw.startsWith('mailto:') || hrefRaw.startsWith('tel:')) continue

    let absolute: URL
    try {
      absolute = new URL(hrefRaw, base)
    } catch {
      continue
    }

    if (absolute.origin !== base.origin) continue
    if (!['http:', 'https:'].includes(absolute.protocol)) continue

    absolute.hash = ''
    const key = absolute.toString()
    if (seen.has(key)) continue
    seen.add(key)

    const label = stripTags(match[2] ?? '')
    if (!label || label.length < 2) continue
    if (label.length > 120) continue

    entries.push({
      href: key,
      label: label.length > 80 ? `${label.slice(0, 80)}…` : label,
      level: 1,
    })

    if (entries.length >= MAX_TOC_ENTRIES) break
  }

  entries.sort((a, b) => a.href.localeCompare(b.href))
  return entries
}
