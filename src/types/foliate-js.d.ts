/**
 * foliate-js（third-party submodule，无自带类型）最小声明。
 * 只覆盖 ReaderAdapter 实际使用的书/目录/CFI 面；view 元素等渲染层在 viewer 阶段再补。
 * 上游自述 API 不稳定，升级 submodule 后若单测变红，先核对这里。
 */
declare module '@foliate/view.js' {
  export interface FoliateTocItem {
    label: string
    href?: string | null
    subitems?: FoliateTocItem[] | null
  }

  export interface FoliateSection {
    /** 章节 href（EPUB）或等价标识 */
    id: string
    linear?: string
    cfi?: string
    size?: number
    load?: () => Promise<unknown>
    unload?: () => void
    createDocument?: () => Promise<Document>
    resolveHref?: (href: string) => string | null
  }

  export interface FoliateBookMetadata {
    title?: string
    language?: string
    [key: string]: unknown
  }

  export interface FoliateBook {
    metadata?: FoliateBookMetadata
    toc?: FoliateTocItem[] | null
    pageList?: FoliateTocItem[] | null
    sections: FoliateSection[]
    dir?: string
    rendition?: { layout?: string }
    resolveHref?: (target: string) => { index: number } | null
  }

  /** 按魔数自动识别 EPUB / MOBI / KF8（ internally 动态 import vendor 解包器） */
  export function makeBook(file: Blob): Promise<FoliateBook>
}

declare module '@foliate/epubcfi.js' {
  export const isCFI: RegExp
  export function parse(cfi: string): unknown
  export function collapse(cfi: string, toEnd?: boolean): string
  export function compare(a: string, b: string): number
  /** 解到 Range；定位失败抛错（调用方逐节 try/catch） */
  export function toRange(doc: Document, parts: unknown): Range
}
