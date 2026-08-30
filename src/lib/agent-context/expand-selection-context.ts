/** 选区短于等于此长度时，在父文本里向前后各扩一段 */
export const SELECTION_SHORT_MAX_CHARS = 30
export const SELECTION_CONTEXT_PADDING = 30

export interface SelectionContextResult {
  selection: string
  /** 给模型读的片段：短选区会带前后文，长选区等于 selection */
  excerpt: string
  expanded: boolean
  selectionLength: number
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 在 parent 里找 selection 的起始下标；先精确再折叠空白 */
export function findSelectionIndex(parent: string, selection: string): number {
  if (!selection) return -1
  const exact = parent.indexOf(selection)
  if (exact >= 0) return exact

  const collapsedParent = collapseSpaces(parent)
  const collapsedSel = collapseSpaces(selection)
  if (!collapsedSel) return -1
  const at = collapsedParent.indexOf(collapsedSel)
  if (at < 0) return -1

  // 映射回原文近似位置：按折叠前的字符比例粗估
  let seen = 0
  let i = 0
  while (i < parent.length && seen < at) {
    if (/\S/.test(parent[i]!)) seen += 1
    i += 1
  }
  return i
}

/**
 * 短选区在父文本里前后各补 {@link SELECTION_CONTEXT_PADDING} 字——只补局部上下文，
 * **不会**把整章/整页作为 excerpt 返回。长选区直接返回选区本身。
 */
export function buildSelectionContext(
  selection: string,
  parentText: string,
  shortMax = SELECTION_SHORT_MAX_CHARS,
  padding = SELECTION_CONTEXT_PADDING,
): SelectionContextResult {
  const trimmed = selection.trim()
  const selectionLength = trimmed.length
  if (!trimmed) {
    throw new Error('当前没有选中文本')
  }

  if (selectionLength > shortMax) {
    return { selection: trimmed, excerpt: trimmed, expanded: false, selectionLength }
  }

  const index = findSelectionIndex(parentText, trimmed)
  if (index < 0) {
    return { selection: trimmed, excerpt: trimmed, expanded: false, selectionLength }
  }

  const start = Math.max(0, index - padding)
  const end = Math.min(parentText.length, index + trimmed.length + padding)
  const body = parentText.slice(start, end).replace(/\s+/g, ' ').trim()
  const excerpt = `${start > 0 ? '…' : ''}${body}${end < parentText.length ? '…' : ''}`

  return { selection: trimmed, excerpt, expanded: true, selectionLength }
}
