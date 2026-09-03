import type { WebDocSiteId } from '@shared/types/web-doc'
import { stripDisallowedWebDocEmbeds } from '@/lib/reader/web-doc-embeds'

const EDIT_PAGE_LABEL =
  /编辑此页|编辑本页|在\s*github\s*上编辑|edit this page|edit this file|edit on github|improve this page/i

/** MkDocs Material / 常见 docs：「编辑此页」等站点控件，非正文插图 */
function stripDocsEditChrome(root: HTMLElement): void {
  root.querySelectorAll('a.md-content__button, .md-content__button, a.md-source').forEach((node) => {
    node.remove()
  })

  root.querySelectorAll('a[title], a[aria-label]').forEach((anchor) => {
    const label = `${anchor.getAttribute('title') ?? ''} ${anchor.getAttribute('aria-label') ?? ''}`
    if (EDIT_PAGE_LABEL.test(label)) {
      anchor.remove()
    }
  })

  // GitHub 源码/编辑链且几乎只有图标（无尺寸 SVG 会撑满阅读区）
  root.querySelectorAll('a[href*="github.com"]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    if (!/\/(edit|blob|tree)\//.test(href)) return
    const text = (anchor.textContent ?? '').replace(/\s+/g, ' ').trim()
    const hasIcon = Boolean(anchor.querySelector('svg, img'))
    if (hasIcon && text.length < 12) {
      anchor.remove()
    }
  })
}

function stripGenericChrome(root: HTMLElement): void {
  root.querySelectorAll('button, form, [role="navigation"], nav').forEach((node) => node.remove())
  stripDisallowedWebDocEmbeds(root)

  stripDocsEditChrome(root)

  // 常见 docs 主题：面包屑工具条、标题旁「复制链接」图标（不绑域名）
  root.querySelectorAll('div').forEach((div) => {
    const className = div.className ?? ''
    if (!className.includes('justify-between') || !className.includes('items-start')) return
    const hasBreadcrumb = div.querySelector('a[href^="/"]')
    if (hasBreadcrumb && div.querySelectorAll('a').length <= 4) {
      div.remove()
    }
  })

  root
    .querySelectorAll('h1 a[aria-label*="Link"], h2 a[aria-label*="Link"], h3 a[aria-label*="Link"]')
    .forEach((node) => node.remove())
}

function stripPeopleDailyChrome(root: HTMLElement): void {
  root.querySelectorAll('style, map, area, img[usemap]').forEach((node) => node.remove())
  root.querySelectorAll('h2:empty, h3:empty').forEach((node) => node.remove())
}

export function stripWebDocChrome(root: HTMLElement, siteId: WebDocSiteId): void {
  stripGenericChrome(root)

  if (siteId === 'people-daily-paper') {
    stripPeopleDailyChrome(root)
  }
}
