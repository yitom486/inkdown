/** Markdown 编辑区格式化纯函数（可单元测试） */

export interface TextRange {
  from: number
  to: number
}

export function wrapRangeText(
  text: string,
  range: TextRange,
  before: string,
  after: string,
): { nextText: string; selection: TextRange } {
  const selected = text.slice(range.from, range.to)

  if (range.from === range.to) {
    const insert = `${before}${after}`
    return {
      nextText: text.slice(0, range.from) + insert + text.slice(range.to),
      selection: { from: range.from + before.length, to: range.from + before.length },
    }
  }

  const insert = `${before}${selected}${after}`
  return {
    nextText: text.slice(0, range.from) + insert + text.slice(range.to),
    selection: {
      from: range.from + before.length,
      to: range.from + before.length + selected.length,
    },
  }
}

export function buildLinkTemplate(selected: string): { insert: string; urlSelection: TextRange } {
  const label = selected || '链接文字'
  const insert = `[${label}](https://)`
  const urlStart = label.length + 3
  const urlEnd = insert.length - 1

  return {
    insert,
    urlSelection: { from: urlStart, to: urlEnd },
  }
}

export function applyLinkTemplate(
  text: string,
  range: TextRange,
): { nextText: string; selection: TextRange } {
  const selected = text.slice(range.from, range.to)
  const { insert, urlSelection } = buildLinkTemplate(selected)

  return {
    nextText: text.slice(0, range.from) + insert + text.slice(range.to),
    selection: {
      from: range.from + urlSelection.from,
      to: range.from + urlSelection.to,
    },
  }
}
