/**
 * 统一阅读后端接口（EPUB / MOBI / KF8）。
 * foliate `makeBook` 按魔数识别容器，一套实现同时服务两种 Viewer；
 * 旧 EpubViewer（epubjs）/ MobiViewer（mobi-parser）已删除。
 */

/** 容器格式（按文件扩展名判定，KF8 含 .azw3/.azw） */
export type AdapterBookKind = 'epub' | 'mobi' | 'kf8' | 'unknown'

export interface AdapterTocItem {
  label: string
  /** 章节 href（含碎片）；目录外条目可为 null */
  href: string | null
  /** 归一化到的 spine 序号，无法定位时为 null */
  sectionIndex: number | null
  level: number
  children: AdapterTocItem[]
}

export interface AdapterSectionInfo {
  index: number
  /** 章节标识（EPUB 为 OPF 相对 href） */
  id: string
  /** 非线性章节（如封面）为 false */
  linear: boolean
}

/** 引擎无关位置：分数用于进度/续读，cfi 用于批注精确定位 */
export interface AdapterLocation {
  sectionIndex: number
  fraction?: number
  cfi?: string
}

import type { FoliateBook } from '@foliate/view.js'

export interface IReaderBookAdapter {
  readonly kind: AdapterBookKind
  readonly title: string
  readonly language?: string
  readonly toc: AdapterTocItem[]
  readonly sections: AdapterSectionInfo[]
  /** 底层 foliate 书对象（仅供 foliate-view 挂载，勿直接操作） */
  readonly engineBook: FoliateBook

  /** 章节纯文本（Agent 上下文 / 导出 / 组卷共用） */
  loadSectionText(index: number): Promise<string>
  /** 目录 href → spine 序号（含碎片归一），找不到返回 null */
  resolveHref(href: string): number | null
  /**
   * 旧 epubjs CFI → 本后端位置。两边同为 IDPF CFI 字符串，按包级 spine 步进
   * 精确定位章节（越界拒绝）；range 精度由 view.resolveCFI 在 live 文档上保证。
   */
  resolveLegacyEpubCfi(cfi: string): Promise<AdapterLocation | null>
  /** 位置 → 旧 epubjs CFI（章节基线；range 级 viewer 阶段补） */
  toLegacyEpubCfi(location: AdapterLocation): string | null
  destroy(): void
}

const KF8_EXTENSIONS = new Set(['.azw3', '.azw'])

export function detectAdapterBookKind(fileName: string): AdapterBookKind {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.epub')) return 'epub'
  if (lower.endsWith('.mobi')) return 'mobi'
  for (const ext of KF8_EXTENSIONS) {
    if (lower.endsWith(ext)) return 'kf8'
  }
  return 'unknown'
}
