import type { WebDocTocEntry } from '@shared/types/web-doc'

const MAX_TOC_ENTRIES = 240

const SEGMENT_LABELS: Record<string, string> = {
  'get-started': 'Get Started',
  protocol: 'Protocol',
  libraries: 'Libraries',
  community: 'Community',
  rfds: 'RFDs',
  announcements: 'Announcements',
  publications: 'Publications',
  updates: 'Updates',
  brand: 'Brand',
}

export function humanizePathSegment(segment: string): string {
  const key = segment.toLowerCase()
  if (SEGMENT_LABELS[key]) return SEGMENT_LABELS[key]
  if (/^v\d+/i.test(segment)) return segment
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** 将 Mintlify / docs 站的 `.md` 文档链转为可打开的 HTML 路径 */
export function normalizeLlmsDocHref(href: string, baseOrigin: string): string | null {
  try {
    const absolute = new URL(href, baseOrigin)
    if (!['http:', 'https:'].includes(absolute.protocol)) return null
    absolute.hash = ''
    absolute.search = ''
    let path = absolute.pathname
    if (path.endsWith('.md')) path = path.slice(0, -3)
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    absolute.pathname = path || '/'
    return absolute.toString()
  } catch {
    return null
  }
}

/**
 * 解析 llms.txt（Mintlify 等）：`- [Title](url): desc`
 * 按 URL 路径段生成分组层级（如 Protocol → v1 → Overview）。
 */
export function extractLlmsTxtToc(text: string, baseOrigin: string): WebDocTocEntry[] {
  const entries: WebDocTocEntry[] = []
  const seenLeaves = new Set<string>()
  const emittedGroups = new Set<string>()

  const linkPattern = /^\s*-\s*\[([^\]]+)\]\(([^)\s]+)\)/gm
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(text)) !== null) {
    const label = match[1]?.trim()
    const hrefRaw = match[2]?.trim()
    if (!label || !hrefRaw) continue

    const href = normalizeLlmsDocHref(hrefRaw, baseOrigin)
    if (!href) continue

    let pathname: string
    try {
      pathname = new URL(href).pathname
    } catch {
      continue
    }

    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) {
      if (seenLeaves.has(href)) continue
      seenLeaves.add(href)
      entries.push({ href, label, level: 0 })
      if (entries.length >= MAX_TOC_ENTRIES) break
      continue
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const prefix = parts.slice(0, i + 1).join('/')
      const groupKey = `${i}:${prefix}`
      if (emittedGroups.has(groupKey)) continue
      emittedGroups.add(groupKey)
      entries.push({
        href,
        label: humanizePathSegment(parts[i]!),
        level: i,
      })
      if (entries.length >= MAX_TOC_ENTRIES) return entries
    }

    if (seenLeaves.has(href)) continue
    seenLeaves.add(href)
    entries.push({
      href,
      label,
      level: Math.max(0, parts.length - 1),
    })
    if (entries.length >= MAX_TOC_ENTRIES) break
  }

  return entries
}

export function looksLikeMintlifyOrLlmsDocs(html: string): boolean {
  return (
    /\/llms\.txt/i.test(html) ||
    /_mintlify|mintlify\.com|mintcdn\.com/i.test(html) ||
    /id=["']sidebar["']/i.test(html)
  )
}

export function resolveLlmsTxtUrl(pageUrl: string, html: string): string | null {
  try {
    const base = new URL(pageUrl)
    const fromHtml = html.match(/\bhref=["']([^"']*llms\.txt)["']/i)?.[1]
    if (fromHtml) {
      return new URL(fromHtml, base).toString()
    }
    return new URL('/llms.txt', base.origin).toString()
  } catch {
    return null
  }
}
