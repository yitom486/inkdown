export interface EpubContentsLike {
  window: Window
  cfiFromRange?: (range: Range) => string
}

export interface EpubSelectionSnapshot {
  text: string
  cfiRange: string
  rect: DOMRect
}

export function readEpubSelection(contents: EpubContentsLike): EpubSelectionSnapshot | null {
  const selection = contents.window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  if (!contents.cfiFromRange) return null
  return buildEpubSnapshotFromRange(contents, selection.getRangeAt(0), selection.toString().trim())
}

export function buildEpubSnapshotFromRange(
  contents: EpubContentsLike,
  range: Range,
  text?: string,
): EpubSelectionSnapshot | null {
  const resolvedText = (text ?? range.toString()).trim()
  if (!resolvedText || !contents.cfiFromRange) return null

  try {
    const cfiRange = contents.cfiFromRange(range)
    if (!cfiRange) return null
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    return { text: resolvedText, cfiRange, rect }
  } catch {
    return null
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
