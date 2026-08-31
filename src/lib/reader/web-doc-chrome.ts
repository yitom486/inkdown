import type { WebDocSiteId } from '@shared/types/web-doc'

function stripGenericChrome(root: HTMLElement): void {
  root.querySelectorAll('button, form, [role="navigation"], nav, script, iframe, object, embed').forEach(
    (node) => node.remove(),
  )
}

function stripReactDevChrome(root: HTMLElement): void {
  root.querySelectorAll('button').forEach((node) => node.remove())

  root.querySelectorAll('div').forEach((div) => {
    const className = div.className ?? ''
    if (!className.includes('justify-between') || !className.includes('items-start')) return

    const hasBreadcrumb = div.querySelector('a[href="/learn"], a[href="/reference"]')
    if (hasBreadcrumb) {
      div.remove()
    }
  })

  root
    .querySelectorAll('h1 a[aria-label*="Link"], h2 a[aria-label*="Link"], h3 a[aria-label*="Link"]')
    .forEach((node) => node.remove())
}

export function stripWebDocChrome(root: HTMLElement, siteId: WebDocSiteId): void {
  stripGenericChrome(root)

  if (siteId === 'react-dev') {
    stripReactDevChrome(root)
  }
}
