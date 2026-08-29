/**
 * 阅读器视口分节（跨格式）：渲染按 loadKey 连续滚动，导航按 TOC flatIndex 切片。
 * 核心原则：视口激活线处**可见标题**优先，禁止短标签模糊匹配（如「小结」≠「讨论与小结」）。
 */

export interface ViewportNavEntry {
  flatIndex: number
  label: string
  /** EPUB：spine 基路径；MOBI/AZW3：章节 id */
  loadKey: string
  fragment?: string
}

export function normalizeLoadKey(key: string): string {
  return key.split('#')[0]?.toLowerCase() ?? key.toLowerCase()
}

export function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 短标签（≤3 字）仅允许精确匹配，防止「小结」误命中「讨论与小结」 */
export function isHeadingLabelMatch(label: string, headingText: string): boolean {
  const target = normalizeHeadingText(label)
  const text = normalizeHeadingText(headingText)
  if (!target || !text) return false
  if (text === target) return true
  if (target.length <= 3 || text.length <= 3) return false
  if (text.includes(target)) return true
  if (target.includes(text) && text.length >= 5) return true
  return false
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

export function findHeadingElementByLabel(document: Document, label: string): HTMLElement | null {
  const target = normalizeHeadingText(label)
  if (!target) return null

  const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6')
  for (const node of headings) {
    if (!(node instanceof HTMLElement)) continue
    const text = normalizeHeadingText(node.textContent ?? '')
    if (isHeadingLabelMatch(label, text)) return node
  }

  return null
}

export function findViewportEntryAnchor(document: Document, entry: ViewportNavEntry): HTMLElement | null {
  if (entry.fragment) {
    const byFragment = findFragmentElement(document, entry.fragment)
    if (byFragment) return byFragment
  }
  return findHeadingElementByLabel(document, entry.label)
}

function resolveScrollRoot(document: Document): HTMLElement {
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

/** 相对滚动根的文档坐标（沿 parentElement 累加 offsetTop，兼容嵌套 EPUB） */
export function resolveElementScrollTop(element: HTMLElement, scrollRoot: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = element

  while (node && node !== scrollRoot) {
    top += node.offsetTop
    node = node.parentElement
  }

  if (node === scrollRoot) return top

  const elementRect = element.getBoundingClientRect()
  const rootRect = scrollRoot.getBoundingClientRect()
  return elementRect.top - rootRect.top + scrollRoot.scrollTop
}

function filterEntriesForLoadKey(entries: ViewportNavEntry[], loadKey: string): ViewportNavEntry[] {
  const base = normalizeLoadKey(loadKey)
  return entries.filter((entry) => normalizeLoadKey(entry.loadKey) === base)
}

function findPrimaryVisibleHeading(
  document: Document,
  scrollTop: number,
  activationLine: number,
): HTMLElement | null {
  const scrollRoot = resolveScrollRoot(document)
  const bandTop = scrollTop - 8
  const bandBottom = scrollTop + activationLine
  let best: HTMLElement | null = null
  let bestTop = -Infinity

  for (const node of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (!(node instanceof HTMLElement)) continue
    const text = normalizeHeadingText(node.textContent ?? '')
    if (text.length < 2) continue

    const top = resolveElementScrollTop(node, scrollRoot)
    if (top < bandTop - 8 || top > bandBottom) continue
    if (top > bestTop) {
      bestTop = top
      best = node
    }
  }

  return best
}

function findHighestAnchorBeforeActivation(
  candidates: ViewportNavEntry[],
  document: Document,
  activationY: number,
): { flatIndex: number; top: number; hasFragment: boolean } | null {
  const scrollRoot = resolveScrollRoot(document)
  let activeIndex = -1
  let activeTop = -Infinity
  let hasFragment = false

  for (const entry of candidates) {
    const element = findViewportEntryAnchor(document, entry)
    if (!element) continue
    const top = resolveElementScrollTop(element, scrollRoot)
    if (top <= activationY && top > activeTop) {
      activeTop = top
      activeIndex = entry.flatIndex
      hasFragment = Boolean(entry.fragment)
    }
  }

  if (activeIndex < 0) return null
  return { flatIndex: activeIndex, top: activeTop, hasFragment }
}

function findNearestAnchorBelowActivation(
  candidates: ViewportNavEntry[],
  document: Document,
  activationY: number,
): { flatIndex: number; distance: number } | null {
  const scrollRoot = resolveScrollRoot(document)
  let nearestIndex = -1
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const entry of candidates) {
    const element = findViewportEntryAnchor(document, entry)
    if (!element) continue
    const top = resolveElementScrollTop(element, scrollRoot)
    if (top <= activationY) continue
    const distance = top - activationY
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = entry.flatIndex
    }
  }

  if (nearestIndex < 0) return null
  return { flatIndex: nearestIndex, distance: nearestDistance }
}

function matchEntryByVisibleHeading(
  entries: ViewportNavEntry[],
  heading: HTMLElement,
): number {
  const text = normalizeHeadingText(heading.textContent ?? '')
  let bestIndex = -1
  let bestScore = -1

  for (const entry of entries) {
    if (!isHeadingLabelMatch(entry.label, text)) continue
    const score = Math.min(entry.label.length, text.length)
    if (score > bestScore) {
      bestScore = score
      bestIndex = entry.flatIndex
    }
  }

  return bestIndex
}

/**
 * 视口 scroll-spy：与底部导航同一粒度（TOC flatIndex）。
 * 1. 激活带内可见标题（须在视口内，非已滚走的页顶 h1）
 * 2. 最高 fragment/锚点 ≤ 激活线
 * 3. 仅当已滚过父级且无带内标题时，才提升到近距子 fragment
 */
export function findFlatIndexFromViewport(
  document: Document,
  entries: ViewportNavEntry[],
  loadKey: string,
): number {
  const scoped = filterEntriesForLoadKey(entries, loadKey)
  if (scoped.length === 0) return -1

  const scrollRoot = resolveScrollRoot(document)
  const viewportHeight = scrollRoot.clientHeight || document.documentElement.clientHeight
  const activationLine = Math.min(160, viewportHeight * 0.2)
  const scrollTop = scrollRoot.scrollTop
  const activationY = scrollTop + activationLine

  const withAnchor = scoped.filter((entry) => findViewportEntryAnchor(document, entry) !== null)
  const candidates = withAnchor.length > 0 ? withAnchor : scoped

  const visibleHeading = findPrimaryVisibleHeading(document, scrollTop, activationLine)
  if (visibleHeading) {
    const fromHeading = matchEntryByVisibleHeading(scoped, visibleHeading)
    if (fromHeading >= 0) return fromHeading
  }

  const highest = findHighestAnchorBeforeActivation(candidates, document, activationY)
  const nearestBelow = findNearestAnchorBelowActivation(candidates, document, activationY)

  if (!highest) {
    return nearestBelow?.flatIndex ?? candidates[0]!.flatIndex
  }

  const activeEntry = candidates.find((entry) => entry.flatIndex === highest.flatIndex)
  if (
    activeEntry &&
    !activeEntry.fragment &&
    scrollTop > highest.top + activationLine &&
    nearestBelow &&
    nearestBelow.distance < viewportHeight * 0.45
  ) {
    return nearestBelow.flatIndex
  }

  return highest.flatIndex
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
  const top = resolveElementScrollTop(element, scrollRoot)

  element.scrollIntoView({ behavior, block: 'start' })
  scrollRoot.scrollTo({ top, behavior })
  return true
}
