/**
 * 从阅读器 iframe 的 document 里取可读正文。
 * 优先 `innerText`（尊重 CSS 换行与隐藏元素），退回 `textContent`。
 */
export function extractDocumentText(doc: Document | null | undefined): string {
  const body = doc?.body
  if (!body) return ''
  return body.innerText || body.textContent || ''
}

/**
 * 把未挂载的章节 HTML 转成纯文本。
 * 只能用 `textContent`：文档没有 layout，`innerText` 会返回空串。
 */
export function htmlToText(html: string): string {
  if (!html) return ''
  return new DOMParser().parseFromString(html, 'text/html').body?.textContent ?? ''
}

function resolveScrollRoot(doc: Document): HTMLElement {
  return (doc.scrollingElement ?? doc.documentElement) as HTMLElement
}

/**
 * 取当前视口内可见块的纯文本（约「一屏」），避免把整章塞给 Agent。
 * 无 layout / 无可见块时退回全文（再由上层截断）。
 */
export function extractViewportText(doc: Document | null | undefined): string {
  if (!doc?.body) return ''

  const scrollRoot = resolveScrollRoot(doc)
  const rootRect = scrollRoot.getBoundingClientRect()
  const viewTop = rootRect.top
  const viewBottom = rootRect.bottom || viewTop + (scrollRoot.clientHeight || 0)

  if (viewBottom <= viewTop) {
    return extractDocumentText(doc)
  }

  const blocks = doc.body.querySelectorAll(
    'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, th, dt, dd, figcaption, section, article, div',
  )

  const parts: string[] = []
  for (const node of blocks) {
    if (!(node instanceof HTMLElement)) continue
    // 跳过仅作容器、自身几乎无直接文本的深层嵌套（仍会扫到其子 p/h*）
    if (node.tagName === 'DIV' || node.tagName === 'SECTION' || node.tagName === 'ARTICLE') {
      const hasBlockChild = node.querySelector(
        'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, td, th, div, section, article',
      )
      if (hasBlockChild) continue
    }

    const rect = node.getBoundingClientRect()
    if (rect.height <= 0 || rect.width <= 0) continue
    if (rect.bottom < viewTop || rect.top > viewBottom) continue

    const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) parts.push(text)
  }

  if (parts.length === 0) return extractDocumentText(doc)
  return parts.join('\n\n')
}
