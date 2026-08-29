/** 视口导航单测：按 parent 链设置相对 offsetTop */

export function mockScrollRoot(
  document: Document,
  scrollTop: number,
  clientHeight = 800,
): HTMLElement {
  const scrollRoot = (document.scrollingElement ?? document.documentElement) as HTMLElement
  Object.defineProperty(scrollRoot, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(scrollRoot, 'scrollTop', { configurable: true, value: scrollTop, writable: true })
  return scrollRoot
}

/** 设置元素相对 offsetParent 的 offsetTop（section 1200、h1 0 → 文档坐标 1200） */
export function mockRelativeOffsetTop(element: HTMLElement, offsetTop: number, height = 40): void {
  Object.defineProperty(element, 'offsetTop', { configurable: true, value: offsetTop })
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height })
}

export function mockScrollDocument(
  html: string,
  layout: Array<{ selector?: string; id?: string; top: number; height?: number }>,
  scrollTop: number,
): Document {
  const document = window.document
  document.body.innerHTML = html
  mockScrollRoot(document, scrollTop)

  for (const item of layout) {
    const element = item.id
      ? document.getElementById(item.id)
      : item.selector
        ? document.querySelector(item.selector)
        : null
    if (!element || !(element instanceof HTMLElement)) continue
    mockRelativeOffsetTop(element, item.top, item.height ?? 40)
    const heading = element.matches('h1,h2,h3,h4,h5,h6')
      ? element
      : element.querySelector('h1,h2,h3,h4,h5,h6')
    if (heading instanceof HTMLElement && heading !== element) {
      mockRelativeOffsetTop(heading, 0, item.height ?? 40)
    }
  }

  return document
}
