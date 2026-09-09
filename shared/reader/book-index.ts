/**
 * 书籍结构索引：目录（印刷页 + offset）→ 真实页 → 逐页模块归属。
 * 纯逻辑，主/渲染进程复用；AI 查书先命中索引，不再逐页现场触发 OCR。
 *
 * 页码约定与 ocr-toc-extractor 一致：真实页 = 印刷页 + pageOffset（1-indexed）。
 */

export interface PrintedTocEntry {
  title: string
  level: number
  /** 印刷页（与 pageOffset 换算）；与 realPage 二选一，realPage 优先 */
  printedPage?: number
  /** 真实页（1-indexed）：前言/-phase 页等无印刷页码的条目直接给真实页 */
  realPage?: number
}

export interface BookTocEntry {
  title: string
  /** 真实页（1-indexed，已加 offset） */
  realPage: number
  level: number
}

export interface PageContentInfo {
  page: number
  /** 本页标题行（fusion/OCR 原样，供搜索与展示） */
  headings: string[]
  hasTables: boolean
  charCount: number
}

export interface BookIndexPage {
  /** 真实页（1-indexed） */
  page: number
  /** 所属模块 = 最近的前置目录项；目录首项之前的开篇页为 null */
  module: string | null
  moduleRealPage: number | null
  moduleLevel: number | null
  headings: string[]
  hasTables: boolean
  charCount: number
}

export interface BookIndex {
  version: 1
  pageCount: number
  pageOffset: number
  toc: BookTocEntry[]
  /** 覆盖 1..pageCount 全部真实页（含尚未 OCR 的空页，模块归属只依赖目录） */
  pages: BookIndexPage[]
}

/**
 * 目录换算真实页：realPage 直接给定的优先采用（前言等无印刷页码条目，
 * 以及调用方已在真实页帧的条目）；否则印刷页加 offset。
 * 非法条目丢弃，同页多条按 level 升序（归属时最具体的胜出）。
 */
export function applyTocOffset(
  entries: readonly PrintedTocEntry[],
  pageOffset: number,
): BookTocEntry[] {
  const offset = Number.isFinite(pageOffset) ? Math.round(pageOffset) : 0
  const resolved: BookTocEntry[] = []
  for (const entry of entries) {
    if (!entry) continue
    const title = entry.title.trim()
    if (title.length === 0) continue
    let realPage: number | null = null
    if (Number.isInteger(entry.realPage) && (entry.realPage as number) >= 1) {
      realPage = entry.realPage as number
    } else if (Number.isFinite(entry.printedPage) && (entry.printedPage as number) >= 1) {
      realPage = Math.max(1, Math.round((entry.printedPage as number) + offset))
    }
    if (realPage === null) continue
    resolved.push({ title, realPage, level: entry.level })
  }
  return resolved.sort((a, b) => a.realPage - b.realPage || a.level - b.level)
}

const EMPTY_CONTENT: Omit<PageContentInfo, 'page'> = {
  headings: [],
  hasTables: false,
  charCount: 0,
}

/**
 * 逐页模块归属：P 页的模块 = realPage ≤ P 的最后一条目录项。
 * 内容信息缺失的页只空出 headings/表格/字数，模块照样归属——
 * “第 200 页属于第 3 章”不需要等 OCR 跑完就能回答。
 */
export function buildBookIndex(args: {
  pageCount: number
  pageOffset: number
  printedToc: readonly PrintedTocEntry[]
  contents: readonly PageContentInfo[]
}): BookIndex {
  const { pageCount, pageOffset, printedToc, contents } = args
  const toc = applyTocOffset(printedToc, pageOffset)
  const contentByPage = new Map<number, PageContentInfo>()
  for (const content of contents) {
    if (content && Number.isInteger(content.page) && content.page >= 1 && content.page <= pageCount) {
      contentByPage.set(content.page, content)
    }
  }
  const pages: BookIndexPage[] = []
  let tocCursor = -1
  for (let page = 1; page <= pageCount; page += 1) {
    while (tocCursor + 1 < toc.length && (toc[tocCursor + 1]?.realPage ?? Infinity) <= page) {
      tocCursor += 1
    }
    const module = tocCursor >= 0 ? (toc[tocCursor] ?? null) : null
    const content = contentByPage.get(page) ?? { ...EMPTY_CONTENT, page }
    pages.push({
      page,
      module: module?.title ?? null,
      moduleRealPage: module?.realPage ?? null,
      moduleLevel: module?.level ?? null,
      headings: content.headings,
      hasTables: content.hasTables,
      charCount: content.charCount,
    })
  }
  return { version: 1, pageCount, pageOffset, toc, pages }
}

export function findModuleForPage(index: BookIndex, page: number): BookIndexPage | null {
  if (!Number.isInteger(page) || page < 1 || page > index.pageCount) return null
  return index.pages[page - 1] ?? null
}

/**
 * 模块页范围：[本项 realPage, 下一个同级或更高级项 realPage - 1]，
 * 末项到全书末页。“第4章讲了什么”取章范围，“4.1节”取节范围，各得其所。
 */
export function modulePageRange(index: BookIndex, tocIndex: number): [number, number] | null {
  const entry = index.toc[tocIndex]
  if (!entry) return null
  let end = index.pageCount
  for (let i = tocIndex + 1; i < index.toc.length; i += 1) {
    const next = index.toc[i] as BookTocEntry
    if (next.level <= entry.level) {
      end = next.realPage - 1
      break
    }
  }
  return [entry.realPage, Math.max(entry.realPage, end)]
}

/** 最近的前置一级目录项（章）；目录前/无一级项时返回 null */
export function findChapterForPage(index: BookIndex, page: number): BookTocEntry | null {
  if (!Number.isInteger(page) || page < 1) return null
  let chapter: BookTocEntry | null = null
  for (const entry of index.toc) {
    if (entry.realPage > page) break
    if (entry.level <= 1) chapter = entry
  }
  return chapter
}

/** 展示用：未归属显示“开篇（目录前）”而不是 null */
export function formatModuleLabel(module: string | null): string {
  return module ?? '开篇（目录前）'
}
