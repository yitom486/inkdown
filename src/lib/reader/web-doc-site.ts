import type { WebDocSiteId } from '@shared/types/web-doc'

export function resolveWebDocSiteId(pageUrl: string): WebDocSiteId {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase()
    if (host === 'react.dev' || host.endsWith('.react.dev')) {
      return 'react-dev'
    }
  } catch {
    // ignore
  }
  return 'generic-ssr'
}

export function normalizeWebDocInputUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

export function formatWebDocTitle(pageUrl: string, pageTitle?: string): string {
  if (pageTitle?.trim()) return pageTitle.trim()
  return formatWebDocPathLabel(pageUrl)
}

/** 面包屑用：已有 host 时只显示路径或页标题 */
export function formatWebDocPathLabel(pageUrl: string, pageTitle?: string): string {
  if (pageTitle?.trim()) return pageTitle.trim()
  try {
    const url = new URL(pageUrl)
    const path = url.pathname.replace(/\/$/, '') || '/'
    return path === '/' ? url.hostname : path
  } catch {
    return pageUrl
  }
}

export function resolveWebDocTocDiscoveryUrl(pageUrl: string, siteId: WebDocSiteId): string {
  try {
    const url = new URL(pageUrl)
    if (siteId === 'react-dev') {
      if (url.pathname.startsWith('/reference')) {
        return `${url.origin}/reference`
      }
      return `${url.origin}/learn`
    }
    return url.toString()
  } catch {
    return pageUrl
  }
}

/** 在线文档书级 id：与 TOC 发现入口一致，用于阅读标记 filePath */
export function resolveWebDocDocumentId(pageUrl: string, siteId: WebDocSiteId): string {
  return resolveWebDocTocDiscoveryUrl(pageUrl, siteId)
}

export function buildWebDocFileFingerprint(documentId: string): string {
  return `web|${documentId}`
}
