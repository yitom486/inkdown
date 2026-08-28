import type { ReadingMark } from '@shared/types/reading-mark'

const MARK_SELECTOR = '.mobi-mark-highlight, .mobi-mark-note, .mobi-mark-note-hit'

function pointInClientRect(x: number, y: number, rect: DOMRect, padding = 0): boolean {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  )
}

function findNoteMarkElement(doc: Document, clientX: number, clientY: number): HTMLElement | null {
  const hit = doc.elementFromPoint(clientX, clientY)
  if (hit instanceof HTMLElement) {
    const marked = hit.closest<HTMLElement>('.mobi-mark-note[data-mark-id], .mobi-mark-note-hit[data-mark-id]')
    if (marked?.dataset.markId) return marked
  }

  const body = doc.body
  if (!body) return null

  for (const element of body.querySelectorAll<HTMLElement>(
    'span.mobi-mark-note[data-mark-id], .mobi-mark-note-hit[data-mark-id]',
  )) {
    if (pointInClientRect(clientX, clientY, element.getBoundingClientRect(), 4)) {
      return element
    }
  }

  return null
}

function unwrapMarkElement(element: Element): void {
  const parent = element.parentNode
  if (!parent) {
    element.remove()
    return
  }
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  parent.removeChild(element)
}

export function clearMobiMarkOverlays(container: HTMLElement | null): void {
  if (!container) return

  container.querySelectorAll(MARK_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement && node.id === 'reader-mark-layer') {
      node.replaceChildren()
      return
    }
    if (node instanceof HTMLSpanElement) {
      unwrapMarkElement(node)
      return
    }
    node.remove()
  })

  container.querySelector('#reader-mark-layer')?.replaceChildren()
}

function getMarkSearchText(mark: ReadingMark): string {
  if (mark.anchor.format !== 'mobi') return ''
  return (mark.excerpt ?? mark.anchor.selectedText ?? '').trim()
}

function findTextRange(root: HTMLElement, searchText: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (parent?.closest(MARK_SELECTOR)) return NodeFilter.FILTER_REJECT
      if (parent?.closest('script, style')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let combined = ''
  const segments: Array<{ node: Text; start: number; end: number }> = []

  let current = walker.nextNode()
  while (current) {
    const textNode = current as Text
    const text = textNode.textContent ?? ''
    const start = combined.length
    combined += text
    segments.push({ node: textNode, start, end: combined.length })
    current = walker.nextNode()
  }

  const index = combined.indexOf(searchText)
  if (index === -1) return null

  const endIndex = index + searchText.length
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const segment of segments) {
    if (!startNode && index >= segment.start && index < segment.end) {
      startNode = segment.node
      startOffset = index - segment.start
    }
    if (endIndex > segment.start && endIndex <= segment.end) {
      endNode = segment.node
      endOffset = endIndex - segment.start
      break
    }
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

function wrapMarkRange(range: Range, className: string, markId: string): boolean {
  const span = document.createElement('span')
  span.className = className
  span.dataset.markId = markId

  try {
    range.surroundContents(span)
    return true
  } catch {
    const extracted = range.extractContents()
    span.appendChild(extracted)
    range.insertNode(span)
    return true
  }
}

function applyMobiTextMark(root: HTMLElement, mark: ReadingMark): boolean {
  const searchText = getMarkSearchText(mark)
  if (!searchText) return false

  const range = findTextRange(root, searchText)
  if (!range) return false

  const className = mark.kind === 'note' ? 'mobi-mark-note' : 'mobi-mark-highlight'
  return wrapMarkRange(range, className, mark.id)
}

function ensureMarkLayer(body: HTMLElement): HTMLElement {
  let layer = body.querySelector('#reader-mark-layer') as HTMLElement | null
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'reader-mark-layer'
    layer.setAttribute('aria-hidden', 'true')
    body.appendChild(layer)
  }
  layer.style.height = `${Math.max(body.scrollHeight, body.offsetHeight)}px`
  return layer
}

function appendRectOverlay(
  layer: HTMLElement,
  rect: { x: number; y: number; width: number; height: number },
  className: string,
  markId: string,
  interactive: boolean,
): void {
  const element = document.createElement('div')
  element.className = className
  element.dataset.markId = markId
  element.style.position = 'absolute'
  element.style.left = `${rect.x * 100}%`

  if (className.includes('mobi-mark-note')) {
    element.classList.add('mobi-mark-note-hit')
    element.style.width = `${rect.width * 100}%`
    element.style.top = `${rect.y * 100}%`
    element.style.height = `${rect.height * 100}%`
  } else {
    element.style.top = `${rect.y * 100}%`
    element.style.width = `${rect.width * 100}%`
    element.style.height = `${rect.height * 100}%`
  }

  element.style.pointerEvents = interactive ? 'auto' : 'none'
  layer.appendChild(element)
}

export function renderMobiMarkOverlays(
  container: HTMLElement | null,
  marks: ReadingMark[],
  chapterId: string,
): void {
  if (!container) return
  clearMobiMarkOverlays(container)

  const normalizedChapterId = String(chapterId)
  const layer = ensureMarkLayer(container)

  for (const mark of marks) {
    if (mark.anchor.format !== 'mobi') continue
    if (String(mark.anchor.chapterId) !== normalizedChapterId) continue
    if (mark.kind === 'bookmark') continue

    const className = mark.kind === 'note' ? 'mobi-mark-note' : 'mobi-mark-highlight'
    const appliedByText = applyMobiTextMark(container, mark)

    if (!appliedByText && mark.anchor.rects?.length) {
      for (const rect of mark.anchor.rects) {
        appendRectOverlay(layer, rect, className, mark.id, mark.kind === 'note')
      }
    }
  }
}

export function findMobiNoteMarkAtPoint(
  doc: Document,
  clientX: number,
  clientY: number,
): { markId: string; element: HTMLElement } | null {
  const marked = findNoteMarkElement(doc, clientX, clientY)
  if (!marked?.dataset.markId) return null
  if (!marked.classList.contains('mobi-mark-note') && !marked.classList.contains('mobi-mark-note-hit')) {
    return null
  }
  return { markId: marked.dataset.markId, element: marked }
}
