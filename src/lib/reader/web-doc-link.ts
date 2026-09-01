export const INKDOWN_NAV_HREF_ATTR = 'data-inkdown-href'

function isNavigableHref(href: string): boolean {
  if (!href || href.startsWith('#')) return false
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false
  return true
}

function toAbsoluteNavUrl(href: string, baseUrl: string): string | null {
  if (!baseUrl) return null
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * 将正文中的可导航链接改写为 data 属性，避免 iframe 直接跳转到原始站点。
 * 实际跳转由 WebDocViewer 统一走 fetch + 解析。
 */
export function neutralizeWebDocNavigationLinks(bodyHtml: string, baseUrl: string): string {
  if (!baseUrl.trim()) return bodyHtml

  const doc = new DOMParser().parseFromString(`<div id="inkdown-nav-root">${bodyHtml}</div>`, 'text/html')
  const root = doc.getElementById('inkdown-nav-root')
  if (!root) return bodyHtml

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const existing = anchor.getAttribute(INKDOWN_NAV_HREF_ATTR)?.trim()
    if (existing) {
      anchor.setAttribute('href', '#')
      anchor.removeAttribute('target')
      return
    }

    const raw = anchor.getAttribute('href')?.trim()
    if (!raw || !isNavigableHref(raw)) return

    const absolute = toAbsoluteNavUrl(raw, baseUrl)
    if (!absolute) {
      anchor.removeAttribute('href')
      return
    }

    anchor.setAttribute(INKDOWN_NAV_HREF_ATTR, absolute)
    anchor.setAttribute('href', '#')
    anchor.removeAttribute('target')
  })

  root.querySelectorAll<HTMLAreaElement>('area[href]').forEach((area) => {
    const raw = area.getAttribute('href')?.trim()
    if (!raw || !isNavigableHref(raw)) return

    const absolute = toAbsoluteNavUrl(raw, baseUrl)
    if (!absolute) {
      area.removeAttribute('href')
      return
    }

    area.setAttribute(INKDOWN_NAV_HREF_ATTR, absolute)
    area.removeAttribute('href')
  })

  return root.innerHTML
}

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

function readInkdownNavHref(element: Element): string | null {
  const fromData = element.getAttribute(INKDOWN_NAV_HREF_ATTR)?.trim()
  if (fromData) return fromData

  const href = element.getAttribute('href')?.trim()
  if (!href || !isNavigableHref(href)) return null
  return href
}

export function resolveWebDocClickHref(
  target: EventTarget | null,
  currentPageUrl: string,
): string | null {
  if (!(target instanceof Element)) return null

  const area = target.closest('area')
  if (area) {
    const href = readInkdownNavHref(area)
    if (!href) return null
    try {
      return new URL(href, currentPageUrl).toString()
    } catch {
      return null
    }
  }

  const anchor = target.closest('a')
  if (!(anchor instanceof HTMLAnchorElement)) return null

  const href = readInkdownNavHref(anchor)
  if (!href) return null

  try {
    return new URL(href, currentPageUrl).toString()
  } catch {
    return null
  }
}

/** iframe 是否已离开 srcdoc 阅读文档（跳到了原始站点） */
export function detectWebDocIframeEscape(
  iframe: HTMLIFrameElement,
  /** 宿主页面 origin（如 http://localhost:5173）；srcdoc 在 Chromium 下常报告此地址，需排除 */
  hostOrigin?: string,
): string | null {
  try {
    const href = iframe.contentWindow?.location.href
    if (!href || href === 'about:srcdoc' || href.startsWith('about:blank')) {
      return null
    }

    if (hostOrigin) {
      try {
        if (new URL(href).origin === new URL(hostOrigin).origin) {
          return null
        }
      } catch {
        // ignore invalid URL
      }
    }

    return href
  } catch {
    return '__cross_origin__'
  }
}

export function isCrossOriginIframeEscape(mark: string | null): mark is '__cross_origin__' {
  return mark === '__cross_origin__'
}
