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
    /** 章节标识（EPUB 为 OPF 相对 href；MOBI 为数字序号） */
    id: string | number
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

  /** view 级 relocate 明细（注意 paginator 级另有一套 {reason,range,index} 形状） */
  export interface FoliateRelocateDetail {
    /** 全书进度 0–1（已按节大小加权） */
    fraction: number
    section?: { current?: number; total?: number }
    tocItem?: { label?: string } | null
    pageItem?: { label?: string } | null
    cfi?: string
    range?: Range | null
  }

  export interface FoliateLoadDetail {
    doc: Document
    index: number
  }

  export interface FoliateLinkDetail {
    a: HTMLAnchorElement
    href?: string
    href_?: string
  }

  export interface FoliateShowAnnotationDetail {
    value: string
    index: number
    range: Range
  }

  export interface FoliateDrawAnnotationDetail {
    draw: (drawFunc: unknown, drawOptions?: unknown) => void
    annotation: { value: string }
    doc: Document | null
    range: Range
  }

  export interface FoliateContentsItem {
    doc: Document
    index: number
    overlayer?: {
      hitTest: (point: { x: number; y: number }) => [] | [unknown, Range]
      redraw?: () => void
    }
  }

  /** `<foliate-view>` 自定义元素（命令式创建，见 FoliateReaderViewer）。
   * 注：事件监听用方括号外跨的 `as EventListener` 注册（库自带 CustomEvent 明细），
   * 此处不重载 addEventListener 以免与 HTMLElement 基签名冲突。 */
  export interface FoliateViewElement extends HTMLElement {
    book: FoliateBook
    renderer: {
      getContents(): FoliateContentsItem[]
      goTo(target: unknown): Promise<void>
      setAttribute(name: string, value: string): void
    } | null
    lastLocation: unknown
    open(book: FoliateBook): Promise<void>
    init(options: { lastLocation?: unknown; showTextStart?: boolean }): Promise<void>
    close(): void
    goTo(target: unknown): Promise<unknown>
    goToFraction(fraction: number): Promise<void>
    prev(distance?: number): Promise<void>
    next(distance?: number): Promise<void>
    getCFI(index: number, range?: Range | null): string
    /** CFI → {index, anchor}（与 getCFI 配对的官方逆过程；anchor 需 live 文档调用） */
    resolveCFI(cfi: string): { index: number; anchor: (doc: Document) => Range }
    /** 各节起始全局进度（末尾隐含 1），配合 relocate fraction 算全书进度 */
    getSectionFractions(): number[]
    addAnnotation(annotation: { value: string }, remove?: boolean): Promise<unknown>
    deleteAnnotation(annotation: { value: string }): Promise<unknown>
    showAnnotation(annotation: { value: string }): Promise<void>
  }
}

declare module '@foliate/epubcfi.js' {
  export const isCFI: RegExp
  export function parse(cfi: string): unknown
  export function collapse(cfi: string, toEnd?: boolean): string
  export function compare(a: string, b: string): number
  /** 解到 Range；定位失败抛错（调用方逐节 try/catch） */
  export function toRange(doc: Document, parts: unknown): Range
}

declare module '@foliate/overlayer.js' {
  export type OverlayerDrawFn = (
    rects: ArrayLike<DOMRect>,
    options?: { color?: string },
  ) => SVGGElement
  export class Overlayer {
    static highlight: OverlayerDrawFn
    static underline: OverlayerDrawFn
    static outline: OverlayerDrawFn
  }
}
