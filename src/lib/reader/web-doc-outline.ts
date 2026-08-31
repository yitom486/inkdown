import { assignHeadingIds, type MarkdownHeading } from '@/lib/editor/markdown-headings'

const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6'

/** 去掉标题旁锚点链接等噪音，得到大纲展示文案 */
export function webDocHeadingPlainText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone
    .querySelectorAll(
      'a.anchor, a.header-anchor, a[aria-hidden="true"], a[aria-label*="heading" i], .anchor, .header-anchor',
    )
    .forEach((node) => node.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function headingLevel(tagName: string): number {
  const match = /^H([1-6])$/i.exec(tagName)
  return match ? Number(match[1]) : 1
}

/**
 * 为正文标题补齐唯一 id，并抽出侧栏大纲（复用 MarkdownHeading 结构）。
 * `line` 使用文内顺序索引，供 DocumentOutline 的 key 去重。
 */
export function ensureWebDocHeadingIds(bodyHtml: string): {
  bodyHtml: string
  headings: MarkdownHeading[]
} {
  const doc = new DOMParser().parseFromString(
    `<div id="web-doc-outline-root">${bodyHtml}</div>`,
    'text/html',
  )
  const root = doc.getElementById('web-doc-outline-root')
  if (!root) {
    return { bodyHtml, headings: [] }
  }

  const elements = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
  const texts = elements.map((el) => webDocHeadingPlainText(el))
  const generated = assignHeadingIds(texts.map((text) => text || 'heading'))
  const used = new Set<string>()

  const headings: MarkdownHeading[] = []

  elements.forEach((el, index) => {
    const text = texts[index] ?? ''
    if (!text) return

    const existing = el.getAttribute('id')?.trim()
    let id = existing && !used.has(existing) ? existing : generated[index]!
    if (used.has(id)) {
      id = `${id}-${index}`
    }
    used.add(id)
    el.setAttribute('id', id)

    headings.push({
      level: headingLevel(el.tagName),
      text,
      line: index,
      id,
    })
  })

  return {
    bodyHtml: root.innerHTML,
    headings,
  }
}

/** 仅抽取（假定 HTML 已含稳定 id；否则仍会生成但不写回） */
export function extractWebDocHeadings(bodyHtml: string): MarkdownHeading[] {
  return ensureWebDocHeadingIds(bodyHtml).headings
}
