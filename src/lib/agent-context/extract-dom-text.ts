/**
 * 从阅读器 iframe 的 document 里取可读正文。
 * 优先 `innerText`（尊重 CSS 换行与隐藏元素），退回 `textContent`。
 */
export function extractDocumentText(doc: Document | null | undefined): string {
  const body = doc?.body
  if (!body) return ''
  return body.innerText || body.textContent || ''
}
