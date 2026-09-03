import type { WebDocSiteId } from '@shared/types/web-doc'

function stripGenericChrome(root: HTMLElement): void {
  root.querySelectorAll('button, form, [role="navigation"], nav, script, iframe, object, embed').forEach(
    (node) => node.remove(),
  )

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
