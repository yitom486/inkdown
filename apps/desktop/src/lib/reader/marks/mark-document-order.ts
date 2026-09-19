import type { ReadingMark } from '@inkdown/contracts'

/**
 * 卡片按文档位置排序：先按目录键序（章），同章内保持原相对顺序（创建时间序），
 * 无章节归属的沉底。让卡片纵序与正文纵序一致，是同滚联动的前提。
 */
export function sortMarksByDocumentPosition(
  marks: ReadingMark[],
  chapterOrder: string[],
  chapterKeyOf: (mark: ReadingMark) => string | null,
): ReadingMark[] {
  if (chapterOrder.length === 0) return [...marks]
  const orderIndex = new Map<string, number>()
  chapterOrder.forEach((key, idx) => {
    if (!orderIndex.has(key)) orderIndex.set(key, idx)
  })
  return marks
    .map((mark, originalIndex) => {
      let chapterIdx: number | null = null
      try {
        const key = chapterKeyOf(mark)
        chapterIdx = key !== null && orderIndex.has(key) ? (orderIndex.get(key) as number) : null
      } catch {
        chapterIdx = null
      }
      return { mark, chapterIdx, originalIndex }
    })
    .sort((a, b) => {
      const ai = a.chapterIdx ?? Number.POSITIVE_INFINITY
      const bi = b.chapterIdx ?? Number.POSITIVE_INFINITY
      if (ai !== bi) return ai - bi
      return a.originalIndex - b.originalIndex
    })
    .map((row) => row.mark)
}
