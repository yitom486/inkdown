import type Book from 'epubjs/types/book'
import type { EpubChapter } from '@/lib/reader/epub-navigation'
import { normalizeLoadKey } from '@/lib/reader/reader-viewport-nav'

/** epubjs 的 Section 只导出了极松的类型，这里只声明用得到的部分 */
export interface EpubSpineItem {
  href: string
  document?: Document
  load: (request: unknown) => Promise<unknown>
  unload?: () => void
}

export function collectEpubSpineItems(book: Book): EpubSpineItem[] {
  const items: EpubSpineItem[] = []
  const spine = (book as unknown as {
    spine?: { each?: (cb: (item: EpubSpineItem) => void) => void }
  }).spine
  spine?.each?.((item) => {
    if (item?.href) items.push(item)
  })
  return items
}

/**
 * 取一个 spine 单元的纯文本。
 *
 * 只卸载「本次才加载」的单元：epubjs 的 `unload()` 会吊销 blob URL，
 * 对当前正在显示的章节做这件事会把画面弄坏。
 */
export async function loadEpubSpineText(book: Book, item: EpubSpineItem): Promise<string> {
  const wasLoaded = Boolean(item.document)
  try {
    const loaded = (await item.load(book.load.bind(book))) as {
      body?: { textContent?: string | null }
      textContent?: string | null
    } | null
    return loaded?.body?.textContent ?? loaded?.textContent ?? ''
  } catch {
    return ''
  } finally {
    if (!wasLoaded) item.unload?.()
  }
}

/** spine 的 href 对不上目录时退回 href 本身，至少让 Agent 能报出位置 */
export function labelForSpineHref(chapters: EpubChapter[], href: string): string {
  const key = normalizeLoadKey(href)
  return chapters.find((chapter) => normalizeLoadKey(chapter.href) === key)?.label ?? href
}
