export interface MobiChapterItem {
  id: string
  label: string
}

export interface MobiTocItemLike {
  label: string
  href: string
  children?: MobiTocItemLike[]
}

export function flattenMobiToc(
  toc: MobiTocItemLike[],
  resolveChapterId: (href: string) => string | undefined,
): MobiChapterItem[] {
  const result: MobiChapterItem[] = []

  const walk = (items: MobiTocItemLike[]) => {
    for (const item of items) {
      const id = resolveChapterId(item.href)
      if (id) {
        result.push({ id, label: item.label.trim() || '未命名章节' })
      }
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }

  walk(toc)
  return result
}

export function spineToChapterItems(
  spine: Array<{ id: string }>,
): MobiChapterItem[] {
  return spine.map((chapter, index) => ({
    id: chapter.id,
    label: `章节 ${index + 1}`,
  }))
}

export function resolveMobiChapterNav(
  chapters: MobiChapterItem[],
  currentId?: string,
) {
  const currentIndex = chapters.findIndex((chapter) => chapter.id === currentId)
  const current = currentIndex >= 0 ? chapters[currentIndex]! : null
  return {
    current,
    previous: currentIndex > 0 ? chapters[currentIndex - 1]! : null,
    next: currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1]! : null,
    currentIndex,
  }
}
