import type { ReadingMark } from '@shared/types/reading-mark'
import { highlightFill, liveSelectionCss } from '@/lib/reader/reading-mark-colors'

export {
  filterVisualReadingMarks,
  getReadingMarkKindLabel,
  getReadingMarkLabel,
} from '@/lib/reader/reading-mark-labels'

const MARK_STYLE_ID = 'reader-mark-styles'

export interface EpubMarkHoverHandlers {
  onEnter: (mark: ReadingMark, anchor: DOMRect) => void
  onLeave: () => void
}

/** 注入 EPUB iframe 内联样式（补充 marks-pane SVG 无法覆盖的场景） */
export function injectReadingMarkStyles(doc: Document, theme: 'dark' | 'light'): void {
  if (doc.getElementById(MARK_STYLE_ID)) return

  const style = doc.createElement('style')
  style.id = MARK_STYLE_ID
  style.textContent = `
    ${liveSelectionCss()}
    .reader-mark-highlight {
      background: ${highlightFill('yellow', theme)} !important;
      border-radius: 2px;
    }
  `
  doc.head.appendChild(style)
}

export function getEpubMarkCfiRange(mark: ReadingMark): string | null {
  if (mark.anchor.format !== 'epub') return null
  return mark.anchor.cfiRange ?? mark.anchor.cfi
}

export function getEpubAnnotationType(mark: ReadingMark): 'highlight' | 'underline' {
  return mark.kind === 'note' ? 'underline' : 'highlight'
}

function getHighlightFill(mark: ReadingMark, theme: 'dark' | 'light'): string {
  return highlightFill(mark.color, theme)
}

function getNoteStroke(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? '#fbbf24' : '#d97706'
}

export interface EpubRenditionMarks {
  annotations: {
    add: (
      type: string,
      cfiRange: string,
      data: object,
      cb?: (event: MouseEvent) => void,
      className?: string,
      styles?: Record<string, string>,
    ) => unknown
    remove: (cfiRange: string, type: string) => void
  }
}

function removeEpubMarkBothTypes(rendition: EpubRenditionMarks, cfiRange: string): void {
  for (const type of ['highlight', 'underline'] as const) {
    try {
      rendition.annotations.remove(cfiRange, type)
    } catch {
      // rendition 已销毁或标注不存在
    }
  }
}

export function isPointInMarkGroup(group: Element, clientX: number, clientY: number): boolean {
  for (const rect of group.getClientRects()) {
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return true
    }
  }
  return false
}

export function findEpubMarksAtPoint(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): Array<{ element: Element; markId: string }> {
  const groups = host.querySelectorAll<HTMLElement>(
    'svg g.reader-mark-highlight[data-id], svg g.reader-mark-note[data-id]',
  )
  const hits: Array<{ element: Element; markId: string }> = []
  for (const group of groups) {
    const markId = group.dataset.id
    if (!markId) continue
    if (isPointInMarkGroup(group, clientX, clientY)) {
      hits.push({ element: group, markId })
    }
  }
  return hits
}

export function findEpubNoteMarkAtPoint(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { element: Element; markId: string } | null {
  return (
    findEpubMarksAtPoint(host, clientX, clientY).find((hit) =>
      hit.element.classList.contains('reader-mark-note'),
    ) ?? null
  )
}

export function applyEpubMarkToRendition(
  rendition: EpubRenditionMarks,
  mark: ReadingMark,
  theme: 'dark' | 'light',
): void {
  const cfiRange = getEpubMarkCfiRange(mark)
  if (!cfiRange || mark.kind === 'bookmark') return

  removeEpubMarkBothTypes(rendition, cfiRange)

  const type = getEpubAnnotationType(mark)
  const className = mark.kind === 'note' ? 'reader-mark-note' : 'reader-mark-highlight'
  const styles: Record<string, string> =
    type === 'underline'
      ? {
          fill: getHighlightFill(mark, theme),
          'fill-opacity': '1',
          stroke: getNoteStroke(theme),
          'stroke-opacity': '1',
        }
      : {
          fill: getHighlightFill(mark, theme),
          'fill-opacity': '1',
        }

  rendition.annotations.add(
    type,
    cfiRange,
    {
      id: mark.id,
      note: mark.note ?? '',
      excerpt: mark.excerpt ?? '',
    },
    undefined,
    className,
    styles,
  )
}

export function removeEpubMarkFromRendition(
  rendition: EpubRenditionMarks,
  mark: ReadingMark,
): void {
  const cfiRange = getEpubMarkCfiRange(mark)
  if (!cfiRange) return
  removeEpubMarkBothTypes(rendition, cfiRange)
}

export function applyAllEpubMarksToRendition(
  rendition: EpubRenditionMarks,
  marks: ReadingMark[],
  theme: 'dark' | 'light',
): void {
  for (const mark of marks) {
    if (mark.anchor.format === 'epub') {
      applyEpubMarkToRendition(rendition, mark, theme)
    }
  }
}

/** 先清除再重绘，避免 highlight/underline 叠加或旧类型残留 */
export function replaceAllEpubMarksOnRendition(
  rendition: EpubRenditionMarks,
  marks: ReadingMark[],
  theme: 'dark' | 'light',
): void {
  for (const mark of marks) {
    if (mark.anchor.format !== 'epub') continue
    const cfiRange = getEpubMarkCfiRange(mark)
    if (cfiRange) removeEpubMarkBothTypes(rendition, cfiRange)
  }
  applyAllEpubMarksToRendition(rendition, marks, theme)
}
