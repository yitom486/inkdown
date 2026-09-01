/** 判断在线文档链接是否应在应用内导航（同站） */
export function shouldNavigateWebDocInApp(href: string, currentPageUrl: string): boolean {
  try {
    const target = new URL(href, currentPageUrl)
    const current = new URL(currentPageUrl)
    if (target.origin !== current.origin) return false
    return target.protocol === 'http:' || target.protocol === 'https:'
  } catch {
    return false
  }
}

export function resolveWebDocClickHref(
  target: EventTarget | null,
  currentPageUrl: string,
): string | null {
  if (!(target instanceof Element)) return null

  const area = target.closest('area')
  if (area instanceof HTMLAreaElement) {
    const href = area.getAttribute('href')?.trim()
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return null
    }
    try {
      return new URL(href, currentPageUrl).toString()
    } catch {
      return null
    }
  }

  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement)) return null

  const href = anchor.getAttribute('href')?.trim()
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null
  }

  try {
    return new URL(href, currentPageUrl).toString()
  } catch {
    return null
  }
}
