import type { ReadingMark } from '@shared/types/reading-mark'

export function rankVisualMarks(marks: ReadingMark[]): ReadingMark[] {
  return [...marks].sort((a, b) => {
    if (a.kind === 'note' && b.kind !== 'note') return -1
    if (a.kind !== 'note' && b.kind === 'note') return 1
    return b.updatedAt - a.updatedAt
  })
}

export function isClickNotDrag(
  origin: { x: number; y: number } | null,
  event: { clientX: number; clientY: number },
  threshold = 6,
): boolean {
  if (!origin) return false
  return Math.hypot(event.clientX - origin.x, event.clientY - origin.y) <= threshold
}

export function findMarkForSelection(
  marks: ReadingMark[],
  params: {
    format: 'pdf' | 'epub' | 'mobi'
    text: string
    page?: number
    cfiRange?: string
    chapterId?: string
  },
): ReadingMark | undefined {
  const text = params.text.trim()
  if (!text) return undefined

  const matched = marks.filter((mark) => {
    if (mark.kind === 'bookmark') return false
    if (mark.anchor.format !== params.format) return false
    const excerpt = (mark.excerpt ?? mark.anchor.selectedText ?? '').trim()
    if (excerpt !== text) return false
    if (mark.anchor.format === 'pdf') {
      return mark.anchor.page === params.page
    }
    if (mark.anchor.format === 'epub') {
      if (!params.cfiRange) return true
      return (mark.anchor.cfiRange ?? mark.anchor.cfi) === params.cfiRange
    }
    return String(mark.anchor.chapterId) === String(params.chapterId)
  })

  return rankVisualMarks(matched)[0]
}

export function uniqueMarksById(marks: ReadingMark[]): ReadingMark[] {
  const seen = new Set<string>()
  const result: ReadingMark[] = []
  for (const mark of marks) {
    if (seen.has(mark.id)) continue
    seen.add(mark.id)
    result.push(mark)
  }
  return result
}
