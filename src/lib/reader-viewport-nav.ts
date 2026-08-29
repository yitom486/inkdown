/**
 * 阅读器视口分节（跨格式）：渲染按 loadKey（spine / 章节 id）连续滚动，
 * 导航按 TOC flatIndex 切片；scroll-spy 负责对齐二者。
 */

export interface ViewportNavEntry {
  flatIndex: number
  label: string
  /** EPUB：spine 文件基路径；MOBI/AZW3：章节 id */
  loadKey: string
  /** EPUB fragment；MOBI 通常无，改按标题匹配 */
  fragment?: string
}

export function normalizeLoadKey(key: string): string {
  return key.split('#')[0]?.toLowerCase() ?? key.toLowerCase()
}

function decodeFragment(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function findFragmentElement(document: Document, fragment: string): HTMLElement | null {
  const decoded = decodeFragment(fragment)
  for (const id of [fragment, decoded]) {
    const byId = document.getElementById(id)
    if (byId) return byId
    const byQuery = document.querySelector(`#${CSS.escape(id)}`)
    if (byQuery instanceof HTMLElement) return byQuery
    const byName = document.querySelector(`a[name="${id}"]`)
    if (byName instanceof HTMLElement) return byName
  }
  return null
}

function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** MOBI/AZW3 等同 spine 多 TOC：按标题文本找锚点 */
export function findHeadingElementByLabel(document: Document, label: string): HTMLElement | null {
  const target = normalizeHeadingText(label)
  if (!target) return null

  const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6')
  for (const node of headings) {
    if (!(node instanceof HTMLElement)) continue
    const text = normalizeHeadingText(node.textContent ?? '')
    if (!text) continue
    if (text === target || text.includes(target) || target.includes(text)) {
      return node
    }
  }

  return null
}

export function findViewportEntryAnchor(document: Document, entry: ViewportNavEntry): HTMLElement | null {
  if (entry.fragment) {
    return findFragmentElement(document, entry.fragment)
  }
  return findHeadingElementByLabel(document, entry.label)
}

function resolveScrollRoot(document: Document): HTMLElement {
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

function filterEntriesForLoadKey(entries: ViewportNavEntry[], loadKey: string): ViewportNavEntry[] {
  const base = normalizeLoadKey(loadKey)
  return entries.filter((entry) => normalizeLoadKey(entry.loadKey) === base)
}

/**
 * 根据视口定位当前 TOC flatIndex。
 * 1. scroll-spy：锚点顶越过激活线
 * 2. 交界提升：下一节标题已在视口内露出
 */
export function findFlatIndexFromViewport(
  document: Document,
  entries: ViewportNavEntry[],
  loadKey: string,
): number {
  const scoped = filterEntriesForLoadKey(entries, loadKey)
  if (scoped.length === 0) return -1

  const withAnchor = scoped.filter((entry) => findViewportEntryAnchor(document, entry) !== null)
  const candidates = withAnchor.length > 0 ? withAnchor : scoped

  const scrollRoot = resolveScrollRoot(document)
  const viewportHeight = scrollRoot.clientHeight || document.documentElement.clientHeight
  const activationLine = Math.min(160, viewportHeight * 0.2)
  const scrollTop = scrollRoot.scrollTop

  let activeIndex = candidates[0]!.flatIndex

  for (const entry of candidates) {
    const element = findViewportEntryAnchor(document, entry)
    if (!element) continue
    if (element.offsetTop <= scrollTop + activationLine) {
      activeIndex = entry.flatIndex
    }
  }

  const viewportBottom = scrollTop + viewportHeight

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const entry = candidates[i]!
    if (entry.flatIndex <= activeIndex) break

    const element = findViewportEntryAnchor(document, entry)
    if (!element) continue

    const top = element.offsetTop
    const bottom = top + element.offsetHeight
    const headingPeekVisible =
      top < viewportBottom - 24 && bottom > scrollTop + activationLine * 0.75

    if (headingPeekVisible) {
      activeIndex = entry.flatIndex
      break
    }
  }

  return activeIndex
}

export function scrollToViewportEntry(
  document: Document,
  entry: ViewportNavEntry,
  options?: { behavior?: ScrollBehavior },
): boolean {
  const element = findViewportEntryAnchor(document, entry)
  if (!element) return false

  const behavior = options?.behavior ?? 'smooth'
  const scrollRoot = resolveScrollRoot(document)
  const top = element.offsetTop

  element.scrollIntoView({ behavior, block: 'start' })
  scrollRoot.scrollTo({ top, behavior })
  return true
}
