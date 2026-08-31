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

function extractAnchorLabel(anchorHtml: string): string {
  const title = anchorHtml.match(/\btitle=["']([^"']+)["']/i)?.[1]
  if (title) return decodeHtmlEntities(title)

  const div = anchorHtml.match(/<div>([\s\S]*?)<\/div>/i)?.[1]
  return stripTags(div ?? anchorHtml)
}

function extractNavHtml(html: string): string | null {
  const match = html.match(/<nav\b[^>]*\brole=["']navigation["'][\s\S]*?<\/nav>/i)
  return match?.[0] ?? null
}

/** 从 react.dev 侧栏导航提取层级目录 */
export function extractReactDevToc(html: string, baseUrl: string): WebDocTocEntry[] {
  const navHtml = extractNavHtml(html)
  if (!navHtml) return []

  const base = new URL(baseUrl)
  const entries: WebDocTocEntry[] = []
  const seen = new Set<string>()

  let depth = 0
  let pos = 0

  while (pos < navHtml.length) {
    const ulOpen = navHtml.indexOf('<ul', pos)
    const ulClose = navHtml.indexOf('</ul>', pos)
    const aOpen = navHtml.indexOf('<a ', pos)

    const candidates = [ulOpen, ulClose, aOpen].filter((index) => index >= 0)
    if (candidates.length === 0) break

    const next = Math.min(...candidates)

    if (next === ulOpen) {
      depth += 1
      pos = ulOpen + 3
      continue
    }

    if (next === ulClose) {
      depth = Math.max(0, depth - 1)
      pos = ulClose + 5
      continue
    }

    const closeTag = navHtml.indexOf('</a>', aOpen)
    if (closeTag < 0) break

    const anchorHtml = navHtml.slice(aOpen, closeTag + 4)
    const hrefMatch = anchorHtml.match(/\bhref=["']([^"'#]+)["']/i)
    pos = closeTag + 4

    if (!hrefMatch) continue

    let absolute: URL
    try {
      absolute = new URL(hrefMatch[1]!, base)
    } catch {
      continue
    }

    if (absolute.origin !== base.origin) continue
    if (!absolute.pathname.startsWith('/learn') && !absolute.pathname.startsWith('/reference')) {
      continue
    }

    absolute.hash = ''
    const key = absolute.toString()
    if (seen.has(key)) continue
    seen.add(key)

    const label = extractAnchorLabel(anchorHtml)
    if (!label) continue

    entries.push({
      href: key,
      label: label.length > 80 ? `${label.slice(0, 80)}…` : label,
      level: Math.max(0, depth - 1),
    })

    if (entries.length >= MAX_TOC_ENTRIES) break
  }

  return entries
}
