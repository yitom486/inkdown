export interface RosettaTocSourceUnit {
  label: string
  /** PDF 大纲 href 即真实页（字符串数字） */
  href: string
  level?: number
}

export interface RosettaTocEntry {
  title: string
  realPage: number
  level: number
}

export interface OcrTocSourceEntry {
  title: string
  printedPage: number
  level: number
}

/**
 * 罗盘导入用目录归一（真实页帧）：原生/OCR 大纲优先（href 即真实页），
 * 否则印刷目录 + 偏移换算；非法页码丢弃，同页多条按 level 升序。
 */
export function resolveRosettaTocEntries(args: {
  outlineUnits: readonly RosettaTocSourceUnit[]
  ocrEntries: readonly OcrTocSourceEntry[]
  pageOffset: number
  pageCount: number
}): RosettaTocEntry[] {
  const { outlineUnits, ocrEntries, pageOffset, pageCount } = args
  const offset = Number.isFinite(pageOffset) ? Math.round(pageOffset) : 0
  const entries: RosettaTocEntry[] = []
  if (outlineUnits.length > 0) {
    for (const unit of outlineUnits) {
      const title = unit.label.trim()
      const realPage = Number.parseInt(unit.href, 10)
      if (!title || !Number.isInteger(realPage) || realPage < 1 || realPage > pageCount) continue
      entries.push({ title, realPage, level: unit.level ?? 0 })
    }
  } else {
    for (const entry of ocrEntries) {
      const title = entry.title.trim()
      if (!title || !Number.isFinite(entry.printedPage) || entry.printedPage < 1) continue
      const realPage = Math.max(1, Math.round(entry.printedPage + offset))
      if (realPage > pageCount) continue
      entries.push({ title, realPage, level: entry.level })
    }
  }
  return entries.sort((a, b) => a.realPage - b.realPage || a.level - b.level)
}
