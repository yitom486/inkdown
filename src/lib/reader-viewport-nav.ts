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

function filterEntriesForLoadKey(entries: ViewportNavEntry[], loadKey: string): ViewportNavEntry[] {
  const base = normalizeLoadKey(loadKey)
  return entries.filter((entry) => normalizeLoadKey(entry.loadKey) === base)
}

function findPrimaryVisibleHeading(
  document: Document,
  scrollTop: number,
  activationLine: number,
): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestTop = -Infinity

  for (const node of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (!(node instanceof HTMLElement)) continue
    const text = normalizeHeadingText(node.textContent ?? '')
    if (text.length < 2) continue

    const top = node.offsetTop
    if (top <= scrollTop + activationLine && top > bestTop) {
      bestTop = top
      best = node
    }
  }

  return best
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
 * 视口 scroll-spy：激活线处可见标题 > fragment 锚点 > 无锚点回退首条。
 * 不做「底部瞄到下一节就切换」——当前节仍在视口主体时必须保持。
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

  const hasFragmentEntry = scoped.some((entry) => entry.fragment)
  const withAnchor = scoped.filter((entry) => findViewportEntryAnchor(document, entry) !== null)
  const candidates = withAnchor.length > 0 ? withAnchor : scoped

  if (hasFragmentEntry) {
    let activeIndex = candidates[0]!.flatIndex
    let activeTop = -Infinity

    for (const entry of candidates) {
      const element = findViewportEntryAnchor(document, entry)
      if (!element) continue
      const top = element.offsetTop
      if (top <= activationY && top > activeTop) {
        activeTop = top
        activeIndex = entry.flatIndex
      }
    }

    let nearestBelowIndex = -1
    let nearestBelowDistance = Number.POSITIVE_INFINITY
    for (const entry of candidates) {
      const element = findViewportEntryAnchor(document, entry)
      if (!element) continue
      const top = element.offsetTop
      if (top <= activationY) continue
      const distance = top - activationY
      if (distance < nearestBelowDistance) {
        nearestBelowDistance = distance
        nearestBelowIndex = entry.flatIndex
      }
    }

    if (activeTop === -Infinity && nearestBelowIndex >= 0) {
      return nearestBelowIndex
    }

    // 无 fragment 的父级标题在顶、正文已进入同页下一 fragment 节（如「第一单元」→「第2章」）
    const activeEntry = candidates.find((entry) => entry.flatIndex === activeIndex)
    if (
      activeEntry &&
      !activeEntry.fragment &&
      activeTop >= 0 &&
      activeTop <= activationLine &&
      nearestBelowIndex >= 0 &&
      nearestBelowDistance < viewportHeight * 0.45
    ) {
      return nearestBelowIndex
    }

    return activeIndex
  }

  const visibleHeading = findPrimaryVisibleHeading(document, scrollTop, activationLine)
  if (visibleHeading) {
    const fromHeading = matchEntryByVisibleHeading(scoped, visibleHeading)
    if (fromHeading >= 0) return fromHeading
  }

  let activeIndex = candidates[0]!.flatIndex
  let activeTop = -Infinity

  for (const entry of candidates) {
    const element = findViewportEntryAnchor(document, entry)
    if (!element) continue
    const top = element.offsetTop
    if (top <= activationY && top > activeTop) {
      activeTop = top
      activeIndex = entry.flatIndex
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
