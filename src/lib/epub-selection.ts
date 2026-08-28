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

  const text = selection.toString().trim()
  if (!text || !contents.cfiFromRange) return null

  try {
    const range = selection.getRangeAt(0)
    const cfiRange = contents.cfiFromRange(range)
    if (!cfiRange) return null
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    return { text, cfiRange, rect }
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
