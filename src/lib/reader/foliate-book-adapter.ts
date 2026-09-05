/**
 * foliate 统一后端：EPUB / MOBI / KF8 同一套实现。
 * - 入口统一用 `makeBook` 按魔数识别（不按扩展名分流，解决双格式 MOBI 误判整类问题）。
 * - `view.js` 动态导入：模块顶层执行 `customElements.define` 需要 DOM，
 *   且避免首屏 chunk 被拖入 foliate。
 * - 需要 DOM 全局（浏览器 / happy-dom 单测）；bun 纯脚本环境不可用。
 */
import { parse as parseCfi, toRange as cfiToRange, isCFI as isCfiPattern } from '@foliate/epubcfi.js'
import type { FoliateBook, FoliateTocItem } from '@foliate/view.js'
import {
  detectAdapterBookKind,
  type AdapterBookKind,
  type AdapterLocation,
  type AdapterSectionInfo,
  type AdapterTocItem,
  type IReaderBookAdapter,
} from '@/lib/reader/reader-adapter'

function normalizeSectionId(id: string): string {
  const noFragment = id.split('#')[0] ?? id
  return decodeURI(noFragment).replace(/^\.\//, '')
}

function findSectionIndex(sectionIds: string[], href: string): number | null {
  const normalized = normalizeSectionId(href)
  if (!normalized) return null
  const exact = sectionIds.findIndex((id) => normalizeSectionId(id) === normalized)
  if (exact >= 0) return exact
  const base = normalized.split('/').pop() ?? normalized
  const byBase = sectionIds.findIndex((id) => {
    const idBase = normalizeSectionId(id).split('/').pop() ?? ''
    return idBase !== '' && idBase === base
  })
  return byBase >= 0 ? byBase : null
}

function mapTocItem(
  item: FoliateTocItem,
  sectionIds: string[],
): AdapterTocItem {
  return {
    label: item.label ?? '',
    href: item.href ?? null,
    sectionIndex: item.href ? findSectionIndex(sectionIds, item.href) : null,
    children: (item.subitems ?? []).map((child) => mapTocItem(child, sectionIds)),
  }
}

export class FoliateBookAdapter implements IReaderBookAdapter {
  readonly kind: AdapterBookKind
  readonly title: string
  readonly language?: string
  readonly toc: AdapterTocItem[]
  readonly sections: AdapterSectionInfo[]

  private constructor(
    private readonly book: FoliateBook,
    kind: AdapterBookKind,
  ) {
    this.kind = kind
    this.title = book.metadata?.title ?? ''
    this.language = book.metadata?.language
    const sectionIds = book.sections.map((section) => section.id)
    this.toc = (book.toc ?? []).map((item) => mapTocItem(item, sectionIds))
    this.sections = book.sections.map((section, index) => ({
      index,
      id: section.id,
      linear: section.linear !== 'no',
    }))
    this.sectionIds = sectionIds
  }

  private readonly sectionIds: string[]

  static async open(data: Uint8Array, fileName: string): Promise<FoliateBookAdapter> {
    const { makeBook } = await import('@foliate/view.js')
    const file = new File([data as BlobPart], fileName)
    const book = await makeBook(file)
    return new FoliateBookAdapter(book, detectAdapterBookKind(fileName))
  }

  async loadSectionText(index: number): Promise<string> {
    const section = this.book.sections[index]
    if (!section?.createDocument) return ''
    const doc = await section.createDocument()
    return doc.documentElement?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  }

  resolveHref(href: string): number | null {
    return findSectionIndex(this.sectionIds, href)
  }

  async resolveLegacyEpubCfi(cfi: string): Promise<AdapterLocation | null> {
    const normalized = cfi.trim()
    if (!isCfiPattern.test(normalized)) return null
    let parts: unknown
    try {
      parts = parseCfi(normalized)
    } catch {
      return null
    }
    // 章节级定位：对每节文档试解，首个成功者即归属（range 精度 viewer 阶段补）。
    for (let index = 0; index < this.book.sections.length; index++) {
      const section = this.book.sections[index]
      if (!section?.createDocument) continue
      try {
        const doc = await section.createDocument()
        cfiToRange(doc, parts)
        return { sectionIndex: index, cfi: normalized }
      } catch {
        continue
      }
    }
    return null
  }

  toLegacyEpubCfi(location: AdapterLocation): string | null {
    if (location.cfi && isCfiPattern.test(location.cfi)) return location.cfi
    const section = this.book.sections[location.sectionIndex]
    // spine 基线 CFI；range 级精度待 viewer 阶段（需渲染后 Range）补充
    return section?.cfi ?? null
  }

  destroy(): void {
    for (const section of this.book.sections) {
      try {
        section.unload?.()
      } catch {
        // 卸载失败不影响关闭流程
      }
    }
  }
}

export async function openFoliateBook(
  data: Uint8Array,
  fileName: string,
): Promise<FoliateBookAdapter> {
  return FoliateBookAdapter.open(data, fileName)
}
