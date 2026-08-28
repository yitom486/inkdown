import type { ReadingMark } from '@shared/types/reading-mark'

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

export function isReadingMarkForChapter(
  mark: ReadingMark,
  chapterId: string,
): boolean {
  return mark.anchor.format === 'mobi' && String(mark.anchor.chapterId) === String(chapterId)
}

export function filterVisualReadingMarks(
  marks: ReadingMark[],
  chapterId: string,
): ReadingMark[] {
  return marks.filter((mark) => {
    if (!isReadingMarkForChapter(mark, chapterId)) return false
    if (mark.kind === 'bookmark') return false
    if (mark.anchor.format !== 'mobi') return false
    const text = (mark.excerpt ?? mark.anchor.selectedText ?? '').trim()
    return Boolean(text || mark.anchor.rects?.length)
  })
}
