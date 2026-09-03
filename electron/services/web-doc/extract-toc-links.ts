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
  if (title?.trim()) return decodeHtmlEntities(title)

  const srOnly = anchorHtml.match(/<span[^>]*\bsr-only\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]
  if (srOnly) {
    const label = stripTags(srOnly)
    if (label) return label
  }

  return stripTags(anchorHtml)
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
}

/**
 * 选取最可能是「站点目录」的 nav：Mintlify `#sidebar`、aria-label、role=navigation，
 * 否则取同站链接最多的 nav。
 */
export function pickDocsNavHtml(html: string): string | null {
  const cleaned = stripScriptsAndStyles(html)
  const navBlocks = [...cleaned.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)].map((m) => m[0])
  if (navBlocks.length === 0) {
    const sidebar = cleaned.match(/<div\b[^>]*\bid=["']sidebar["'][^>]*>[\s\S]*?<\/div>/i)?.[0]
    return sidebar ?? null
  }

  const scored = navBlocks.map((block) => {
    const openTag = block.match(/^<nav\b[^>]*>/i)?.[0] ?? ''
    let score = 0
    if (/\bid=["']sidebar["']/i.test(openTag)) score += 100
    if (/aria-label=["'][^"']*pages[^"']*["']/i.test(openTag)) score += 80
    if (/aria-label=["'][^"']*(sidebar|docs|navigation|toc)[^"']*["']/i.test(openTag)) {
      score += 60
    }
    if (/\brole=["']navigation["']/i.test(openTag)) score += 40
    if (/sidebar-group|sidebar-title/i.test(block)) score += 50
    const linkCount = (block.match(/<a\b/gi) ?? []).length
    const ulCount = (block.match(/<ul\b/gi) ?? []).length
    score += Math.min(linkCount, 80) + Math.min(ulCount * 3, 30)
    return { block, score, linkCount }
  })

  scored.sort((a, b) => b.score - a.score || b.linkCount - a.linkCount)
  const best = scored[0]
  if (!best || best.linkCount < 2) return null
  return best.block
}

function resolveSameOriginHref(hrefRaw: string, base: URL): string | null {
  const raw = hrefRaw.trim()
  if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:')) return null
  if (raw === '#' || raw.startsWith('javascript:')) return null

  let absolute: URL
  try {
    absolute = new URL(raw, base)
  } catch {
    return null
  }

  if (absolute.origin !== base.origin) return null
  if (!['http:', 'https:'].includes(absolute.protocol)) return null
  absolute.hash = ''
  return absolute.toString()
}

/**
 * 从文档站侧栏 nav 提取层级目录（Mintlify / 常见 docs 主题）。
 * - 保留 DOM 顺序（不按 href 字母排序）
 * - 嵌套 `<ul>` 增加缩进
 * - `<h2>`/`<h3>`/`<h4>` 分组标题合成父节点（href = 组内首链）
 */
export function extractStructuredNavToc(html: string, baseUrl: string): WebDocTocEntry[] {
  const navHtml = pickDocsNavHtml(html)
  if (!navHtml) return []

  const base = new URL(baseUrl)
  const entries: WebDocTocEntry[] = []
  const seenLeaves = new Set<string>()

  let depth = 0
  let pos = 0
  /** 已遇到分组标题，等待首个链接补全 href */
  let pendingGroup: { label: string; level: number } | null = null
  /** 当前分组父级 level；子链接为 parentLevel + 1 */
  let activeGroupLevel: number | null = null

  const push = (entry: WebDocTocEntry, asLeaf: boolean): boolean => {
    const label = entry.label.length > 80 ? `${entry.label.slice(0, 80)}…` : entry.label
    if (asLeaf) {
      if (seenLeaves.has(entry.href)) return false
      seenLeaves.add(entry.href)
    }
    entries.push({ ...entry, label })
    return entries.length >= MAX_TOC_ENTRIES
  }

  while (pos < navHtml.length) {
    const ulOpen = navHtml.indexOf('<ul', pos)
    const ulClose = navHtml.indexOf('</ul>', pos)
    const aMatches = ['<a ', '<a\n', '<a\t', '<a>'].map((token) => navHtml.indexOf(token, pos))
    const nextA = aMatches.filter((i) => i >= 0).reduce((min, i) => Math.min(min, i), Infinity)
    const headingMatches = ['<h2', '<h3', '<h4'].map((token) => navHtml.indexOf(token, pos))
    const nextH = headingMatches.filter((i) => i >= 0).reduce((min, i) => Math.min(min, i), Infinity)

    const candidates = [
      ulOpen,
      ulClose,
      nextA === Infinity ? -1 : nextA,
      nextH === Infinity ? -1 : nextH,
    ].filter((index) => index >= 0)
    if (candidates.length === 0) break

    const next = Math.min(...candidates)

    if (next === ulOpen) {
      depth += 1
      pos = ulOpen + 3
      continue
    }

    if (next === ulClose) {
      depth = Math.max(0, depth - 1)
      if (activeGroupLevel !== null && depth <= activeGroupLevel) {
        activeGroupLevel = null
      }
      pos = ulClose + 5
      continue
    }

    if (next === nextH) {
      const closeTag = navHtml.indexOf('>', nextH)
      const endHeading = navHtml.indexOf('</h', nextH)
      if (closeTag < 0 || endHeading < 0) break
      const label = stripTags(navHtml.slice(closeTag + 1, endHeading))
      pos = endHeading + 5
      if (label && label.length >= 2 && label.length <= 80) {
        pendingGroup = { label, level: Math.max(0, depth) }
        activeGroupLevel = null
      }
      continue
    }

    const closeTag = navHtml.indexOf('</a>', nextA)
    if (closeTag < 0) break

    const anchorHtml = navHtml.slice(nextA, closeTag + 4)
    pos = closeTag + 4

    const hrefMatch = anchorHtml.match(/\bhref=["']([^"']+)["']/i)
    if (!hrefMatch) continue

    const key = resolveSameOriginHref(hrefMatch[1]!, base)
    if (!key) continue

    const label = extractAnchorLabel(anchorHtml)
    if (!label || label.length < 2 || label.length > 120) continue

    if (pendingGroup) {
      activeGroupLevel = pendingGroup.level
      if (
        push(
          {
            href: key,
            label: pendingGroup.label,
            level: pendingGroup.level,
          },
          false,
        )
      ) {
        break
      }
      pendingGroup = null
    }

    const level =
      activeGroupLevel !== null
        ? activeGroupLevel + 1
        : Math.max(0, depth > 0 ? depth - 1 : 0)

    if (
      push(
        {
          href: key,
          label,
          level,
        },
        true,
      )
    ) {
      break
    }
  }

  return entries
}

/** 从整页 HTML 中提取同站文档链接（扁平兜底，保留出现顺序） */
export function extractSameOriginDocLinks(html: string, baseUrl: string): WebDocTocEntry[] {
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const entries: WebDocTocEntry[] = []

  const anchorPattern = /<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(html)) !== null) {
    const hrefRaw = match[1]?.trim()
    if (!hrefRaw || hrefRaw.startsWith('mailto:') || hrefRaw.startsWith('tel:')) continue

    const key = resolveSameOriginHref(hrefRaw, base)
    if (!key) continue
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

  return entries
}

/** generic-ssr：优先结构化侧栏，失败再扁平扫链 */
export function extractGenericWebDocToc(html: string, baseUrl: string): WebDocTocEntry[] {
  const structured = extractStructuredNavToc(html, baseUrl)
  if (structured.length >= 3) return structured
  return extractSameOriginDocLinks(html, baseUrl)
}
