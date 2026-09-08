/**
 * 华人头条（52hrtt.com）资讯正文抽取。
 *
 * 版面特征（资讯正文页）：
 * - 通用选择器全 miss（无 article/main），唯独导航碎片 `div.content`
 *   （"登录/关于我们/下载App"）命中通用表末尾的 `.content`，导致正文被截胡。
 * - 真正文在 `.news_section(.copy-right)` 内（含面包屑/标题/来源与 `.news-content`），
 *   同级 `.comment`（登录喊话）与 `.recommended-column-box`（推荐）须剥离。
 */
export function stripHrttChrome(root: HTMLElement): void {
  root
    .querySelectorAll('.comment, .recommended-column-box, .shortcut_btn, .detail_left')
    .forEach((node) => node.remove())
}

export function pickHrttArticleRoot(doc: Document): HTMLElement {
  for (const selector of ['.news_section', '.news-content']) {
    const node = doc.querySelector(selector)
    if (node instanceof HTMLElement && node.textContent?.trim()) {
      return node
    }
  }

  const fallback = doc.createElement('div')
  fallback.textContent = '未能提取正文'
  return fallback
}
