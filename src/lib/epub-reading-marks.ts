import type { ReadingMark } from '@shared/types/reading-mark'

const MARK_STYLE_ID = 'reader-mark-styles'

/** 注入 EPUB iframe：高亮底色 + 批注虚线下划线 */
export function injectReadingMarkStyles(doc: Document, theme: 'dark' | 'light'): void {
  if (doc.getElementById(MARK_STYLE_ID)) return

  const style = doc.createElement('style')
  style.id = MARK_STYLE_ID
  style.textContent = `
    .reader-mark-highlight {
      background: ${theme === 'dark' ? 'rgba(122, 162, 247, 0.28)' : 'rgba(59, 130, 246, 0.22)'} !important;
      border-radius: 2px;
    }
    .reader-mark-note {
      background: ${theme === 'dark' ? 'rgba(122, 162, 247, 0.18)' : 'rgba(59, 130, 246, 0.12)'} !important;
      border-bottom: 1px dashed ${theme === 'dark' ? '#7aa2f7' : '#2563eb'} !important;
      border-radius: 2px;
      padding-bottom: 1px;
    }
  `
  doc.head.appendChild(style)
}

export function getEpubMarkCfiRange(mark: ReadingMark): string | null {
  if (mark.anchor.format !== 'epub') return null
  return mark.anchor.cfiRange ?? mark.anchor.cfi
}

export function getReadingMarkLabel(mark: ReadingMark): string {
  if (mark.label?.trim()) return mark.label.trim()
  if (mark.excerpt?.trim()) {
    const text = mark.excerpt.trim()
    return text.length > 48 ? `${text.slice(0, 48)}…` : text
  }
  if (mark.kind === 'bookmark') return '书签'
  if (mark.kind === 'note') return '批注'
  return '高亮'
}

export function getReadingMarkKindLabel(kind: ReadingMark['kind']): string {
  switch (kind) {
    case 'bookmark':
      return '书签'
    case 'highlight':
      return '高亮'
    case 'note':
      return '批注'
  }
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
    ) => void
    remove: (cfiRange: string, type: string) => void
  }
}

export function applyEpubMarkToRendition(
  rendition: EpubRenditionMarks,
  mark: ReadingMark,
): void {
  const cfiRange = getEpubMarkCfiRange(mark)
  if (!cfiRange || mark.kind === 'bookmark') return

  const className = mark.kind === 'note' ? 'reader-mark-note' : 'reader-mark-highlight'
  rendition.annotations.add('highlight', cfiRange, { id: mark.id }, () => undefined, className, {})
}

export function removeEpubMarkFromRendition(
  rendition: EpubRenditionMarks,
  mark: ReadingMark,
): void {
  const cfiRange = getEpubMarkCfiRange(mark)
  if (!cfiRange) return
  try {
    rendition.annotations.remove(cfiRange, 'highlight')
  } catch {
    // rendition 已销毁
  }
}

export function applyAllEpubMarksToRendition(
  rendition: EpubRenditionMarks,
  marks: ReadingMark[],
): void {
  for (const mark of marks) {
    if (mark.anchor.format === 'epub') {
      applyEpubMarkToRendition(rendition, mark)
    }
  }
}
