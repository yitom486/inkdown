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

export function isVersionPathSegment(segment: string): boolean {
  return /^v\d+$/i.test(segment)
}

export function humanizePathSegment(segment: string): string {
  const key = segment.toLowerCase()
  if (SEGMENT_LABELS[key]) return SEGMENT_LABELS[key]
  if (isVersionPathSegment(segment)) return segment
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
 * 路径段用于建树时：去掉版本号段（v1/v2）。
 * 原站里版本是 Protocol 下的切换器，不是与章节平行的强制文件夹；
 * 多版本同名页再用 (v2) 区分即可。
 */
export function structuralPathParts(parts: string[]): {
  groupParts: string[]
  leafPart: string | null
  version: string | null
} {
  if (parts.length === 0) {
    return { groupParts: [], leafPart: null, version: null }
  }

  const version = parts.find((part) => isVersionPathSegment(part)) ?? null
  const withoutVersion = parts.filter((part) => !isVersionPathSegment(part))
  if (withoutVersion.length === 0) {
    return { groupParts: [], leafPart: null, version }
  }

  return {
    groupParts: withoutVersion.slice(0, -1),
    leafPart: withoutVersion[withoutVersion.length - 1]!,
    version,
  }
}

/**
 * 解析 llms.txt（Mintlify 等）：`- [Title](url): desc`
 * 按站点栏目建树（Get Started / Protocol / …），不把 URL 里的 v1 强行加成平行层级。
 */
export function extractLlmsTxtToc(text: string, baseOrigin: string): WebDocTocEntry[] {
  const entries: WebDocTocEntry[] = []
  const seenLeaves = new Set<string>()
  const emittedGroups = new Set<string>()
  /** 同一父级下已出现的叶子标题 → 是否需版本后缀 */
  const labelsUnderParent = new Map<string, Set<string>>()

  const linkPattern = /^\s*-\s*\[([^\]]+)\]\(([^)\s]+)\)/gm
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(text)) !== null) {
    const rawLabel = match[1]?.trim()
    const hrefRaw = match[2]?.trim()
    if (!rawLabel || !hrefRaw) continue

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
      entries.push({ href, label: rawLabel, level: 0 })
      if (entries.length >= MAX_TOC_ENTRIES) break
      continue
    }

    const { groupParts, version } = structuralPathParts(parts)

    for (let i = 0; i < groupParts.length; i++) {
      const prefix = groupParts.slice(0, i + 1).join('/')
      const groupKey = `${i}:${prefix}`
      if (emittedGroups.has(groupKey)) continue
      emittedGroups.add(groupKey)
      entries.push({
        href,
        label: humanizePathSegment(groupParts[i]!),
        level: i,
      })
      if (entries.length >= MAX_TOC_ENTRIES) return entries
    }

    if (seenLeaves.has(href)) continue
    seenLeaves.add(href)

    const parentKey = groupParts.join('/') || '_'
    const used = labelsUnderParent.get(parentKey) ?? new Set<string>()
    let label = rawLabel
    if (used.has(rawLabel) && version) {
      label = `${rawLabel} (${version})`
    } else if (used.has(rawLabel) && !version) {
      label = `${rawLabel} (${parts[parts.length - 1]})`
    }
    used.add(rawLabel)
    // 若已用过带版本的同名，也记下最终展示名避免重复
    used.add(label)
    labelsUnderParent.set(parentKey, used)

    entries.push({
      href,
      label,
      level: groupParts.length,
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
