import type { WebDocSiteId } from '@inkdown/contracts'
import { stripDisallowedWebDocEmbeds } from '@/lib/reader/web-doc/web-doc-embeds'
import { stripHrttChrome } from '@/lib/reader/web-doc/hrtt-extract'

const EDIT_PAGE_LABEL =
  /编辑此页|编辑本页|在\s*github\s*上编辑|edit this page|edit this file|edit on github|improve this page/i

const DOC_CHROME_BUTTON_LABEL =
  /copy(?:\s+(?:page|link|code))?|edit(?:\s+(?:this\s+)?(?:page|file))?|open\s+menu|search|toggle\s+(?:menu|navigation)|previous|next/i

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6'

function isDocChromeButton(button: HTMLButtonElement): boolean {
  if (button.closest('header, nav, [role="navigation"]')) return true

  const label = [
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const className = String(button.className ?? '')

  return DOC_CHROME_BUTTON_LABEL.test(label) || /(?:^|[-_\s])(copy|edit|menu|search)(?:[-_\s]|$)/i.test(className)
}

/**
 * MDX 组件（例如 Mintlify 的 ResponseField）可能把字段名输出成 button。
 * 站点脚本不会随正文一起运行，因此保留交互元素没有意义，但不能丢掉其中的字段文本。
 * 已知页面工具按钮直接移除，其余 button 降级成普通 inline 元素。
 */
function preserveSemanticButtonText(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (isDocChromeButton(button)) {
      button.remove()
      return
    }

    const text = button.textContent?.replace(/\s+/g, ' ').trim()
    if (!text) {
      button.remove()
      return
    }

    const replacement = root.ownerDocument.createElement('span')
    replacement.className = 'web-doc-semantic-control'
    while (button.firstChild) {
      replacement.appendChild(button.firstChild)
    }
    button.replaceWith(replacement)
  })
}

function stripHeadingPermalinks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach((heading) => {
    heading.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      const ariaLabel = anchor.getAttribute('aria-label')?.toLowerCase() ?? ''
      const className = anchor.className ?? ''
      const text = anchor.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      const href = anchor.getAttribute('href') ?? ''
      const isNamedPermalink =
        ariaLabel.includes('heading') ||
        ariaLabel.includes('link for') ||
        /(?:^|\s)(?:anchor|header-anchor)(?:\s|$)/i.test(className)
      const isIconOnlyFragment = href.startsWith('#') && (!text || text === '#') && Boolean(anchor.querySelector('svg, img'))

      if (isNamedPermalink || isIconOnlyFragment) {
        anchor.remove()
      }
    })
  })
}

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
  root.querySelectorAll('form, [role="navigation"], nav').forEach((node) => node.remove())
  stripDisallowedWebDocEmbeds(root)

  stripDocsEditChrome(root)
  preserveSemanticButtonText(root)

  // 常见 docs 主题：面包屑工具条、标题旁「复制链接」图标（不绑域名）
  root.querySelectorAll('div').forEach((div) => {
    const className = div.className ?? ''
    if (!className.includes('justify-between') || !className.includes('items-start')) return
    const hasBreadcrumb = div.querySelector('a[href^="/"]')
    if (hasBreadcrumb && div.querySelectorAll('a').length <= 4) {
      div.remove()
    }
  })

  stripHeadingPermalinks(root)
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
  if (siteId === 'hrtt-news') {
    stripHrttChrome(root)
  }
}
